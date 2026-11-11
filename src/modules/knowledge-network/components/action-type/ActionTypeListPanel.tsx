/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Dropdown, Empty, Input, Segmented, Select, Spin, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ActionTypeCreateEntryModal } from "@/modules/knowledge-network/components/action-type/ActionTypeCreateEntryModal";
import {
  getActionTypeToolboxMetadataType,
  needsActionTypeActionSourceDisplayResolution,
  resolveActionTypeActionSourceDisplayWithTimeout,
} from "@/modules/knowledge-network/services/action-type-tool.service";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import {
  ObjectTypeResourceGraph,
  type ObjectTypeGraphSelectedResource,
} from "@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import { ObjectTypeGraphSidebar } from "@/modules/knowledge-network/components/shared/ObjectTypeGraphSidebar";
import { ObjectTypeRemoteFilter } from "@/modules/knowledge-network/components/shared/ObjectTypeRemoteFilter";
import { ResourceTagList } from "@/modules/knowledge-network/components/shared/ResourceTagList";
import { ResourcePermissionRequestAction } from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import { canRequestResourcePermission } from "@/modules/knowledge-network/components/shared/resource-permission-request";
import {
  readPositiveInteger,
  usePersistentPageSize,
} from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import { useObjectTypeGraphExplorer } from "@/modules/knowledge-network/components/shared/useObjectTypeGraphExplorer";
import { useKnowledgeNetworkCanOperate } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import {
  knowledgeNetworkReturnState,
  readKnowledgeNetworkGraphSelection,
  writeKnowledgeNetworkGraphSelection,
  type KnowledgeNetworkGraphSelection,
} from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import {
  actionTypeOperationLabelKey,
  actionTypeSpecificOperationLabelKey,
  getActionTypeOperationKind,
  readActionTypeOperationKind,
} from "@/modules/knowledge-network/utils/action-type-operation";
import type {
  ActionTypeActionSource,
  ActionTypeExecutionToolCategory,
  ActionTypeOperationKind,
} from "@/modules/knowledge-network/types/action-type";
import type {
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { listKnowledgeNetworkActionTypePage } from "@/modules/knowledge-network/services/action-type.service";
import { getKnowledgeNetworkRelationTypeDetail } from "@/modules/knowledge-network/services/relation-type.service";
import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/relation-type";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";
import {
  getActionSourceDisplayName,
  getReadableActionSourceDisplayName,
} from "@/modules/knowledge-network/utils/action-type-execution";

import { DeprecatedName } from "@/modules/knowledge-network/components/definition-declarations/DeprecatedName";
import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";
import graphStyles from "@/modules/knowledge-network/components/shared/ResourceGraphExplorer.module.css";

type ActionTypeListPanelProps = {
  canDelete: boolean;
  canModify: boolean;
  networkId: string;
  networkName: string;
  onDelete: (records: KnowledgeNetworkActionTypeRecord[]) => Promise<void>;
};

function readActionKind(value: string | null): "all" | KnowledgeNetworkActionTypeKind {
  return value === "create" || value === "delete" || value === "notify" || value === "update"
    ? value
    : "all";
}

function readSortBy(value: string | null): "name" | "updateTime" {
  return value === "name" ? "name" : "updateTime";
}

function readSortDirection(value: string | null): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

function readExecutionToolCategory(value: string | null): ActionTypeExecutionToolCategory | "all" {
  return value === "openapi" || value === "function" || value === "mcp" ? value : "all";
}

function actionSourceKey(source: ActionTypeActionSource): string {
  return [
    source.type,
    source.boxId || source.mcpId || "",
    source.toolId || source.toolName || "",
  ].join(":");
}

export function ActionTypeListPanel({
  canDelete,
  canModify,
  networkId,
  networkName,
  onDelete,
}: ActionTypeListPanelProps) {
  const permissionRequestsEnabled = !isCommunityBuild(useEntitlement());
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastSyncedSearchRef = useRef(searchParams.toString());
  const { modal } = useAppServices();
  const canAuthorizeChildren = useKnowledgeNetworkCanOperate(networkId, "authorize");
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [actionKindFilter, setActionKindFilter] = useState<"all" | KnowledgeNetworkActionTypeKind>(
    () => readActionKind(searchParams.get("actionKind")),
  );
  const [operationFilter, setOperationFilter] = useState<ActionTypeOperationKind | "all">(
    () => readActionTypeOperationKind(searchParams.get("operation")) ?? "all",
  );
  const [relationOperationFilter, setRelationOperationFilter] = useState<
    "all" | "create" | "delete"
  >(() => {
    const value = searchParams.get("relationOperation");
    return value === "create" || value === "delete" ? value : "all";
  });
  const [objectTypeFilter, setObjectTypeFilter] = useState(
    () => searchParams.get("objectType") ?? "all",
  );
  const executionToolCategory = readExecutionToolCategory(
    searchParams.get("executionToolCategory"),
  );
  const [sortBy, setSortBy] = useState<"name" | "updateTime">(() =>
    readSortBy(searchParams.get("sort")),
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(() =>
    readSortDirection(searchParams.get("order")),
  );
  const [page, setPage] = useState(() => readPositiveInteger(searchParams.get("page"), 1));
  const [pageSize, setPageSize] = usePersistentPageSize("action-types");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"graph" | "list">(() =>
    searchParams.get("view") === "list" ? "list" : "graph",
  );
  const [selectedGraphObjectTypeId, setSelectedGraphObjectTypeId] = useState(
    () => searchParams.get("objectTypeId") ?? "",
  );
  const [selectedGraphActionType, setSelectedGraphActionType] =
    useState<KnowledgeNetworkActionTypeRecord | null>(null);
  const [createEntryOpen, setCreateEntryOpen] = useState(false);
  const [authorizingRecord, setAuthorizingRecord] =
    useState<KnowledgeNetworkActionTypeRecord | null>(null);
  const [items, setItems] = useState<KnowledgeNetworkActionTypeRecord[]>([]);
  const resolvedActionSources = useRef(new Map<string, ActionTypeActionSource>());
  const resolvingActionSources = useRef(new Set<string>());
  const [, updateActionSourceDisplays] = useState(0);
  const toolboxCategories = useRef(new Map<string, ActionTypeExecutionToolCategory | null>());
  const resolvingToolboxCategories = useRef(new Set<string>());
  const [, updateToolboxCategories] = useState(0);
  const relationCache = useRef(new Map<string, KnowledgeNetworkRelationTypeRecord | null>());
  const [relationTypes, setRelationTypes] = useState<
    Record<string, KnowledgeNetworkRelationTypeRecord | null>
  >({});
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
  const graphObjects = useObjectTypeGraphExplorer({
    direction: sortDirection,
    enabled: viewMode === "graph",
    keyword: debouncedKeyword,
    networkId,
    refreshVersion,
    resourceScope: "actions",
    selectedId: selectedGraphObjectTypeId,
    setSelectedId: setSelectedGraphObjectTypeId,
    sort: sortBy === "name" ? "name" : "update_time",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    const visible = viewMode === "list" ? items : [];
    for (const record of visible) {
      const source = record.actionSource;
      if (
        source?.type === "tool" &&
        source.boxId &&
        !toolboxCategories.current.has(source.boxId) &&
        !resolvingToolboxCategories.current.has(source.boxId)
      ) {
        const boxId = source.boxId;
        resolvingToolboxCategories.current.add(boxId);
        void getActionTypeToolboxMetadataType(boxId)
          .then((category) => toolboxCategories.current.set(boxId, category ?? null))
          .catch(() => toolboxCategories.current.set(boxId, null))
          .finally(() => {
            resolvingToolboxCategories.current.delete(boxId);
            updateToolboxCategories((current) => current + 1);
          });
      }
      if (!source || !needsActionTypeActionSourceDisplayResolution(source)) continue;
      const key = actionSourceKey(source);
      if (resolvedActionSources.current.has(key) || resolvingActionSources.current.has(key))
        continue;
      resolvingActionSources.current.add(key);
      void resolveActionTypeActionSourceDisplayWithTimeout(source)
        .then((resolved) => resolvedActionSources.current.set(key, resolved))
        .catch(() => resolvedActionSources.current.set(key, source))
        .finally(() => {
          resolvingActionSources.current.delete(key);
          updateActionSourceDisplays((current) => current + 1);
        });
    }
  }, [items, viewMode]);

  useEffect(() => {
    if (viewMode !== "list") {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void listKnowledgeNetworkActionTypePage(networkId, {
      actionKind: actionKindFilter === "all" ? undefined : actionKindFilter,
      executionToolCategory: executionToolCategory === "all" ? undefined : executionToolCategory,
      direction: sortDirection,
      limit: pageSize,
      namePattern: debouncedKeyword,
      objectTypeId: objectTypeFilter === "all" ? undefined : objectTypeFilter,
      operationKind: operationFilter === "all" ? undefined : operationFilter,
      relationOperation:
        operationFilter === "relation" && relationOperationFilter !== "all"
          ? relationOperationFilter
          : undefined,
      offset: (page - 1) * pageSize,
      sort: sortBy === "name" ? "name" : "update_time",
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        const maxPage = Math.max(1, Math.ceil(result.totalCount / pageSize));
        if (page > maxPage) {
          setItems([]);
          setTotalCount(result.totalCount);
          setPage(maxPage);
          return;
        }
        setItems(result.entries);
        setTotalCount(result.totalCount);
        setSelectedRowKeys([]);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    actionKindFilter,
    debouncedKeyword,
    executionToolCategory,
    networkId,
    objectTypeFilter,
    operationFilter,
    relationOperationFilter,
    page,
    pageSize,
    refreshVersion,
    sortBy,
    sortDirection,
    viewMode,
  ]);

  useEffect(() => {
    const relationIds = items
      .filter((item) => item.operationConfig?.type === "relation")
      .map((item) => item.operationConfig)
      .filter(
        (config): config is Extract<typeof config, { type: "relation" }> =>
          config?.type === "relation",
      )
      .map((config) => config.relationTypeId);
    const missingIds = [...new Set(relationIds)].filter(
      (id) => !relationCache.current.has(`${networkId}:${refreshVersion}:${id}`),
    );
    if (!missingIds.length) return;
    let cancelled = false;
    void Promise.all(
      missingIds.map(async (id) => {
        try {
          return [id, await getKnowledgeNetworkRelationTypeDetail(networkId, id)] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, KnowledgeNetworkRelationTypeRecord | null> = {};
      results.forEach(([id, relation]) => {
        const key = `${networkId}:${refreshVersion}:${id}`;
        relationCache.current.set(key, relation);
        next[key] = relation;
      });
      setRelationTypes((current) => ({ ...current, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [items, networkId, refreshVersion]);

  useEffect(() => {
    const nextKeyword = searchParams.get("q") ?? "";
    const nextActionKind = readActionKind(searchParams.get("actionKind"));
    const nextRelationOperation = searchParams.get("relationOperation");
    const nextObjectType = searchParams.get("objectType") ?? "all";
    setOperationFilter(readActionTypeOperationKind(searchParams.get("operation")) ?? "all");
    setRelationOperationFilter(
      nextRelationOperation === "create" || nextRelationOperation === "delete"
        ? nextRelationOperation
        : "all",
    );
    const nextSortBy = readSortBy(searchParams.get("sort"));
    const nextSortDirection = readSortDirection(searchParams.get("order"));
    const nextPage = readPositiveInteger(searchParams.get("page"), 1);
    const nextViewMode = searchParams.get("view") === "list" ? "list" : "graph";
    const nextObjectTypeId = searchParams.get("objectTypeId") ?? "";
    setKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setActionKindFilter((current) => (current === nextActionKind ? current : nextActionKind));
    setObjectTypeFilter((current) => (current === nextObjectType ? current : nextObjectType));
    setSortBy((current) => (current === nextSortBy ? current : nextSortBy));
    setSortDirection((current) => (current === nextSortDirection ? current : nextSortDirection));
    setPage((current) => (current === nextPage ? current : nextPage));
    setViewMode((current) => (current === nextViewMode ? current : nextViewMode));
    setSelectedGraphObjectTypeId((current) =>
      current === nextObjectTypeId ? current : nextObjectTypeId,
    );
  }, [searchParams]);

  useEffect(() => {
    const currentSearch = searchParams.toString();
    if (currentSearch !== lastSyncedSearchRef.current) {
      // Let URL-driven state updates settle before writing state back to the URL.
      lastSyncedSearchRef.current = currentSearch;
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string, fallback: string) => {
      if (value !== fallback) nextParams.set(key, value);
      else nextParams.delete(key);
    };
    setOrDelete("q", keyword.trim(), "");
    setOrDelete("actionKind", actionKindFilter, "all");
    setOrDelete("objectType", objectTypeFilter, "all");
    setOrDelete("executionToolCategory", executionToolCategory, "all");
    setOrDelete("operation", operationFilter, "all");
    setOrDelete("relationOperation", relationOperationFilter, "all");
    setOrDelete("sort", sortBy, "updateTime");
    setOrDelete("order", sortDirection, "desc");
    setOrDelete("page", String(page), "1");
    setOrDelete("pageSize", String(pageSize), "10");
    if (viewMode === "graph") {
      nextParams.delete("view");
      nextParams.delete("graphScope");
      nextParams.delete("actionTypeId");
      if (selectedGraphObjectTypeId) nextParams.set("objectTypeId", selectedGraphObjectTypeId);
      else nextParams.delete("objectTypeId");
    } else {
      nextParams.set("view", "list");
      nextParams.delete("graphScope");
      nextParams.delete("objectTypeId");
      nextParams.delete("actionTypeId");
      writeKnowledgeNetworkGraphSelection(nextParams);
    }
    if (nextParams.toString() !== searchParams.toString()) {
      lastSyncedSearchRef.current = nextParams.toString();
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    actionKindFilter,
    executionToolCategory,
    keyword,
    objectTypeFilter,
    operationFilter,
    relationOperationFilter,
    page,
    pageSize,
    searchParams,
    selectedGraphObjectTypeId,
    setSearchParams,
    sortBy,
    sortDirection,
    viewMode,
  ]);

  const hasActiveFilter = useMemo(
    () =>
      Boolean(keyword.trim()) ||
      actionKindFilter !== "all" ||
      executionToolCategory !== "all" ||
      objectTypeFilter !== "all" ||
      operationFilter !== "all",
    [actionKindFilter, executionToolCategory, keyword, objectTypeFilter, operationFilter],
  );

  const selectedRows = useMemo(
    () =>
      items.filter(
        (item) =>
          selectedRowKeys.includes(item.id) && hasKnowledgeNetworkRecordOperation(item, "delete"),
      ),
    [items, selectedRowKeys],
  );
  const deleteTargets = useMemo(() => {
    if (viewMode === "list") return selectedRows;
    if (
      !selectedGraphActionType ||
      !hasKnowledgeNetworkRecordOperation(selectedGraphActionType, "delete")
    ) {
      return [];
    }
    return [selectedGraphActionType];
  }, [selectedGraphActionType, selectedRows, viewMode]);
  const actionTypeListPath = `/knowledge-network/workspace/${networkId}/action-types`;
  const currentReturnQuery = searchParams.toString();
  const currentReturnTo = `${actionTypeListPath}${currentReturnQuery ? `?${currentReturnQuery}` : ""}`;

  const confirmDelete = (records: KnowledgeNetworkActionTypeRecord[]) => {
    if (records.length === 0) {
      return;
    }

    void modal.confirm({
      title:
        records.length > 1
          ? t("knowledgeNetwork.actionTypeBatchDeleteTitle")
          : t("knowledgeNetwork.actionTypeDeleteTitle"),
      content:
        records.length > 1
          ? t("knowledgeNetwork.actionTypeBatchDeleteDescription", {
              count: records.length,
            })
          : t("knowledgeNetwork.actionTypeDeleteDescription", {
              name: records[0]?.name ?? "",
            }),
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        await onDelete(records);
        if (records.some((record) => record.id === selectedGraphActionType?.id)) {
          setSelectedGraphActionType(null);
        }
        setSelectedRowKeys([]);
        setRefreshVersion((current) => current + 1);
      },
      width: 520,
    });
  };

  const handleOperate = (key: string, record: KnowledgeNetworkActionTypeRecord) => {
    if (key === "view") {
      void navigate(`/knowledge-network/workspace/${networkId}/action-types/${record.id}/detail`, {
        state: knowledgeNetworkReturnState(currentReturnTo),
      });
      return;
    }

    if (key === "edit") {
      void navigate(`/knowledge-network/workspace/${networkId}/action-types/${record.id}/edit`, {
        state: knowledgeNetworkReturnState(currentReturnTo),
      });
      return;
    }

    if (key === "execution") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/action-types/${record.id}/execution`,
        { state: knowledgeNetworkReturnState(currentReturnTo) },
      );
      return;
    }

    if (key === "authorize") {
      setAuthorizingRecord(record);
      return;
    }

    if (key === "delete") {
      confirmDelete([record]);
    }
  };

  const columns: NonNullable<TableProps<KnowledgeNetworkActionTypeRecord>["columns"]> = [
    {
      dataIndex: "name",
      fixed: "left",
      key: "name",
      title: t("common.name"),
      width: 280,
      render: (value: string, record) => (
        <div
          className={styles.objectTitleBox}
          onClick={() => {
            void navigate(
              `/knowledge-network/workspace/${networkId}/action-types/${record.id}/detail`,
              { state: knowledgeNetworkReturnState(currentReturnTo) },
            );
          }}
          title={value}
        >
          <span
            className={styles.objectIconSquare}
            style={{ backgroundColor: record.color || "#90c06b" }}
          >
            <ThunderboltOutlined />
          </span>
          <DeprecatedName declarations={record.declarations}>
            <span className={styles.objectName}>{value}</span>
          </DeprecatedName>
        </div>
      ),
    },
    {
      fixed: "left",
      key: "operation",
      title: t("common.actions"),
      width: 72,
      render: (_value, record) => {
        const menuItems: MenuProps["items"] = [
          { key: "view", label: t("common.detail") },
          ...(canRequestResourcePermission(
            "action_type",
            record.operations,
            permissionRequestsEnabled,
          )
            ? [
                {
                  key: "request-permission",
                  label: (
                    <ResourcePermissionRequestAction
                      operations={record.operations}
                      resourceType="action_type"
                      resourceID={`${networkId}/${record.id}`}
                      resourceName={`${networkName} / ${record.name}`}
                    />
                  ),
                },
              ]
            : []),
          ...(hasKnowledgeNetworkRecordOperation(record, "modify")
            ? [{ key: "edit", label: t("common.edit") }]
            : []),
          ...(hasKnowledgeNetworkRecordOperation(record, "execute")
            ? [{ key: "execution", label: t("knowledgeNetwork.actionTypeExecutionEntry") }]
            : []),
          ...(canAuthorizeChildren && hasKnowledgeNetworkRecordOperation(record, "view_detail")
            ? [
                {
                  key: "authorize",
                  label: (
                    <KnowledgeNetworkAuthorizationActionLabel>
                      {t("knowledgeNetwork.authorizeAction")}
                    </KnowledgeNetworkAuthorizationActionLabel>
                  ),
                },
              ]
            : []),
          ...(hasKnowledgeNetworkRecordOperation(record, "delete")
            ? [{ key: "delete", danger: true, label: t("common.delete") }]
            : []),
        ];

        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ domEvent, key }) => {
                domEvent.stopPropagation();
                handleOperate(String(key), record);
              },
            }}
            overlayClassName={styles.dropdownMenu}
            trigger={["click"]}
          >
            <AppButton
              aria-label={t("common.actions")}
              icon={<EllipsisOutlined style={{ fontSize: 20 }} />}
              onClick={(event) => event.stopPropagation()}
              type="text"
            />
          </Dropdown>
        );
      },
    },
    {
      key: "category",
      title: t("knowledgeNetwork.actionOperationCategory"),
      width: 150,
      render: (_value, record) =>
        t(actionTypeOperationLabelKey(getActionTypeOperationKind(record))),
    },
    {
      key: "specificOperation",
      title: t("knowledgeNetwork.actionOperationSpecific"),
      width: 150,
      render: (_value, record) => t(actionTypeSpecificOperationLabelKey(record)),
    },
    {
      key: "scope",
      title: t("knowledgeNetwork.actionOperationScope"),
      width: 270,
      render: (_value, record) => {
        if (getActionTypeOperationKind(record) === "tool") {
          return t("knowledgeNetwork.actionIndependentScope");
        }
        if (record.operationConfig?.type !== "relation") {
          return record.objectTypeName || "--";
        }
        const relation =
          relationTypes[`${networkId}:${refreshVersion}:${record.operationConfig.relationTypeId}`];
        if (!relation) return record.operationConfig.relationTypeId || "--";
        return t("knowledgeNetwork.actionRelationScope", {
          source: relation.sourceObjectTypeName,
          relation: relation.name,
          target: relation.targetObjectTypeName,
        });
      },
    },
    {
      key: "toolCategory",
      title: t("knowledgeNetwork.actionTypeExecutionToolCategory"),
      width: 130,
      render: (_value, record) => {
        const source = record.actionSource;
        if (source?.type === "mcp") {
          return t("executionFactory.executionUnitTabsV2.mcp");
        }
        if (source?.type !== "tool" || !source.boxId) return "--";
        const category = toolboxCategories.current.get(source.boxId);
        if (category === undefined) {
          return t("knowledgeNetwork.actionTypeExecutionSourceResolving");
        }
        if (category === "openapi") return t("executionFactory.openapiToolboxTab");
        if (category === "function") return t("executionFactory.functionToolboxTab");
        return "--";
      },
    },
    {
      key: "executionTool",
      title: t("knowledgeNetwork.actionTypeExecutionToolFilter"),
      width: 220,
      render: (_value, record) => {
        const source = record.actionSource;
        const resolved = source && resolvedActionSources.current.get(actionSourceKey(source));
        if (source && needsActionTypeActionSourceDisplayResolution(source) && !resolved) {
          return t("knowledgeNetwork.actionTypeExecutionSourceResolving");
        }
        const name = getReadableActionSourceDisplayName(resolved || source);
        if (name) return <span title={name}>{name}</span>;
        return source ? (
          <span title={getActionSourceDisplayName(source)}>
            {t("knowledgeNetwork.actionTypeExecutionSourceUnavailable")}
          </span>
        ) : (
          "--"
        );
      },
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      width: 160,
      render: (value: string[]) =>
        value.length > 0 ? <ResourceTagList tags={value} /> : t("knowledgeNetwork.noTags"),
    },
    {
      dataIndex: "updaterName",
      key: "updaterName",
      title: t("knowledgeNetwork.modifier"),
      width: 140,
      render: (value: string) => value || "--",
    },
    {
      dataIndex: "updateTime",
      key: "updateTime",
      title: t("common.updateTime"),
      width: 180,
      render: (value: string) => value || "--",
    },
  ];
  const openCreate = () => setCreateEntryOpen(true);

  const renderEmptyContent = () => {
    if (hasActiveFilter) {
      return (
        <Empty
          className={styles.emptyPanel}
          description={t("knowledgeNetwork.actionTypeEmptyNoSearchResult")}
        />
      );
    }

    if (!canModify) {
      return (
        <Empty className={styles.emptyPanel} description={t("knowledgeNetwork.emptyActionTypes")} />
      );
    }

    return (
      <Empty
        className={styles.emptyPanel}
        description={
          <span>
            {t("knowledgeNetwork.emptyCreateHint")}
            <AppButton onClick={openCreate} type="link">
              {t("knowledgeNetwork.emptyCreateAction")}
            </AppButton>
            {t("knowledgeNetwork.emptyCreateSuffix")}
          </span>
        }
      />
    );
  };
  const selectGraphObject = (record: KnowledgeNetworkObjectTypeRecord) => {
    const nextParams = new URLSearchParams(searchParams);
    writeKnowledgeNetworkGraphSelection(nextParams);
    nextParams.delete("graphScope");
    nextParams.set("objectTypeId", record.id);
    setSearchParams(nextParams, { replace: true });
    setSelectedGraphObjectTypeId(record.id);
    graphObjects.setSelected(record);
    setSelectedGraphActionType(null);
  };
  const handleGraphResourceSelection = useCallback(
    (resource?: ObjectTypeGraphSelectedResource) => {
      setSelectedGraphActionType(resource?.kind === "action" ? resource.value : null);
      const nextParams = new URLSearchParams(searchParams);
      writeKnowledgeNetworkGraphSelection(
        nextParams,
        resource
          ? {
              id:
                resource.kind === "object"
                  ? resource.id
                  : resource.kind === "metric"
                    ? resource.value.definition.id
                    : resource.value.id,
              kind: resource.kind,
              ...(resource.kind === "metric" ? { version: resource.value.definition.version } : {}),
            }
          : undefined,
      );
      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );
  const restoredGraphSelection = readKnowledgeNetworkGraphSelection(searchParams);
  const graphReturnTo = (selection: KnowledgeNetworkGraphSelection) => {
    const graphReturnParams = new URLSearchParams(searchParams);
    graphReturnParams.delete("view");
    graphReturnParams.delete("actionTypeId");
    if (selectedGraphObjectTypeId) {
      graphReturnParams.set("objectTypeId", selectedGraphObjectTypeId);
    }
    writeKnowledgeNetworkGraphSelection(graphReturnParams, selection);
    return `${actionTypeListPath}?${graphReturnParams.toString()}`;
  };

  return (
    <>
      <section
        className={`${styles.page} ${styles.objectTypePage} ${styles.actionTypePage} ${graphStyles.panelPage} ${
          viewMode === "graph" ? graphStyles.graphPage : ""
        }`}
      >
        <div className={`${styles.toolbar} ${graphStyles.pageToolbar}`}>
          <div className={graphStyles.viewModeRow}>
            <div className={styles.toolbarLeft}>
              <Segmented
                onChange={(value) => {
                  setViewMode(value as "graph" | "list");
                  setSelectedRowKeys([]);
                }}
                options={[
                  { label: t("knowledgeNetwork.objectTypeGraphView"), value: "graph" },
                  { label: t("knowledgeNetwork.objectTypeListView"), value: "list" },
                ]}
                value={viewMode}
              />
            </div>
          </div>
          <div className={`${graphStyles.operationRow} ${styles.actionTypeOperationRow}`}>
            <div className={styles.toolbarLeft}>
              {canModify ? (
                <AppButton
                  className={styles.toolbarButton}
                  icon={<PlusOutlined />}
                  onClick={openCreate}
                  type="primary"
                >
                  {t("common.create")}
                </AppButton>
              ) : null}
              {canDelete && viewMode === "list" ? (
                <AppButton
                  className={styles.toolbarButton}
                  danger
                  disabled={deleteTargets.length === 0}
                  icon={<DeleteOutlined />}
                  onClick={() => confirmDelete(deleteTargets)}
                >
                  {t("common.delete")}
                </AppButton>
              ) : null}
            </div>
            <div className={styles.toolbarRight}>
              <Input
                allowClear
                className={styles.searchInput}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                placeholder={t("knowledgeNetwork.searchPlaceholder")}
                prefix={<SearchOutlined className={styles.searchIcon} />}
                value={keyword}
              />
              {viewMode === "list" ? (
                <>
                  {operationFilter !== "tool" ? (
                    <ObjectTypeRemoteFilter
                      label={t("knowledgeNetwork.actionTypeObject")}
                      networkId={networkId}
                      onChange={(value) => {
                        setObjectTypeFilter(value);
                        setPage(1);
                      }}
                      value={objectTypeFilter}
                    />
                  ) : null}
                  <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>
                      {t("knowledgeNetwork.actionOperationCategory")}
                    </span>
                    <Select
                      className={styles.filterSelect}
                      onChange={(value) => {
                        setOperationFilter(value);
                        setActionKindFilter("all");
                        setRelationOperationFilter("all");
                        if (value === "tool") setObjectTypeFilter("all");
                        setPage(1);
                      }}
                      options={[
                        { label: t("common.all"), value: "all" },
                        ...(["object", "relation", "tool"] as const).map((kind) => ({
                          label: t(actionTypeOperationLabelKey(kind)),
                          value: kind,
                        })),
                      ]}
                      value={operationFilter}
                    />
                  </div>
                  <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>
                      {t("knowledgeNetwork.actionTypeExecutionToolCategory")}
                    </span>
                    <Select
                      aria-label={t("knowledgeNetwork.actionTypeExecutionToolCategory")}
                      className={styles.filterSelect}
                      onChange={(value: ActionTypeExecutionToolCategory | "all") => {
                        const nextParams = new URLSearchParams(searchParams);
                        if (value === "all") nextParams.delete("executionToolCategory");
                        else nextParams.set("executionToolCategory", value);
                        nextParams.delete("page");
                        setSearchParams(nextParams, { replace: true });
                      }}
                      options={[
                        { label: t("common.all"), value: "all" },
                        { label: t("executionFactory.openapiToolboxTab"), value: "openapi" },
                        { label: t("executionFactory.functionToolboxTab"), value: "function" },
                        { label: t("executionFactory.executionUnitTabsV2.mcp"), value: "mcp" },
                      ]}
                      value={executionToolCategory}
                    />
                  </div>
                  {operationFilter === "object" || operationFilter === "relation" ? (
                    <div className={styles.filterGroup}>
                      <span className={styles.filterLabel}>
                        {t("knowledgeNetwork.actionOperationSpecific")}
                      </span>
                      <Select
                        className={styles.filterSelect}
                        onChange={(value: "all" | KnowledgeNetworkActionTypeKind) => {
                          if (operationFilter === "object") setActionKindFilter(value);
                          else
                            setRelationOperationFilter(
                              value === "create" || value === "delete" ? value : "all",
                            );
                          setPage(1);
                        }}
                        options={[
                          { label: t("common.all"), value: "all" },
                          ...(operationFilter === "object"
                            ? (["create", "update", "delete", "notify"] as const).map((kind) => ({
                                label: t(
                                  actionTypeSpecificOperationLabelKey({
                                    actionKind: kind,
                                    objectTypeId: "object",
                                  }),
                                ),
                                value: kind,
                              }))
                            : (["create", "delete"] as const).map((kind) => ({
                                label: t(
                                  kind === "create"
                                    ? "knowledgeNetwork.actionRelationCreate"
                                    : "knowledgeNetwork.actionRelationDelete",
                                ),
                                value: kind,
                              }))),
                        ]}
                        value={
                          operationFilter === "object" ? actionKindFilter : relationOperationFilter
                        }
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className={styles.actionTypeToolbarActions}>
                <Dropdown
                  menu={{
                    items: [
                      { key: "updateTime", label: t("knowledgeNetwork.sortByUpdateTime") },
                      { key: "name", label: t("knowledgeNetwork.sortByName") },
                    ],
                    onClick: ({ key }) => {
                      const nextSortBy = key as "name" | "updateTime";
                      setSortDirection((current) =>
                        nextSortBy === sortBy ? (current === "desc" ? "asc" : "desc") : "desc",
                      );
                      setSortBy(nextSortBy);
                      setPage(1);
                    },
                  }}
                  trigger={["click"]}
                >
                  <button
                    aria-label={t("knowledgeNetwork.sortByUpdateTime")}
                    className={styles.iconButton}
                    type="button"
                  >
                    <SortAscendingOutlined />
                  </button>
                </Dropdown>
                <button
                  aria-label={t("common.refresh")}
                  className={styles.iconButton}
                  onClick={() => setRefreshVersion((current) => current + 1)}
                  type="button"
                >
                  <ReloadOutlined />
                </button>
              </div>
            </div>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className={styles.tableCard}>
            <Table<KnowledgeNetworkActionTypeRecord>
              columns={columns}
              dataSource={items}
              loading={isLoading}
              locale={{ emptyText: renderEmptyContent() }}
              pagination={false}
              rowKey="id"
              rowSelection={
                canDelete
                  ? {
                      selectedRowKeys,
                      onChange: (nextSelectedRowKeys) => {
                        setSelectedRowKeys(nextSelectedRowKeys.map(String));
                      },
                      getCheckboxProps: (record) => ({
                        disabled: !hasKnowledgeNetworkRecordOperation(record, "delete"),
                      }),
                    }
                  : undefined
              }
              scroll={{ x: 1600 }}
              size="middle"
            />
          </div>
        ) : (
          <div className={graphStyles.graphLayout}>
            <ObjectTypeGraphSidebar
              emptyContent={<Empty description={t("knowledgeNetwork.emptyObjectTypes")} />}
              items={graphObjects.items}
              loading={graphObjects.loading}
              onPageChange={graphObjects.setPage}
              onSelect={selectGraphObject}
              page={graphObjects.page}
              pageSize={graphObjects.pageSize}
              resourceCountLabel={t("knowledgeNetwork.objectTypeGraphActions")}
              resourceCounts={graphObjects.resourceCounts}
              selectedId={selectedGraphObjectTypeId}
              totalCount={graphObjects.totalCount}
            />
            <div className={graphStyles.graphContent}>
              <Spin spinning={graphObjects.selectedLoading}>
                {graphObjects.selected?.id === selectedGraphObjectTypeId ? (
                  <ObjectTypeResourceGraph
                    allowAuthorizeObject={false}
                    allowDeleteObject={false}
                    allowEditObject={false}
                    canAuthorizeObject={canAuthorizeChildren}
                    canModify={canModify}
                    canRequestObjectPermission={false}
                    initialSelectedResource={restoredGraphSelection}
                    key={graphObjects.selected.id}
                    metricsAvailable={false}
                    networkId={networkId}
                    networkName={networkName}
                    objectType={graphObjects.selected}
                    objectTypeColors={Object.fromEntries(
                      graphObjects.items.map((item) => [item.id, item.color]),
                    )}
                    onAuthorizeAction={setAuthorizingRecord}
                    onAuthorizeObject={(objectType) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/object-types/${objectType.id}/authorization`,
                        {
                          state: {
                            knowledgeNetworkReturnTo: graphReturnTo({
                              id: objectType.id,
                              kind: "object",
                            }),
                          },
                        },
                      );
                    }}
                    onDeleteAction={(action) => confirmDelete([action])}
                    onDeleteObject={() => undefined}
                    onEditAction={(action) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/action-types/${action.id}/edit`,
                        {
                          state: {
                            knowledgeNetworkReturnTo: graphReturnTo({
                              id: action.id,
                              kind: "action",
                            }),
                          },
                        },
                      );
                    }}
                    onEditObject={(objectTypeId) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/edit`,
                        {
                          state: {
                            knowledgeNetworkReturnTo: graphReturnTo({
                              id: objectTypeId,
                              kind: "object",
                            }),
                          },
                        },
                      );
                    }}
                    onExecuteAction={(action) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/action-types/${action.id}/execution`,
                        {
                          state: {
                            knowledgeNetworkReturnTo: graphReturnTo({
                              id: action.id,
                              kind: "action",
                            }),
                          },
                        },
                      );
                    }}
                    onOpenAction={(action) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/action-types/${action.id}/detail`,
                        {
                          state: {
                            knowledgeNetworkReturnTo: graphReturnTo({
                              id: action.id,
                              kind: "action",
                            }),
                          },
                        },
                      );
                    }}
                    onOpenObject={(objectTypeId) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/detail`,
                        {
                          state: {
                            knowledgeNetworkReturnTo: graphReturnTo({
                              id: objectTypeId,
                              kind: "object",
                            }),
                          },
                        },
                      );
                    }}
                    onOpenMetric={() => undefined}
                    onOpenRelation={(relation) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/relation-types/${relation.id}/detail`,
                        {
                          state: {
                            knowledgeNetworkReturnTo: graphReturnTo({
                              id: relation.id,
                              kind: "relation",
                            }),
                          },
                        },
                      );
                    }}
                    onSelectedResourceChange={handleGraphResourceSelection}
                    onSelectObject={(objectTypeId) => {
                      const nextParams = new URLSearchParams(searchParams);
                      writeKnowledgeNetworkGraphSelection(nextParams);
                      nextParams.set("objectTypeId", objectTypeId);
                      setSearchParams(nextParams, { replace: true });
                      setSelectedGraphObjectTypeId(objectTypeId);
                      setSelectedGraphActionType(null);
                    }}
                    onTrialMetric={() => undefined}
                    permissionRequestsEnabled={permissionRequestsEnabled}
                    refreshVersion={refreshVersion}
                    resourceScope="actions"
                  />
                ) : !graphObjects.loading &&
                  !graphObjects.selectedLoading &&
                  graphObjects.items.length > 0 ? (
                  <Empty description={t("knowledgeNetwork.emptyObjectTypes")} />
                ) : null}
              </Spin>
            </div>
          </div>
        )}

        {viewMode === "list" && totalCount > 0 ? (
          <div className={styles.paginationBar}>
            <TablePaginationBar
              current={page}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
              pageSize={pageSize}
              showSizeChanger
              showTotal={(total) => t("common.total", { total })}
              total={totalCount}
            />
          </div>
        ) : null}
      </section>

      <ActionTypeCreateEntryModal
        onCancel={() => setCreateEntryOpen(false)}
        onChoose={(operation) => {
          setCreateEntryOpen(false);
          void navigate(
            `/knowledge-network/workspace/${networkId}/action-types/create?operation=${operation}`,
            {
              state: {
                ...knowledgeNetworkReturnState(
                  operation === "object" || viewMode === "list"
                    ? currentReturnTo
                    : `${actionTypeListPath}?view=list&operation=${operation}`,
                ),
                ...(operation === "object" && viewMode === "graph" && selectedGraphObjectTypeId
                  ? { actionTypeInitialObjectTypeId: selectedGraphObjectTypeId }
                  : {}),
              },
            },
          );
        }}
        open={createEntryOpen}
      />
      <KnowledgeNetworkObjectAuthorizeDrawer
        networkId={networkId}
        objectType="action_type"
        onClose={() => setAuthorizingRecord(null)}
        open={Boolean(authorizingRecord)}
        record={authorizingRecord}
      />
    </>
  );
}

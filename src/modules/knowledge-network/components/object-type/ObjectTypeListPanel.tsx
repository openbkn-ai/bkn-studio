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
} from "@ant-design/icons";
import { Dropdown, Empty, Input, Segmented, Select, Spin, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { useCapability, useEntitlement } from "@/framework/entitlement/use-entitlement";
import { getRuntimeConfig } from "@/framework/runtime/config";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import { ObjectTypeResourceGraph } from "@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph";
import { formatKnowledgeNetworkObjectTypeIndexStateLabel } from "@/modules/knowledge-network/utils/resource-index-state";
import { useKnowledgeNetworkCanOperate } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import { ResourceTagList } from "@/modules/knowledge-network/components/shared/ResourceTagList";
import { ResourcePermissionRequestAction } from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import {
  canRequestResourcePermission,
  canPreviewObjectTypePolicyScope,
  getMissingResourcePermissionOperations,
  hasRequestableObjectTypePolicyScope,
} from "@/modules/knowledge-network/components/shared/resource-permission-request";
import { getPermissionRequestProposalPreview } from "@/modules/account/services/permission-requests.service";
import {
  readPositiveInteger,
  readStoredPageSize,
  writeStoredPageSize,
} from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypePage,
} from "@/modules/knowledge-network/services/object-type.service";
import {
  queryObjectMetricDataV1,
  queryObjectMetricDrillThroughV1,
  trialObjectMetricDataV1,
  trialObjectMetricDrillThroughV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";
import graphStyles from "./ObjectTypeListPanel.module.css";

type ObjectTypeListPanelProps = {
  canDelete: boolean;
  canModify: boolean;
  networkId: string;
  networkName: string;
  onDelete: (records: KnowledgeNetworkObjectTypeRecord[]) => Promise<void>;
};

function readSortBy(value: string | null): "name" | "updateTime" {
  return value === "name" ? "name" : "updateTime";
}

function readSortDirection(value: string | null): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

const PAGE_SIZE_STORAGE_SCOPE = "object-types";

export function ObjectTypeListPanel({
  canDelete,
  canModify,
  networkId,
  networkName,
  onDelete,
}: ObjectTypeListPanelProps) {
  const entitlement = useEntitlement();
  const policyScopeCapability = useCapability(CAPABILITIES.PERM_OBJECT_LEVEL);
  const objectMetricsAvailable = useCapability(CAPABILITIES.OBJECT_METRICS) === "available";
  const permissionRequestsEnabled = !isCommunityBuild(entitlement);
  const policyScopePreviewsEnabled =
    canPreviewObjectTypePolicyScope(policyScopeCapability) &&
    !getRuntimeConfig().currentUser.isSuperAdmin;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { modal } = useAppServices();
  const canAuthorizeChildren = useKnowledgeNetworkCanOperate(networkId, "authorize");
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [selectedTag, setSelectedTag] = useState(() => searchParams.get("tag") ?? "all");
  const [sortBy, setSortBy] = useState<"name" | "updateTime">(() =>
    readSortBy(searchParams.get("sort")),
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(() =>
    readSortDirection(searchParams.get("order")),
  );
  const [page, setPage] = useState(() => readPositiveInteger(searchParams.get("page"), 1));
  const [pageSize, setPageSize] = useState(() =>
    searchParams.has("pageSize")
      ? readPositiveInteger(searchParams.get("pageSize"), 10)
      : readStoredPageSize(PAGE_SIZE_STORAGE_SCOPE, 10),
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"graph" | "list">(() =>
    searchParams.get("view") === "list" ? "list" : "graph",
  );
  const [selectedGraphObjectTypeId, setSelectedGraphObjectTypeId] = useState(
    () => searchParams.get("objectTypeId") ?? "",
  );
  const [selectedGraphObjectType, setSelectedGraphObjectType] =
    useState<KnowledgeNetworkObjectTypeRecord | null>(null);
  const [selectedGraphObjectLoading, setSelectedGraphObjectLoading] = useState(false);
  const [items, setItems] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [policyRequestableIDs, setPolicyRequestableIDs] = useState<Set<string>>(() => new Set());
  const policyRequestabilityCache = useRef(new Map<string, boolean>());
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
  const [trialMetric, setTrialMetric] = useState<ObjectMetricRecordV1>();
  const [trialObjectType, setTrialObjectType] = useState<ObjectTypeDetail | null | undefined>();
  const trialRequestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void listKnowledgeNetworkObjectTypePage(networkId, {
      direction: sortDirection,
      limit: pageSize,
      namePattern: debouncedKeyword,
      offset: (page - 1) * pageSize,
      sort: sortBy === "name" ? "name" : "update_time",
      tag: selectedTag === "all" ? undefined : selectedTag,
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
    debouncedKeyword,
    networkId,
    page,
    pageSize,
    refreshVersion,
    selectedTag,
    sortBy,
    sortDirection,
  ]);
  useEffect(() => {
    policyRequestabilityCache.current.clear();
  }, [networkId, refreshVersion]);
  useEffect(() => {
    if (!policyScopePreviewsEnabled) {
      setPolicyRequestableIDs(new Set());
      return;
    }
    let cancelled = false;
    const availableRecords =
      selectedGraphObjectType && !items.some((record) => record.id === selectedGraphObjectType.id)
        ? [...items, selectedGraphObjectType]
        : items;
    const candidates = availableRecords.filter(
      (record) =>
        getMissingResourcePermissionOperations("object_type", record.operations).length === 0,
    );
    const resolved = new Set(
      candidates
        .filter((record) => policyRequestabilityCache.current.get(`${networkId}/${record.id}`))
        .map((record) => record.id),
    );
    setPolicyRequestableIDs(resolved);

    const unresolved = candidates.filter(
      (record) => !policyRequestabilityCache.current.has(`${networkId}/${record.id}`),
    );
    if (!unresolved.length) return;

    void Promise.all(
      unresolved.map(async (record) => {
        const resourceID = `${networkId}/${record.id}`;
        try {
          const preview = await getPermissionRequestProposalPreview(resourceID);
          return [record.id, hasRequestableObjectTypePolicyScope(preview)] as const;
        } catch {
          return [record.id, false] as const;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      for (const [id, requestable] of results) {
        policyRequestabilityCache.current.set(`${networkId}/${id}`, requestable);
      }
      setPolicyRequestableIDs(
        new Set([
          ...resolved,
          ...results.filter(([, requestable]) => requestable).map(([id]) => id),
        ]),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [items, networkId, policyScopePreviewsEnabled, refreshVersion, selectedGraphObjectType]);

  useEffect(() => {
    if (viewMode !== "graph" || isLoading) return;

    const selectedFromPage = items.find((item) => item.id === selectedGraphObjectTypeId);
    if (selectedFromPage) {
      setSelectedGraphObjectType(selectedFromPage);
      setSelectedGraphObjectLoading(false);
      return;
    }

    if (!selectedGraphObjectTypeId) {
      const first = items[0];
      setSelectedGraphObjectType(first ?? null);
      setSelectedGraphObjectTypeId(first?.id ?? "");
      setSelectedGraphObjectLoading(false);
      return;
    }

    if (selectedGraphObjectType?.id === selectedGraphObjectTypeId) return;

    let cancelled = false;
    setSelectedGraphObjectLoading(true);
    void getKnowledgeNetworkObjectTypeDetail(networkId, selectedGraphObjectTypeId)
      .then((result) => {
        if (!cancelled) setSelectedGraphObjectType(result);
      })
      .catch(() => {
        if (!cancelled) setSelectedGraphObjectType(null);
      })
      .finally(() => {
        if (!cancelled) setSelectedGraphObjectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, items, networkId, selectedGraphObjectType, selectedGraphObjectTypeId, viewMode]);

  useEffect(() => {
    const nextKeyword = searchParams.get("q") ?? "";
    const nextTag = searchParams.get("tag") ?? "all";
    const nextSortBy = readSortBy(searchParams.get("sort"));
    const nextSortDirection = readSortDirection(searchParams.get("order"));
    const nextPage = readPositiveInteger(searchParams.get("page"), 1);
    const nextPageSize = searchParams.has("pageSize")
      ? readPositiveInteger(searchParams.get("pageSize"), 10)
      : readStoredPageSize(PAGE_SIZE_STORAGE_SCOPE, 10);
    const nextViewMode = searchParams.get("view") === "list" ? "list" : "graph";
    const nextGraphObjectTypeId = searchParams.get("objectTypeId") ?? "";

    setKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setSelectedTag((current) => (current === nextTag ? current : nextTag));
    setSortBy((current) => (current === nextSortBy ? current : nextSortBy));
    setSortDirection((current) => (current === nextSortDirection ? current : nextSortDirection));
    setPage((current) => (current === nextPage ? current : nextPage));
    setPageSize((current) => (current === nextPageSize ? current : nextPageSize));
    setViewMode((current) => (current === nextViewMode ? current : nextViewMode));
    setSelectedGraphObjectTypeId((current) =>
      current === nextGraphObjectTypeId ? current : nextGraphObjectTypeId,
    );
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    writeStoredPageSize(PAGE_SIZE_STORAGE_SCOPE, pageSize);

    if (keyword.trim()) {
      nextParams.set("q", keyword.trim());
    } else {
      nextParams.delete("q");
    }

    if (selectedTag !== "all") {
      nextParams.set("tag", selectedTag);
    } else {
      nextParams.delete("tag");
    }

    if (sortBy !== "updateTime") {
      nextParams.set("sort", sortBy);
    } else {
      nextParams.delete("sort");
    }

    if (sortDirection !== "desc") {
      nextParams.set("order", sortDirection);
    } else {
      nextParams.delete("order");
    }

    if (page !== 1) {
      nextParams.set("page", String(page));
    } else {
      nextParams.delete("page");
    }

    if (pageSize !== 10) {
      nextParams.set("pageSize", String(pageSize));
    } else {
      nextParams.delete("pageSize");
    }

    if (viewMode === "graph") {
      nextParams.delete("view");
      if (selectedGraphObjectTypeId) {
        nextParams.set("objectTypeId", selectedGraphObjectTypeId);
      } else {
        nextParams.delete("objectTypeId");
      }
    } else {
      nextParams.set("view", "list");
      nextParams.delete("objectTypeId");
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    keyword,
    page,
    pageSize,
    searchParams,
    selectedGraphObjectTypeId,
    selectedTag,
    setSearchParams,
    sortBy,
    sortDirection,
    viewMode,
  ]);

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    items.forEach((item) => {
      item.tags.forEach((tag) => tags.add(tag));
    });
    if (selectedTag !== "all") {
      tags.add(selectedTag);
    }
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [items, selectedTag]);

  const hasActiveFilter = useMemo(
    () => Boolean(keyword.trim()) || selectedTag !== "all",
    [keyword, selectedTag],
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
      selectedGraphObjectType?.id !== selectedGraphObjectTypeId ||
      !hasKnowledgeNetworkRecordOperation(selectedGraphObjectType, "delete")
    ) {
      return [];
    }
    return [selectedGraphObjectType];
  }, [selectedGraphObjectType, selectedGraphObjectTypeId, selectedRows, viewMode]);

  const canRequestObjectPermissionFor = (record: KnowledgeNetworkObjectTypeRecord) =>
    canRequestResourcePermission("object_type", record.operations, permissionRequestsEnabled) &&
    (getMissingResourcePermissionOperations("object_type", record.operations).length > 0 ||
      policyRequestableIDs.has(record.id));

  const confirmDelete = (records: KnowledgeNetworkObjectTypeRecord[]) => {
    if (records.length === 0) {
      return;
    }

    void modal.confirm({
      title:
        records.length > 1
          ? t("knowledgeNetwork.objectTypeBatchDeleteTitle")
          : t("knowledgeNetwork.objectTypeDeleteTitle"),
      content:
        records.length > 1
          ? t("knowledgeNetwork.objectTypeBatchDeleteDescription", {
              count: records.length,
            })
          : t("knowledgeNetwork.objectTypeDeleteDescription", {
              name: records[0]?.name ?? "",
            }),
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        await onDelete(records);
        if (records.some((record) => record.id === selectedGraphObjectTypeId)) {
          setSelectedGraphObjectTypeId("");
          setSelectedGraphObjectType(null);
        }
        setSelectedRowKeys([]);
        setRefreshVersion((current) => current + 1);
      },
      width: 520,
    });
  };

  const handleOperate = (key: string, record: KnowledgeNetworkObjectTypeRecord) => {
    if (key === "view") {
      void navigate(`/knowledge-network/workspace/${networkId}/object-types/${record.id}/detail`);
      return;
    }

    if (key === "edit") {
      void navigate(`/knowledge-network/workspace/${networkId}/object-types/${record.id}/edit`);
      return;
    }

    if (key === "authorize") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/object-types/${record.id}/authorization`,
      );
      return;
    }

    if (key === "delete") {
      confirmDelete([record]);
    }
  };

  const columns: TableProps<KnowledgeNetworkObjectTypeRecord>["columns"] = [
    {
      dataIndex: "name",
      fixed: "left",
      key: "name",
      title: t("common.name"),
      width: 320,
      render: (value: string, record) => (
        <div
          className={styles.objectTitleBox}
          onClick={() => {
            void navigate(
              `/knowledge-network/workspace/${networkId}/object-types/${record.id}/detail`,
            );
          }}
          title={value}
        >
          <span
            className={styles.objectIconSquare}
            style={{ backgroundColor: record.color || "#1d4ed8" }}
          >
            {renderResourceIcon(record.icon)}
          </span>
          <span className={styles.objectName}>{value}</span>
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
          ...(canRequestObjectPermissionFor(record)
            ? [
                {
                  key: "request-permission",
                  label: (
                    <ResourcePermissionRequestAction
                      operations={record.operations}
                      resourceType="object_type"
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
      dataIndex: ["dataSource", "name"],
      key: "relatedResourceName",
      title: t("knowledgeNetwork.objectTypeRelatedResourceName"),
      width: 180,
      render: (_value, record) => {
        const resource = record.dataSource;
        return resource ? (
          <button
            className={styles.tableLink}
            onClick={() => {
              void navigate(`/data-catalog/resource/${resource.id}`);
            }}
            title={resource.name || resource.id}
            type="button"
          >
            {resource.name || resource.id}
          </button>
        ) : (
          "--"
        );
      },
    },
    {
      key: "resourceIndexState",
      title: t("knowledgeNetwork.objectTypeResourceIndexState"),
      width: 180,
      render: (_value, record) => {
        const resourceId = record.dataSource?.id;
        if (!resourceId) {
          return "--";
        }

        const label = formatKnowledgeNetworkObjectTypeIndexStateLabel(
          record.indexStatus ?? record.hasIndex,
          t,
        );

        return (
          <button
            className={styles.tableLink}
            onClick={() => {
              void navigate(`/data-catalog/resource/${resourceId}?tab=index`);
            }}
            type="button"
          >
            {label}
          </button>
        );
      },
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      width: 180,
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

  const renderEmptyContent = () => {
    if (hasActiveFilter) {
      return (
        <Empty
          className={styles.emptyPanel}
          description={t("knowledgeNetwork.objectTypeEmptyNoSearchResult")}
        />
      );
    }

    if (!canModify) {
      return (
        <Empty className={styles.emptyPanel} description={t("knowledgeNetwork.emptyObjectTypes")} />
      );
    }

    return (
      <Empty
        className={styles.emptyPanel}
        description={
          <span>
            {t("knowledgeNetwork.emptyCreateHint")}
            <AppButton
              onClick={() => {
                void navigate(`/knowledge-network/workspace/${networkId}/object-types/create`);
              }}
              type="link"
            >
              {t("knowledgeNetwork.emptyCreateAction")}
            </AppButton>
            {t("knowledgeNetwork.emptyCreateSuffix")}
          </span>
        }
      />
    );
  };

  const tableEmptyText = isLoading ? (
    <div className={styles.loadingEmptyState} />
  ) : (
    renderEmptyContent()
  );
  const graphReturnParams = new URLSearchParams(searchParams);
  graphReturnParams.set("view", "graph");
  if (selectedGraphObjectTypeId) {
    graphReturnParams.set("objectTypeId", selectedGraphObjectTypeId);
  }
  const graphReturnTo = `/knowledge-network/workspace/${networkId}/object-types?${graphReturnParams.toString()}`;

  const openMetricTrial = async (record: ObjectMetricRecordV1) => {
    const request = ++trialRequestRef.current;
    setTrialObjectType(undefined);
    try {
      const detail = await getKnowledgeNetworkObjectTypeDetail(
        networkId,
        record.definition.owner_object_type_id,
      );
      if (request !== trialRequestRef.current) return;
      setTrialObjectType(detail ?? null);
    } catch {
      if (request !== trialRequestRef.current) return;
      setTrialObjectType(null);
    } finally {
      if (request === trialRequestRef.current) setTrialMetric(record);
    }
  };

  return (
    <>
      <section
        className={`${styles.page} ${styles.objectTypePage} ${graphStyles.panelPage} ${
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
          <div className={graphStyles.operationRow}>
            <div className={styles.toolbarLeft}>
              {canModify ? (
                <AppButton
                  className={styles.toolbarButton}
                  icon={<PlusOutlined />}
                  onClick={() => {
                    void navigate(`/knowledge-network/workspace/${networkId}/object-types/create`);
                  }}
                  type="primary"
                >
                  {t("common.create")}
                </AppButton>
              ) : null}
              {canDelete ? (
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
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>{t("common.tag")}</span>
                <Select
                  allowClear
                  className={styles.filterSelect}
                  mode="tags"
                  onChange={(values: string[]) => {
                    setSelectedTag(values.at(-1)?.trim() || "all");
                    setPage(1);
                  }}
                  options={tagOptions.map((tag) => ({ label: tag, value: tag }))}
                  placeholder={t("common.all")}
                  value={selectedTag === "all" ? [] : [selectedTag]}
                />
              </div>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "updateTime",
                      label: t("knowledgeNetwork.sortByUpdateTime"),
                    },
                    {
                      key: "name",
                      label: t("knowledgeNetwork.sortByName"),
                    },
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
                onClick={() => {
                  setRefreshVersion((current) => current + 1);
                }}
                type="button"
              >
                <ReloadOutlined />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className={styles.tableCard}>
            <Table<KnowledgeNetworkObjectTypeRecord>
              columns={columns}
              dataSource={items}
              loading={isLoading}
              locale={{ emptyText: tableEmptyText }}
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
              scroll={{ x: 1180 }}
              size="middle"
            />
          </div>
        ) : (
          <div className={graphStyles.graphLayout}>
            <aside className={graphStyles.objectSidebar}>
              <div className={graphStyles.objectSidebarHeader}>
                <strong>{t("knowledgeNetwork.objectTypes")}</strong>
                <span>{totalCount}</span>
              </div>
              <div className={graphStyles.objectListArea}>
                <Spin spinning={isLoading}>
                  <div className={graphStyles.objectList}>
                    {items.map((item) => (
                      <button
                        className={`${graphStyles.objectButton} ${item.id === selectedGraphObjectTypeId ? graphStyles.objectButtonSelected : ""}`}
                        key={item.id}
                        onClick={() => {
                          setSelectedGraphObjectTypeId(item.id);
                          setSelectedGraphObjectType(item);
                        }}
                        type="button"
                      >
                        <span
                          className={styles.objectIconSquare}
                          style={{ backgroundColor: item.color || "#1d4ed8" }}
                        >
                          {renderResourceIcon(item.icon)}
                        </span>
                        <span>{item.name}</span>
                      </button>
                    ))}
                    {!isLoading && items.length === 0 ? renderEmptyContent() : null}
                  </div>
                </Spin>
              </div>
              {totalCount > pageSize ? (
                <div className={graphStyles.objectPagination}>
                  <TablePaginationBar
                    current={page}
                    onChange={(nextPage, nextPageSize) => {
                      setPage(nextPage);
                      setPageSize(nextPageSize);
                    }}
                    pageSize={pageSize}
                    showSizeChanger={false}
                    total={totalCount}
                  />
                </div>
              ) : null}
            </aside>
            <div className={graphStyles.graphContent}>
              <Spin spinning={selectedGraphObjectLoading}>
                {selectedGraphObjectType?.id === selectedGraphObjectTypeId ? (
                  <ObjectTypeResourceGraph
                    canAuthorizeObject={canAuthorizeChildren}
                    canModify={canModify}
                    canRequestObjectPermission={canRequestObjectPermissionFor(
                      selectedGraphObjectType,
                    )}
                    key={selectedGraphObjectType.id}
                    metricsAvailable={objectMetricsAvailable}
                    networkId={networkId}
                    networkName={networkName}
                    objectType={selectedGraphObjectType}
                    objectTypeColors={Object.fromEntries(
                      items.map((item) => [item.id, item.color]),
                    )}
                    onEditObject={(nextObjectTypeId) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/object-types/${nextObjectTypeId}/edit`,
                        { state: { knowledgeNetworkReturnTo: graphReturnTo } },
                      );
                    }}
                    onAuthorizeObject={(nextObjectType) => {
                      handleOperate("authorize", nextObjectType);
                    }}
                    onDeleteObject={(nextObjectType) => {
                      handleOperate("delete", nextObjectType);
                    }}
                    onExecuteAction={(action) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/action-types/${action.id}/execution`,
                        { state: { knowledgeNetworkReturnTo: graphReturnTo } },
                      );
                    }}
                    onOpenAction={(action) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/action-types/${action.id}/detail`,
                        { state: { knowledgeNetworkReturnTo: graphReturnTo } },
                      );
                    }}
                    onOpenMetric={(metric) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/metrics/${metric.definition.id}/detail?version=${metric.definition.version}`,
                        { state: { knowledgeNetworkReturnTo: graphReturnTo } },
                      );
                    }}
                    onOpenObject={(nextObjectTypeId) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/object-types/${nextObjectTypeId}/detail`,
                        { state: { knowledgeNetworkReturnTo: graphReturnTo } },
                      );
                    }}
                    onOpenRelation={(relation) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/relation-types/${relation.id}/detail`,
                        { state: { knowledgeNetworkReturnTo: graphReturnTo } },
                      );
                    }}
                    onSelectObject={(nextObjectTypeId) => {
                      setSelectedGraphObjectTypeId(nextObjectTypeId);
                    }}
                    onTrialMetric={(metric) => void openMetricTrial(metric)}
                    refreshVersion={refreshVersion}
                  />
                ) : !isLoading && !selectedGraphObjectLoading ? (
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
      {trialMetric ? (
        <ObjectMetricTrialDrawer
          definition={trialMetric.definition}
          key={`${trialMetric.definition.id}@${trialMetric.definition.version}`}
          mode={
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? "published"
              : "draft"
          }
          networkId={networkId}
          objectType={trialObjectType}
          onClose={() => {
            trialRequestRef.current += 1;
            setTrialMetric(undefined);
            setTrialObjectType(undefined);
          }}
          onRun={(query) =>
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? queryObjectMetricDataV1(
                  networkId,
                  trialMetric.definition.id,
                  trialMetric.definition.version,
                  query,
                )
              : trialObjectMetricDataV1(networkId, trialMetric.definition, query)
          }
          onDrillThrough={(query, bucketKey, cursor) =>
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? queryObjectMetricDrillThroughV1(
                  networkId,
                  trialMetric.definition.id,
                  trialMetric.definition.version,
                  query,
                  bucketKey,
                  cursor,
                )
              : trialObjectMetricDrillThroughV1(
                  networkId,
                  trialMetric.definition,
                  query,
                  bucketKey,
                  cursor,
                )
          }
          open
        />
      ) : null}
    </>
  );
}

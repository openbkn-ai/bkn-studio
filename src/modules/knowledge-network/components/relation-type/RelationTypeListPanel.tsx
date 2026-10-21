/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";
import { Dropdown, Empty, Input, Segmented, Spin, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import {
  ObjectTypeResourceGraph,
  type ObjectTypeGraphSelectedResource,
} from "@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph";
import { ResourceTagList } from "@/modules/knowledge-network/components/shared/ResourceTagList";
import { ResourcePermissionRequestAction } from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import { canRequestResourcePermission } from "@/modules/knowledge-network/components/shared/resource-permission-request";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import { ObjectTypeGraphSidebar } from "@/modules/knowledge-network/components/shared/ObjectTypeGraphSidebar";
import {
  readPositiveInteger,
  readStoredPageSize,
  writeStoredPageSize,
} from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import { useObjectTypeGraphExplorer } from "@/modules/knowledge-network/components/shared/useObjectTypeGraphExplorer";
import { useKnowledgeNetworkCanOperate } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import {
  readKnowledgeNetworkGraphSelection,
  writeKnowledgeNetworkGraphSelection,
  type KnowledgeNetworkGraphSelection,
} from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { ObjectTypeRemoteFilter } from "@/modules/knowledge-network/components/shared/ObjectTypeRemoteFilter";
import { listKnowledgeNetworkRelationTypePage } from "@/modules/knowledge-network/services/relation-type.service";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";
import graphStyles from "@/modules/knowledge-network/components/shared/ResourceGraphExplorer.module.css";

export { ObjectTypeRemoteFilter as RelationObjectTypeFilter } from "@/modules/knowledge-network/components/shared/ObjectTypeRemoteFilter";

type RelationTypeListPanelProps = {
  canDelete: boolean;
  canModify: boolean;
  networkId: string;
  networkName: string;
  onDelete: (records: KnowledgeNetworkRelationTypeRecord[]) => Promise<void>;
};

function readSortBy(value: string | null): "name" | "updateTime" {
  return value === "name" ? "name" : "updateTime";
}

function readSortDirection(value: string | null): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

const PAGE_SIZE_STORAGE_SCOPE = "relation-types";

export function RelationTypeListPanel({
  canDelete,
  canModify,
  networkId,
  networkName,
  onDelete,
}: RelationTypeListPanelProps) {
  const permissionRequestsEnabled = !isCommunityBuild(useEntitlement());
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { modal } = useAppServices();
  const canAuthorizeChildren = useKnowledgeNetworkCanOperate(networkId, "authorize");
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [sourceFilter, setSourceFilter] = useState(() => searchParams.get("source") ?? "all");
  const [targetFilter, setTargetFilter] = useState(() => searchParams.get("target") ?? "all");
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
  const [selectedGraphRelationType, setSelectedGraphRelationType] =
    useState<KnowledgeNetworkRelationTypeRecord | null>(null);
  const [authorizingRecord, setAuthorizingRecord] =
    useState<KnowledgeNetworkRelationTypeRecord | null>(null);

  const [items, setItems] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
  const graphObjects = useObjectTypeGraphExplorer({
    direction: sortDirection,
    enabled: viewMode === "graph",
    keyword: debouncedKeyword,
    networkId,
    refreshVersion,
    resourceScope: "relations",
    selectedId: selectedGraphObjectTypeId,
    setSelectedId: setSelectedGraphObjectTypeId,
    sort: sortBy === "name" ? "name" : "update_time",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (viewMode !== "list") {
      setIsLoading(false);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    void listKnowledgeNetworkRelationTypePage(networkId, {
      direction: sortDirection,
      limit: pageSize,
      namePattern: debouncedKeyword,
      offset: (page - 1) * pageSize,
      sort: sortBy === "name" ? "name" : "update_time",
      sourceObjectTypeId: sourceFilter === "all" ? undefined : sourceFilter,
      targetObjectTypeId: targetFilter === "all" ? undefined : targetFilter,
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
          setLoadError(true);
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
    sortBy,
    sortDirection,
    sourceFilter,
    targetFilter,
    viewMode,
  ]);

  useEffect(() => {
    const nextKeyword = searchParams.get("q") ?? "";
    const nextSource = searchParams.get("source") ?? "all";
    const nextTarget = searchParams.get("target") ?? "all";
    const nextSortBy = readSortBy(searchParams.get("sort"));
    const nextSortDirection = readSortDirection(searchParams.get("order"));
    const nextPage = readPositiveInteger(searchParams.get("page"), 1);
    const nextPageSize = searchParams.has("pageSize")
      ? readPositiveInteger(searchParams.get("pageSize"), 10)
      : readStoredPageSize(PAGE_SIZE_STORAGE_SCOPE, 10);
    const nextViewMode = searchParams.get("view") === "list" ? "list" : "graph";
    const nextObjectTypeId = searchParams.get("objectTypeId") ?? "";
    setKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setSourceFilter((current) => (current === nextSource ? current : nextSource));
    setTargetFilter((current) => (current === nextTarget ? current : nextTarget));
    setSortBy((current) => (current === nextSortBy ? current : nextSortBy));
    setSortDirection((current) => (current === nextSortDirection ? current : nextSortDirection));
    setPage((current) => (current === nextPage ? current : nextPage));
    setPageSize((current) => (current === nextPageSize ? current : nextPageSize));
    setViewMode((current) => (current === nextViewMode ? current : nextViewMode));
    setSelectedGraphObjectTypeId((current) =>
      current === nextObjectTypeId ? current : nextObjectTypeId,
    );
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    writeStoredPageSize(PAGE_SIZE_STORAGE_SCOPE, pageSize);
    const setOrDelete = (key: string, value: string, fallback: string) => {
      if (value !== fallback) nextParams.set(key, value);
      else nextParams.delete(key);
    };
    setOrDelete("q", keyword.trim(), "");
    setOrDelete("source", sourceFilter, "all");
    setOrDelete("target", targetFilter, "all");
    setOrDelete("sort", sortBy, "updateTime");
    setOrDelete("order", sortDirection, "desc");
    setOrDelete("page", String(page), "1");
    setOrDelete("pageSize", String(pageSize), "10");
    if (viewMode === "graph") {
      nextParams.delete("view");
      nextParams.delete("relationTypeId");
      if (selectedGraphObjectTypeId) {
        nextParams.set("objectTypeId", selectedGraphObjectTypeId);
      } else {
        nextParams.delete("objectTypeId");
      }
    } else {
      nextParams.set("view", "list");
      nextParams.delete("objectTypeId");
      nextParams.delete("relationTypeId");
      writeKnowledgeNetworkGraphSelection(nextParams);
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
    setSearchParams,
    sortBy,
    sortDirection,
    sourceFilter,
    targetFilter,
    viewMode,
  ]);

  const hasActiveFilter = useMemo(
    () => Boolean(keyword.trim()) || sourceFilter !== "all" || targetFilter !== "all",
    [keyword, sourceFilter, targetFilter],
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
      !selectedGraphRelationType ||
      !hasKnowledgeNetworkRecordOperation(selectedGraphRelationType, "delete")
    ) {
      return [];
    }
    return [selectedGraphRelationType];
  }, [selectedGraphRelationType, selectedRows, viewMode]);

  const confirmDelete = (records: KnowledgeNetworkRelationTypeRecord[]) => {
    if (records.length === 0) {
      return;
    }

    void modal.confirm({
      title:
        records.length > 1
          ? t("knowledgeNetwork.relationTypeBatchDeleteTitle")
          : t("knowledgeNetwork.relationTypeDeleteTitle"),
      content:
        records.length > 1
          ? t("knowledgeNetwork.relationTypeBatchDeleteDescription", {
              count: records.length,
            })
          : t("knowledgeNetwork.relationTypeDeleteDescription", {
              name: records[0]?.name ?? "",
            }),
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        await onDelete(records);
        if (records.some((record) => record.id === selectedGraphRelationType?.id)) {
          setSelectedGraphRelationType(null);
        }
        setSelectedRowKeys([]);
        setRefreshVersion((current) => current + 1);
      },
      width: 520,
    });
  };

  const handleOperate = (key: string, record: KnowledgeNetworkRelationTypeRecord) => {
    if (key === "view") {
      void navigate(`/knowledge-network/workspace/${networkId}/relation-types/${record.id}/detail`);
      return;
    }

    if (key === "edit") {
      void navigate(`/knowledge-network/workspace/${networkId}/relation-types/${record.id}/edit`);
      return;
    }

    if (key === "mapping") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/relation-types/${record.id}/mapping`,
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

  const relationTypeListPath = `/knowledge-network/workspace/${networkId}/relation-types`;

  const renderObjectTypeLink = (objectTypeId: string, objectTypeName: string) => {
    const label = objectTypeName || "--";

    if (!objectTypeId) {
      return label;
    }

    return (
      <button
        className={styles.tableLink}
        onClick={() => {
          void navigate(
            `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/detail`,
            {
              state: {
                knowledgeNetworkReturnTo: relationTypeListPath,
              },
            },
          );
        }}
        title={label}
        type="button"
      >
        {label}
      </button>
    );
  };

  const columns: TableProps<KnowledgeNetworkRelationTypeRecord>["columns"] = [
    {
      dataIndex: "name",
      fixed: "left",
      key: "name",
      title: t("common.name"),
      width: 220,
      render: (value: string, record) => (
        <div
          className={styles.objectTitleBox}
          onClick={() => {
            void navigate(
              `/knowledge-network/workspace/${networkId}/relation-types/${record.id}/detail`,
            );
          }}
          title={value}
        >
          <span className={styles.objectIconSquare} style={{ backgroundColor: "#5381DF" }}>
            <ApartmentOutlined />
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
          ...(canRequestResourcePermission(
            "relation_type",
            record.operations,
            permissionRequestsEnabled,
          )
            ? [
                {
                  key: "request-permission",
                  label: (
                    <ResourcePermissionRequestAction
                      operations={record.operations}
                      resourceType="relation_type"
                      resourceID={`${networkId}/${record.id}`}
                      resourceName={`${networkName} / ${record.name}`}
                    />
                  ),
                },
              ]
            : []),
          ...(hasKnowledgeNetworkRecordOperation(record, "modify")
            ? [
                { key: "edit", label: t("common.edit") },
                { key: "mapping", label: t("knowledgeNetwork.relationTypeMappingEntry") },
              ]
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
      dataIndex: "sourceObjectTypeName",
      key: "sourceObjectTypeName",
      title: t("knowledgeNetwork.relationTypeListSourceObject"),
      width: 180,
      render: (value: string, record) => renderObjectTypeLink(record.sourceObjectTypeId, value),
    },
    {
      dataIndex: "targetObjectTypeName",
      key: "targetObjectTypeName",
      title: t("knowledgeNetwork.relationTypeListTargetObject"),
      width: 180,
      render: (value: string, record) => renderObjectTypeLink(record.targetObjectTypeId, value),
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
      dataIndex: "mappingMode",
      key: "mappingMode",
      title: t("knowledgeNetwork.relationTypeMappingMode"),
      width: 120,
      render: (value: KnowledgeNetworkRelationTypeRecord["mappingMode"]) =>
        value === "direct"
          ? t("knowledgeNetwork.relationTypeDirectMapping")
          : t("knowledgeNetwork.relationTypeResourceMapping"),
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
          description={t("knowledgeNetwork.relationTypeEmptyNoSearchResult")}
        />
      );
    }

    if (!canModify) {
      return (
        <Empty
          className={styles.emptyPanel}
          description={t("knowledgeNetwork.emptyRelationTypes")}
        />
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
                void navigate(`/knowledge-network/workspace/${networkId}/relation-types/create`);
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
  ) : loadError ? (
    <Empty
      className={styles.emptyPanel}
      description={t("knowledgeNetwork.relationTypeListLoadFailed")}
    >
      <AppButton onClick={() => setRefreshVersion((current) => current + 1)}>
        {t("common.retry")}
      </AppButton>
    </Empty>
  ) : (
    renderEmptyContent()
  );
  const selectGraphObject = (record: KnowledgeNetworkObjectTypeRecord) => {
    const nextParams = new URLSearchParams(searchParams);
    writeKnowledgeNetworkGraphSelection(nextParams);
    nextParams.set("objectTypeId", record.id);
    setSearchParams(nextParams, { replace: true });
    setSelectedGraphObjectTypeId(record.id);
    graphObjects.setSelected(record);
    setSelectedGraphRelationType(null);
  };
  const handleGraphResourceSelection = useCallback(
    (resource?: ObjectTypeGraphSelectedResource) => {
      setSelectedGraphRelationType(resource?.kind === "relation" ? resource.value : null);
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
    graphReturnParams.delete("relationTypeId");
    if (selectedGraphObjectTypeId) {
      graphReturnParams.set("objectTypeId", selectedGraphObjectTypeId);
    }
    writeKnowledgeNetworkGraphSelection(graphReturnParams, selection);
    return `/knowledge-network/workspace/${networkId}/relation-types?${graphReturnParams.toString()}`;
  };

  return (
    <>
      <section
        className={`${styles.page} ${styles.objectTypePage} ${styles.relationTypePage} ${graphStyles.panelPage} ${
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
              {canModify || canDelete ? (
                <>
                  {canModify ? (
                    <AppButton
                      className={styles.toolbarButton}
                      icon={<PlusOutlined />}
                      onClick={() => {
                        void navigate(
                          `/knowledge-network/workspace/${networkId}/relation-types/create`,
                        );
                      }}
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
                </>
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
                  <ObjectTypeRemoteFilter
                    label={t("knowledgeNetwork.relationTypeListSourceObject")}
                    networkId={networkId}
                    onChange={(value) => {
                      setSourceFilter(value);
                      setPage(1);
                    }}
                    value={sourceFilter}
                  />
                  <ObjectTypeRemoteFilter
                    label={t("knowledgeNetwork.relationTypeListTargetObject")}
                    networkId={networkId}
                    onChange={(value) => {
                      setTargetFilter(value);
                      setPage(1);
                    }}
                    value={targetFilter}
                  />
                </>
              ) : null}
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
            <Table<KnowledgeNetworkRelationTypeRecord>
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
              scroll={{ x: 1280 }}
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
              resourceCountLabel={t("knowledgeNetwork.objectTypeGraphRelations")}
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
                    allowDeleteRelation
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
                    onAuthorizeRelation={setAuthorizingRecord}
                    onDeleteObject={() => undefined}
                    onDeleteRelation={(relation) => confirmDelete([relation])}
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
                    onOpenMetric={() => undefined}
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
                    onOpenRelationMapping={(relation) => {
                      void navigate(
                        `/knowledge-network/workspace/${networkId}/relation-types/${relation.id}/mapping`,
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
                      setSelectedGraphRelationType(null);
                    }}
                    onTrialMetric={() => undefined}
                    permissionRequestsEnabled={permissionRequestsEnabled}
                    refreshVersion={refreshVersion}
                    resourceScope="relations"
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
      <KnowledgeNetworkObjectAuthorizeDrawer
        networkId={networkId}
        objectType="relation_type"
        onClose={() => setAuthorizingRecord(null)}
        open={Boolean(authorizingRecord)}
        record={authorizingRecord}
      />
    </>
  );
}

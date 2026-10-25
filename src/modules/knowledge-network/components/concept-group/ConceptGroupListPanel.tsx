/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";
import { Dropdown, Empty, Input, Segmented, Select, Spin, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ConceptGroupGraphPanel } from "@/modules/knowledge-network/components/concept-group/ConceptGroupGraphPanel";
import { ConceptGroupGraphSidebar } from "@/modules/knowledge-network/components/concept-group/ConceptGroupGraphSidebar";
import type { ObjectTypeGraphSelectedResource } from "@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { JsonResourceImportButton } from "@/modules/knowledge-network/components/shared/JsonResourceImportButton";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import { ResourceTagList } from "@/modules/knowledge-network/components/shared/ResourceTagList";
import { ResourcePermissionRequestAction } from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import { canRequestResourcePermission } from "@/modules/knowledge-network/components/shared/resource-permission-request";
import {
  readPositiveInteger,
  readStoredPageSize,
  writeStoredPageSize,
} from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import { useKnowledgeNetworkCanOperate } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import {
  knowledgeNetworkReturnState,
  readKnowledgeNetworkGraphSelection,
  writeKnowledgeNetworkGraphSelection,
} from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import { getKnowledgeNetworkConceptGroup } from "@/modules/knowledge-network/services/knowledge-network.service";
import { listKnowledgeNetworkConceptGroupPage } from "@/modules/knowledge-network/services/concept-group.service";
import type {
  ConceptGroupRecord,
  KnowledgeNetworkImportMode,
} from "@/modules/knowledge-network/types/knowledge-network";
import { downloadConceptGroupExport } from "@/modules/knowledge-network/utils/concept-group-export";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";
import graphStyles from "@/modules/knowledge-network/components/shared/ResourceGraphExplorer.module.css";

type ConceptGroupListPanelProps = {
  canDelete: boolean;
  canModify: boolean;
  networkId: string;
  networkName: string;
  onDelete: (records: ConceptGroupRecord[]) => Promise<void>;
  onImport: (
    payload: Record<string, unknown>,
    importMode?: KnowledgeNetworkImportMode,
  ) => Promise<void>;
};

function readSortBy(value: string | null): "name" | "updateTime" {
  return value === "name" ? "name" : "updateTime";
}

function readSortDirection(value: string | null): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

const PAGE_SIZE_STORAGE_SCOPE = "concept-groups";

export function ConceptGroupListPanel({
  canDelete,
  canModify,
  networkId,
  networkName,
  onDelete,
  onImport,
}: ConceptGroupListPanelProps) {
  const permissionRequestsEnabled = !isCommunityBuild(useEntitlement());
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message, modal } = useAppServices();
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
  const [selectedGraphGroupId, setSelectedGraphGroupId] = useState(
    () => searchParams.get("conceptGroupId") ?? "",
  );
  const [selectedGraphGroup, setSelectedGraphGroup] = useState<ConceptGroupRecord | null>(null);
  const [selectedGraphGroupLoading, setSelectedGraphGroupLoading] = useState(false);
  const [authorizingRecord, setAuthorizingRecord] = useState<ConceptGroupRecord | null>(null);
  const [items, setItems] = useState<ConceptGroupRecord[]>([]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void listKnowledgeNetworkConceptGroupPage(networkId, {
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
        setTagOptions(result.availableTags);
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
    if (viewMode !== "graph" || isLoading) return;

    const selectedFromPage = items.find((item) => item.id === selectedGraphGroupId);
    if (selectedFromPage) {
      setSelectedGraphGroup(selectedFromPage);
      setSelectedGraphGroupLoading(false);
      return;
    }

    if (!selectedGraphGroupId) {
      const first = items[0];
      setSelectedGraphGroup(first ?? null);
      setSelectedGraphGroupId(first?.id ?? "");
      setSelectedGraphGroupLoading(false);
      return;
    }

    if (selectedGraphGroup?.id === selectedGraphGroupId) return;

    let cancelled = false;
    setSelectedGraphGroupLoading(true);
    void getKnowledgeNetworkConceptGroup(networkId, selectedGraphGroupId)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setSelectedGraphGroup(result);
          return;
        }
        const first = items[0];
        setSelectedGraphGroup(first ?? null);
        setSelectedGraphGroupId(first?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        const first = items[0];
        setSelectedGraphGroup(first ?? null);
        setSelectedGraphGroupId(first?.id ?? "");
      })
      .finally(() => {
        if (!cancelled) setSelectedGraphGroupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, items, networkId, selectedGraphGroup, selectedGraphGroupId, viewMode]);

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
    const nextConceptGroupId = searchParams.get("conceptGroupId") ?? "";

    setKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setSelectedTag((current) => (current === nextTag ? current : nextTag));
    setSortBy((current) => (current === nextSortBy ? current : nextSortBy));
    setSortDirection((current) => (current === nextSortDirection ? current : nextSortDirection));
    setPage((current) => (current === nextPage ? current : nextPage));
    setPageSize((current) => (current === nextPageSize ? current : nextPageSize));
    setViewMode((current) => (current === nextViewMode ? current : nextViewMode));
    setSelectedGraphGroupId((current) =>
      current === nextConceptGroupId ? current : nextConceptGroupId,
    );
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    writeStoredPageSize(PAGE_SIZE_STORAGE_SCOPE, pageSize);
    if (keyword.trim()) nextParams.set("q", keyword.trim());
    else nextParams.delete("q");
    if (selectedTag !== "all") nextParams.set("tag", selectedTag);
    else nextParams.delete("tag");
    if (sortBy !== "updateTime") nextParams.set("sort", sortBy);
    else nextParams.delete("sort");
    if (sortDirection !== "desc") nextParams.set("order", sortDirection);
    else nextParams.delete("order");
    if (page !== 1) nextParams.set("page", String(page));
    else nextParams.delete("page");
    if (pageSize !== 10) nextParams.set("pageSize", String(pageSize));
    else nextParams.delete("pageSize");

    if (viewMode === "graph") {
      nextParams.delete("view");
      if (selectedGraphGroupId) nextParams.set("conceptGroupId", selectedGraphGroupId);
      else nextParams.delete("conceptGroupId");
    } else {
      nextParams.set("view", "list");
      nextParams.delete("conceptGroupId");
      nextParams.delete("focusObjectTypeId");
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
    selectedGraphGroupId,
    selectedTag,
    setSearchParams,
    sortBy,
    sortDirection,
    viewMode,
  ]);

  const restoredGraphSelection = readKnowledgeNetworkGraphSelection(searchParams);
  const focusedGraphObjectTypeId = searchParams.get("focusObjectTypeId");
  const selectedGraphObjectTypeId =
    !focusedGraphObjectTypeId && restoredGraphSelection?.kind === "object"
      ? restoredGraphSelection.id
      : null;
  const currentReturnTo = `/knowledge-network/workspace/${networkId}/concept-groups${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;
  const navigationState = knowledgeNetworkReturnState(currentReturnTo);

  const handleGraphObjectTypeSelection = useCallback(
    (id: string | null) => {
      const nextParams = new URLSearchParams(searchParams);
      writeKnowledgeNetworkGraphSelection(nextParams, id ? { id, kind: "object" } : undefined);
      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const handleFocusedObjectTypeChange = useCallback(
    (id: string | null) => {
      const nextParams = new URLSearchParams(searchParams);
      if (id) {
        nextParams.set("focusObjectTypeId", id);
        writeKnowledgeNetworkGraphSelection(nextParams);
      } else {
        nextParams.delete("focusObjectTypeId");
        writeKnowledgeNetworkGraphSelection(nextParams);
      }
      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const handleGraphResourceSelection = useCallback(
    (resource?: ObjectTypeGraphSelectedResource) => {
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
      selectedGraphGroup?.id !== selectedGraphGroupId ||
      !hasKnowledgeNetworkRecordOperation(selectedGraphGroup, "delete")
    ) {
      return [];
    }
    return [selectedGraphGroup];
  }, [selectedGraphGroup, selectedGraphGroupId, selectedRows, viewMode]);

  const confirmDelete = (records: ConceptGroupRecord[]) => {
    if (records.length === 0) {
      return;
    }

    void modal.confirm({
      title:
        records.length > 1
          ? t("knowledgeNetwork.conceptGroupBatchDeleteTitle")
          : t("knowledgeNetwork.conceptGroupDeleteTitle"),
      content:
        records.length > 1
          ? t("knowledgeNetwork.conceptGroupBatchDeleteDescription", {
              count: records.length,
            })
          : t("knowledgeNetwork.conceptGroupDeleteDescription", {
              name: records[0]?.name ?? "",
            }),
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        await onDelete(records);
        const deletedIds = new Set(records.map((record) => record.id));
        setItems((current) => current.filter((item) => !deletedIds.has(item.id)));
        if (deletedIds.has(selectedGraphGroupId)) {
          setSelectedGraphGroupId("");
          setSelectedGraphGroup(null);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("focusObjectTypeId");
          writeKnowledgeNetworkGraphSelection(nextParams);
          setSearchParams(nextParams, { replace: true });
        }
        setSelectedRowKeys([]);
        setRefreshVersion((current) => current + 1);
      },
      width: 520,
    });
  };

  const handleExport = async (record: ConceptGroupRecord) => {
    try {
      const detail = await getKnowledgeNetworkConceptGroup(networkId, record.id);
      if (!detail) {
        throw new Error(t("common.notFound"));
      }

      downloadConceptGroupExport(detail);
      void message.success(t("knowledgeNetwork.conceptGroupExportSuccess"));
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const handleOperate = (key: string, record: ConceptGroupRecord) => {
    if (key === "view") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/concept-groups/${record.id}/detail`,
        {
          state: navigationState,
        },
      );
      return;
    }

    if (key === "edit") {
      void navigate(`/knowledge-network/workspace/${networkId}/concept-groups/${record.id}/edit`, {
        state: navigationState,
      });
      return;
    }

    if (key === "export") {
      void handleExport(record);
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

  const columns: TableProps<ConceptGroupRecord>["columns"] = [
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
              `/knowledge-network/workspace/${networkId}/concept-groups/${record.id}/detail`,
              { state: navigationState },
            );
          }}
          title={value}
        >
          <span className={styles.objectIconSquare} style={{ color: record.color ?? "#1677ff" }}>
            <AppstoreOutlined />
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
            "concept_group",
            record.operations,
            permissionRequestsEnabled,
          )
            ? [
                {
                  key: "request-permission",
                  label: (
                    <ResourcePermissionRequestAction
                      operations={record.operations}
                      resourceType="concept_group"
                      resourceID={`${networkId}/${record.id}`}
                      resourceName={`${networkName} / ${record.name}`}
                    />
                  ),
                },
              ]
            : []),
          ...(hasKnowledgeNetworkRecordOperation(record, "query_data")
            ? [{ key: "export", label: t("knowledgeNetwork.conceptGroupExport") }]
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
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      width: 160,
      render: (value: string[] | undefined) =>
        value && value.length > 0 ? <ResourceTagList tags={value} /> : t("knowledgeNetwork.noTags"),
    },
    {
      dataIndex: "updaterName",
      key: "updaterName",
      title: t("knowledgeNetwork.modifier"),
      width: 140,
      render: (value?: string) => value || "--",
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
          description={t("knowledgeNetwork.conceptGroupEmptyNoSearchResult")}
        />
      );
    }

    if (!canModify) {
      return (
        <Empty
          className={styles.emptyPanel}
          description={t("knowledgeNetwork.emptyConceptGroups")}
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
                void navigate(`/knowledge-network/workspace/${networkId}/concept-groups/create`, {
                  state: navigationState,
                });
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

  return (
    <>
      <section
        className={`${styles.page} ${styles.objectTypePage} ${styles.conceptGroupPage} ${graphStyles.panelPage} ${
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
                  { label: t("knowledgeNetwork.conceptGroupGraphView"), value: "graph" },
                  { label: t("knowledgeNetwork.conceptGroupListView"), value: "list" },
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
                          `/knowledge-network/workspace/${networkId}/concept-groups/create`,
                          { state: navigationState },
                        );
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
                  {canModify ? (
                    <JsonResourceImportButton
                      className={styles.toolbarButton}
                      onImported={() => setRefreshVersion((current) => current + 1)}
                      onImport={onImport}
                    />
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
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>{t("common.tag")}</span>
                <Select
                  className={styles.filterSelect}
                  onChange={(value) => {
                    setSelectedTag(value);
                    setPage(1);
                  }}
                  options={[
                    { label: t("common.all"), value: "all" },
                    ...tagOptions.map((tag) => ({ label: tag, value: tag })),
                  ]}
                  value={selectedTag}
                />
              </div>
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
            <Table<ConceptGroupRecord>
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
              scroll={{ x: 920 }}
              size="middle"
            />
          </div>
        ) : (
          <div className={graphStyles.graphLayout}>
            <ConceptGroupGraphSidebar
              emptyContent={renderEmptyContent()}
              items={items}
              loading={isLoading}
              onPageChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
              onSelect={(record) => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set("conceptGroupId", record.id);
                nextParams.delete("focusObjectTypeId");
                writeKnowledgeNetworkGraphSelection(nextParams);
                setSearchParams(nextParams, { replace: true });
                setSelectedGraphGroupId(record.id);
                setSelectedGraphGroup(record);
              }}
              page={page}
              pageSize={pageSize}
              selectedId={selectedGraphGroupId}
              totalCount={totalCount}
            />
            <div className={graphStyles.graphContent}>
              <Spin spinning={selectedGraphGroupLoading}>
                {selectedGraphGroup?.id === selectedGraphGroupId ? (
                  <ConceptGroupGraphPanel
                    focusedObjectTypeId={focusedGraphObjectTypeId}
                    group={selectedGraphGroup}
                    initialSelectedResource={restoredGraphSelection}
                    key={selectedGraphGroup.id}
                    networkId={networkId}
                    networkName={networkName}
                    onFocusedObjectTypeIdChange={handleFocusedObjectTypeChange}
                    onSelectedResourceChange={handleGraphResourceSelection}
                    onSelectedObjectTypeIdChange={handleGraphObjectTypeSelection}
                    refreshVersion={refreshVersion}
                    selectedObjectTypeId={selectedGraphObjectTypeId}
                  />
                ) : !isLoading && !selectedGraphGroupLoading ? (
                  renderEmptyContent()
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
        objectType="concept_group"
        onClose={() => setAuthorizingRecord(null)}
        open={Boolean(authorizingRecord)}
        record={authorizingRecord}
      />
    </>
  );
}

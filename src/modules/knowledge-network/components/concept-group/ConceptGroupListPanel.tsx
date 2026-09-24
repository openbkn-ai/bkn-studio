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
import { Dropdown, Empty, Input, Select, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { JsonResourceImportButton } from "@/modules/knowledge-network/components/shared/JsonResourceImportButton";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import { ResourceTagList } from "@/modules/knowledge-network/components/shared/ResourceTagList";
import {
  canRequestResourcePermission,
  ResourcePermissionRequestAction,
} from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import { usePersistentPageSize } from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import { useKnowledgeNetworkCanOperate } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import { getKnowledgeNetworkConceptGroup } from "@/modules/knowledge-network/services/knowledge-network.service";
import { listKnowledgeNetworkConceptGroupPage } from "@/modules/knowledge-network/services/concept-group.service";
import type {
  ConceptGroupRecord,
  KnowledgeNetworkImportMode,
} from "@/modules/knowledge-network/types/knowledge-network";
import { downloadConceptGroupExport } from "@/modules/knowledge-network/utils/concept-group-export";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

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
  const { message, modal } = useAppServices();
  const canAuthorizeChildren = useKnowledgeNetworkCanOperate(networkId, "authorize");
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("concept-groups");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
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
      void navigate(`/knowledge-network/workspace/${networkId}/concept-groups/${record.id}/detail`);
      return;
    }

    if (key === "edit") {
      void navigate(`/knowledge-network/workspace/${networkId}/concept-groups/${record.id}/edit`);
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
                void navigate(`/knowledge-network/workspace/${networkId}/concept-groups/create`);
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
      <section className={`${styles.page} ${styles.objectTypePage} ${styles.conceptGroupPage}`}>
        <h2 className={styles.title}>{t("knowledgeNetwork.conceptGroupsTitle")}</h2>

        <div className={styles.toolbar}>
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
                    disabled={selectedRows.length === 0}
                    icon={<DeleteOutlined />}
                    onClick={() => confirmDelete(selectedRows)}
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

        {totalCount > 0 ? (
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

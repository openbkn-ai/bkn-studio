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
import { Dropdown, Empty, Input, Select, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import { ObjectTypeRemoteFilter } from "@/modules/knowledge-network/components/shared/ObjectTypeRemoteFilter";
import { ResourceTagList } from "@/modules/knowledge-network/components/shared/ResourceTagList";
import {
  canRequestResourcePermission,
  ResourcePermissionRequestAction,
} from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import { usePersistentPageSize } from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import { useKnowledgeNetworkCanOperate } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import { buildActionTypeKindSelectOptions } from "@/modules/knowledge-network/constants/action-type-kinds";
import type {
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { listKnowledgeNetworkActionTypePage } from "@/modules/knowledge-network/services/action-type.service";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type ActionTypeListPanelProps = {
  canDelete: boolean;
  canModify: boolean;
  networkId: string;
  networkName: string;
  onDelete: (records: KnowledgeNetworkActionTypeRecord[]) => Promise<void>;
};

function getActionKindLabel(
  actionKind: KnowledgeNetworkActionTypeKind,
  t: (key: string) => string,
) {
  switch (actionKind) {
    case "update":
      return t("knowledgeNetwork.actionTypeKindUpdate");
    case "delete":
      return t("knowledgeNetwork.actionTypeKindDelete");
    case "notify":
      return t("knowledgeNetwork.actionTypeKindNotify");
    case "create":
    default:
      return t("knowledgeNetwork.actionTypeKindCreate");
  }
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
  const { modal } = useAppServices();
  const canAuthorizeChildren = useKnowledgeNetworkCanOperate(networkId, "authorize");
  const [keyword, setKeyword] = useState("");
  const [actionKindFilter, setActionKindFilter] = useState<"all" | KnowledgeNetworkActionTypeKind>(
    "all",
  );
  const [objectTypeFilter, setObjectTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("action-types");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [authorizingRecord, setAuthorizingRecord] =
    useState<KnowledgeNetworkActionTypeRecord | null>(null);
  const [items, setItems] = useState<KnowledgeNetworkActionTypeRecord[]>([]);
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
    void listKnowledgeNetworkActionTypePage(networkId, {
      actionKind: actionKindFilter === "all" ? undefined : actionKindFilter,
      direction: sortDirection,
      limit: pageSize,
      namePattern: debouncedKeyword,
      objectTypeId: objectTypeFilter === "all" ? undefined : objectTypeFilter,
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
    networkId,
    objectTypeFilter,
    page,
    pageSize,
    refreshVersion,
    sortBy,
    sortDirection,
  ]);

  const hasActiveFilter = useMemo(
    () => Boolean(keyword.trim()) || actionKindFilter !== "all" || objectTypeFilter !== "all",
    [actionKindFilter, keyword, objectTypeFilter],
  );

  const selectedRows = useMemo(
    () =>
      items.filter(
        (item) =>
          selectedRowKeys.includes(item.id) && hasKnowledgeNetworkRecordOperation(item, "delete"),
      ),
    [items, selectedRowKeys],
  );

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
        setSelectedRowKeys([]);
        setRefreshVersion((current) => current + 1);
      },
      width: 520,
    });
  };

  const handleOperate = (key: string, record: KnowledgeNetworkActionTypeRecord) => {
    if (key === "view") {
      void navigate(`/knowledge-network/workspace/${networkId}/action-types/${record.id}/detail`);
      return;
    }

    if (key === "edit") {
      void navigate(`/knowledge-network/workspace/${networkId}/action-types/${record.id}/edit`);
      return;
    }

    if (key === "execution") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/action-types/${record.id}/execution`,
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

  const columns: TableProps<KnowledgeNetworkActionTypeRecord>["columns"] = [
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
      dataIndex: "actionKind",
      key: "actionKind",
      title: t("knowledgeNetwork.actionTypeKind"),
      width: 100,
      render: (value: KnowledgeNetworkActionTypeKind) => getActionKindLabel(value, t),
    },
    {
      dataIndex: "objectTypeName",
      key: "objectTypeName",
      title: t("knowledgeNetwork.actionTypeObject"),
      width: 180,
      render: (value: string) => value || "--",
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
            <AppButton
              onClick={() => {
                void navigate(`/knowledge-network/workspace/${networkId}/action-types/create`);
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
      <section className={`${styles.page} ${styles.objectTypePage} ${styles.actionTypePage}`}>
        <h2 className={styles.title}>{t("knowledgeNetwork.actionTypesTitle")}</h2>

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
                        `/knowledge-network/workspace/${networkId}/action-types/create`,
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
            <ObjectTypeRemoteFilter
              label={t("knowledgeNetwork.actionTypeObject")}
              networkId={networkId}
              onChange={(value) => {
                setObjectTypeFilter(value);
                setPage(1);
              }}
              value={objectTypeFilter}
            />
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>{t("knowledgeNetwork.actionTypeKind")}</span>
              <Select
                className={styles.filterSelect}
                onChange={(value) => {
                  setActionKindFilter(value);
                  setPage(1);
                }}
                options={[
                  { label: t("common.all"), value: "all" },
                  ...buildActionTypeKindSelectOptions(t),
                ]}
                value={actionKindFilter}
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
            scroll={{ x: 1180 }}
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
        objectType="action_type"
        onClose={() => setAuthorizingRecord(null)}
        open={Boolean(authorizingRecord)}
        record={authorizingRecord}
      />
    </>
  );
}

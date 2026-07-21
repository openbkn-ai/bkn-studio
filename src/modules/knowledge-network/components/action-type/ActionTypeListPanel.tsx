/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CloseOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Dropdown, Empty, Input, Select, Table, Tag } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { JsonResourceImportButton } from "@/modules/knowledge-network/components/shared/JsonResourceImportButton";
import { usePersistentPageSize } from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import { buildActionTypeKindSelectOptions } from "@/modules/knowledge-network/constants/action-type-kinds";
import type {
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkImportMode,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type ActionTypeListPanelProps = {
  items: KnowledgeNetworkActionTypeRecord[];
  loading?: boolean;
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onDelete: (records: KnowledgeNetworkActionTypeRecord[]) => Promise<void>;
  onImport: (
    payload: Record<string, unknown>,
    importMode?: KnowledgeNetworkImportMode,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
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
  items,
  loading,
  networkId,
  objectTypes,
  onDelete,
  onImport,
  onRefresh,
}: ActionTypeListPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { modal } = useAppServices();
  const [keyword, setKeyword] = useState("");
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [actionKindFilter, setActionKindFilter] = useState<"all" | KnowledgeNetworkActionTypeKind>(
    "all",
  );
  const [objectTypeFilter, setObjectTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("action-types");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const objectTypeOptions = useMemo(
    () =>
      objectTypes.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [objectTypes],
  );

  const hasActiveFilter = useMemo(
    () =>
      Boolean(keyword.trim()) ||
      actionKindFilter !== "all" ||
      objectTypeFilter !== "all",
    [actionKindFilter, keyword, objectTypeFilter],
  );

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return items.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword);
      const matchesActionKind =
        actionKindFilter === "all" || item.actionKind === actionKindFilter;
      const matchesObjectType =
        objectTypeFilter === "all" || item.objectTypeId === objectTypeFilter;

      return matchesKeyword && matchesActionKind && matchesObjectType;
    });
  }, [actionKindFilter, items, keyword, objectTypeFilter]);

  const sortedItems = useMemo(() => {
    const nextItems = [...filteredItems];

    nextItems.sort((left, right) => {
      const leftValue = sortBy === "name" ? left.name : left.updateTime;
      const rightValue = sortBy === "name" ? right.name : right.updateTime;
      const compareResult = leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: "base",
      });

      return sortDirection === "asc" ? compareResult : -compareResult;
    });

    return nextItems;
  }, [filteredItems, sortBy, sortDirection]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [page, pageSize, sortedItems]);

  const selectedRows = useMemo(
    () => items.filter((item) => selectedRowKeys.includes(item.id)),
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
      className: modalStyles.businessModal,
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await onDelete(records);
        setSelectedRowKeys([]);
      },
    });
  };

  const handleOperate = (key: string, record: KnowledgeNetworkActionTypeRecord) => {
    if (key === "view") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/action-types/${record.id}/detail`,
      );
      return;
    }

    if (key === "edit") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/action-types/${record.id}/edit`,
      );
      return;
    }

    if (key === "execution") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/action-types/${record.id}/execution`,
      );
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
          <span className={styles.objectIconSquare} style={{ backgroundColor: record.color || "#90c06b" }}>
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
          { key: "edit", label: t("common.edit") },
          { key: "execution", label: t("knowledgeNetwork.actionTypeExecutionEntry") },
          { key: "delete", danger: true, label: t("common.delete") },
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
        value.length > 0 ? (
          <div className={styles.tableTags}>
            {value.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        ) : (
          t("knowledgeNetwork.noTags")
        ),
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
    <section className={`${styles.page} ${styles.objectTypePage} ${styles.actionTypePage}`}>
      <h2 className={styles.title}>{t("knowledgeNetwork.actionTypesTitle")}</h2>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <AppButton
            className={styles.toolbarButton}
            icon={<PlusOutlined />}
            onClick={() => {
              void navigate(`/knowledge-network/workspace/${networkId}/action-types/create`);
            }}
            type="primary"
          >
            {t("common.create")}
          </AppButton>
          <AppButton
            className={styles.toolbarButton}
            danger
            disabled={selectedRows.length === 0}
            icon={<DeleteOutlined />}
            onClick={() => confirmDelete(selectedRows)}
          >
            {t("common.delete")}
          </AppButton>
          <JsonResourceImportButton
            className={styles.toolbarButton}
            onImported={onRefresh}
            onImport={onImport}
          />
        </div>
        <div className={styles.toolbarRight}>
          <button
            aria-expanded={searchBarOpen}
            aria-label={t("knowledgeNetwork.toggleSearchBar")}
            className={
              searchBarOpen
                ? `${styles.iconButton} ${styles.iconButtonActive}`
                : styles.iconButton
            }
            onClick={() => {
              setSearchBarOpen(true);
            }}
            type="button"
          >
            <FilterOutlined />
          </button>
          <Dropdown
            menu={{
              items: [
                { key: "updateTime", label: t("knowledgeNetwork.sortByUpdateTime") },
                { key: "name", label: t("knowledgeNetwork.sortByName") },
              ],
              onClick: ({ key }) => {
                const nextSortBy = key as "name" | "updateTime";
                setSortDirection((current) =>
                  nextSortBy === sortBy
                    ? current === "desc"
                      ? "asc"
                      : "desc"
                    : "desc",
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
              void onRefresh();
            }}
            type="button"
          >
            <ReloadOutlined />
          </button>
        </div>
      </div>

      <div className={styles.tableCard}>
        {searchBarOpen ? (
          <div className={styles.integratedFilterBar}>
            <div className={styles.integratedFilterSearch}>
              <SearchOutlined className={styles.integratedFilterSearchIcon} />
              <Input
                allowClear
                bordered={false}
                className={styles.integratedFilterSearchInput}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                placeholder={t("knowledgeNetwork.searchPlaceholder")}
                value={keyword}
              />
            </div>
            <div className={styles.integratedFilterDivider} />
            <div className={styles.integratedFilterField}>
              <span className={styles.integratedFilterLabel}>
                {t("knowledgeNetwork.actionTypeKind")}
              </span>
              <Select
                bordered={false}
                className={styles.integratedFilterSelect}
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
            <div className={styles.integratedFilterDivider} />
            <div className={styles.integratedFilterField}>
              <span className={styles.integratedFilterLabel}>
                {t("knowledgeNetwork.actionTypeObject")}
              </span>
              <Select
                bordered={false}
                className={styles.integratedFilterSelect}
                onChange={(value) => {
                  setObjectTypeFilter(value);
                  setPage(1);
                }}
                options={[{ label: t("common.all"), value: "all" }, ...objectTypeOptions]}
                value={objectTypeFilter}
              />
            </div>
            <button
              aria-label={t("knowledgeNetwork.closeSearchBar")}
              className={styles.integratedFilterClear}
              onClick={() => {
                setSearchBarOpen(false);
              }}
              type="button"
            >
              <CloseOutlined />
            </button>
          </div>
        ) : null}
        <Table<KnowledgeNetworkActionTypeRecord>
          columns={columns}
          dataSource={paginatedItems}
          loading={loading}
          locale={{ emptyText: renderEmptyContent() }}
          pagination={false}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: (nextSelectedRowKeys) => {
              setSelectedRowKeys(nextSelectedRowKeys.map(String));
            },
          }}
          scroll={{ x: 1180 }}
          size="middle"
        />
      </div>

      {sortedItems.length > 0 ? (
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
            total={sortedItems.length}
          />
        </div>
      ) : null}
    </section>
  );
}

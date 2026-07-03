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
import { Dropdown, Empty, Input, Pagination, Select, Table, Tag } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { JsonResourceImportButton } from "@/modules/knowledge-network/components/shared/JsonResourceImportButton";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import type {
  KnowledgeNetworkImportMode,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type ObjectTypeListPanelProps = {
  items: KnowledgeNetworkObjectTypeRecord[];
  loading?: boolean;
  networkId: string;
  onDelete: (records: KnowledgeNetworkObjectTypeRecord[]) => Promise<void>;
  onImport: (
    payload: Record<string, unknown>,
    importMode?: KnowledgeNetworkImportMode,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function ObjectTypeListPanel({
  items,
  loading,
  networkId,
  onDelete,
  onImport,
  onRefresh,
}: ObjectTypeListPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { modal } = useAppServices();
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    items.forEach((item) => {
      item.tags.forEach((tag) => tags.add(tag));
    });
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [items]);

  const hasActiveFilter = useMemo(
    () => Boolean(keyword.trim()) || selectedTag !== "all",
    [keyword, selectedTag],
  );

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return items.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword);
      const matchesTag =
        selectedTag === "all" || item.tags.includes(selectedTag);

      return matchesKeyword && matchesTag;
    });
  }, [items, keyword, selectedTag]);

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
      className: modalStyles.businessModal,
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await onDelete(records);
        setSelectedRowKeys([]);
      },
    });
  };

  const handleOperate = (
    key: string,
    record: KnowledgeNetworkObjectTypeRecord,
  ) => {
    if (key === "view") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/object-types/${record.id}/detail`,
      );
      return;
    }

    if (key === "edit") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/object-types/${record.id}/edit`,
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
            style={{ backgroundColor: record.color }}
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
          { key: "edit", label: t("common.edit") },
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
      dataIndex: "hasIndex",
      key: "hasIndex",
      title: t("knowledgeNetwork.objectTypeHasIndex"),
      width: 120,
      render: (value: boolean) =>
        value
          ? t("knowledgeNetwork.objectTypeIndexed")
          : t("knowledgeNetwork.objectTypeNotIndexed"),
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      width: 180,
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
          description={t("knowledgeNetwork.objectTypeEmptyNoSearchResult")}
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

  return (
    <section className={`${styles.page} ${styles.objectTypePage}`}>
      <h2 className={styles.title}>{t("knowledgeNetwork.objectTypesTitle")}</h2>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
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
        <Table<KnowledgeNetworkObjectTypeRecord>
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
          scroll={{ x: 980 }}
          size="middle"
        />
      </div>

      {sortedItems.length > 0 ? (
        <div className={styles.paginationBar}>
          <Pagination
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

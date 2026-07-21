/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  CloseOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
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
import type {
  KnowledgeNetworkImportMode,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type RelationTypeListPanelProps = {
  items: KnowledgeNetworkRelationTypeRecord[];
  loading?: boolean;
  networkId: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onDelete: (records: KnowledgeNetworkRelationTypeRecord[]) => Promise<void>;
  onImport: (
    payload: Record<string, unknown>,
    importMode?: KnowledgeNetworkImportMode,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function RelationTypeListPanel({
  items,
  loading,
  networkId,
  objectTypes,
  onDelete,
  onImport,
  onRefresh,
}: RelationTypeListPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { modal } = useAppServices();
  const [keyword, setKeyword] = useState("");
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("relation-types");
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
      Boolean(keyword.trim()) || sourceFilter !== "all" || targetFilter !== "all",
    [keyword, sourceFilter, targetFilter],
  );

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return items.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword);
      const matchesSource =
        sourceFilter === "all" || item.sourceObjectTypeId === sourceFilter;
      const matchesTarget =
        targetFilter === "all" || item.targetObjectTypeId === targetFilter;

      return matchesKeyword && matchesSource && matchesTarget;
    });
  }, [items, keyword, sourceFilter, targetFilter]);

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
      className: modalStyles.businessModal,
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await onDelete(records);
        setSelectedRowKeys([]);
      },
    });
  };

  const handleOperate = (key: string, record: KnowledgeNetworkRelationTypeRecord) => {
    if (key === "view") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/relation-types/${record.id}/detail`,
      );
      return;
    }

    if (key === "edit") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/relation-types/${record.id}/edit`,
      );
      return;
    }

    if (key === "mapping") {
      void navigate(
        `/knowledge-network/workspace/${networkId}/relation-types/${record.id}/mapping`,
      );
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
          { key: "edit", label: t("common.edit") },
          { key: "mapping", label: t("knowledgeNetwork.relationTypeMappingEntry") },
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
      dataIndex: "sourceObjectTypeName",
      key: "sourceObjectTypeName",
      title: t("knowledgeNetwork.relationTypeListSourceObject"),
      width: 180,
      render: (value: string, record) =>
        renderObjectTypeLink(record.sourceObjectTypeId, value),
    },
    {
      dataIndex: "targetObjectTypeName",
      key: "targetObjectTypeName",
      title: t("knowledgeNetwork.relationTypeListTargetObject"),
      width: 180,
      render: (value: string, record) =>
        renderObjectTypeLink(record.targetObjectTypeId, value),
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

  const tableEmptyText = loading ? (
    <div className={styles.loadingEmptyState} />
  ) : (
    renderEmptyContent()
  );

  return (
    <section className={`${styles.page} ${styles.objectTypePage} ${styles.relationTypePage}`}>
      <h2 className={styles.title}>{t("knowledgeNetwork.relationTypesTitle")}</h2>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <AppButton
            className={styles.toolbarButton}
            icon={<PlusOutlined />}
            onClick={() => {
              void navigate(`/knowledge-network/workspace/${networkId}/relation-types/create`);
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
                {t("knowledgeNetwork.relationTypeListSourceObject")}
              </span>
              <Select
                bordered={false}
                className={styles.integratedFilterSelect}
                onChange={(value) => {
                  setSourceFilter(value);
                  setPage(1);
                }}
                options={[{ label: t("common.all"), value: "all" }, ...objectTypeOptions]}
                value={sourceFilter}
              />
            </div>
            <div className={styles.integratedFilterDivider} />
            <div className={styles.integratedFilterField}>
              <span className={styles.integratedFilterLabel}>
                {t("knowledgeNetwork.relationTypeListTargetObject")}
              </span>
              <Select
                bordered={false}
                className={styles.integratedFilterSelect}
                onChange={(value) => {
                  setTargetFilter(value);
                  setPage(1);
                }}
                options={[{ label: t("common.all"), value: "all" }, ...objectTypeOptions]}
                value={targetFilter}
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
        <Table<KnowledgeNetworkRelationTypeRecord>
          columns={columns}
          dataSource={paginatedItems}
          loading={loading}
          locale={{ emptyText: tableEmptyText }}
          pagination={false}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: (nextSelectedRowKeys) => {
              setSelectedRowKeys(nextSelectedRowKeys.map(String));
            },
          }}
          scroll={{ x: 1280 }}
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

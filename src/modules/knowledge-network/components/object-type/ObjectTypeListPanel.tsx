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
import { Dropdown, Empty, Input, Select, Table, Tag } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { formatIndexStateLabel } from "@/modules/data-catalog/lib/format-index-state";
import { indexStateOf } from "@/modules/data-catalog/lib/index-state";
import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";
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

function readPositiveInteger(value: string | null, fallback: number) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

function readSortBy(value: string | null): "name" | "updateTime" {
  return value === "name" ? "name" : "updateTime";
}

function readSortDirection(value: string | null): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { modal } = useAppServices();
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
    readPositiveInteger(searchParams.get("pageSize"), 10),
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [resourceBuildTasks, setResourceBuildTasks] = useState<BuildTask[]>([]);
  const [resourceBuildTasksLoading, setResourceBuildTasksLoading] = useState(false);

  useEffect(() => {
    const nextKeyword = searchParams.get("q") ?? "";
    const nextTag = searchParams.get("tag") ?? "all";
    const nextSortBy = readSortBy(searchParams.get("sort"));
    const nextSortDirection = readSortDirection(searchParams.get("order"));
    const nextPage = readPositiveInteger(searchParams.get("page"), 1);
    const nextPageSize = readPositiveInteger(searchParams.get("pageSize"), 10);

    setKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setSelectedTag((current) => (current === nextTag ? current : nextTag));
    setSortBy((current) => (current === nextSortBy ? current : nextSortBy));
    setSortDirection((current) =>
      current === nextSortDirection ? current : nextSortDirection,
    );
    setPage((current) => (current === nextPage ? current : nextPage));
    setPageSize((current) => (current === nextPageSize ? current : nextPageSize));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

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

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    keyword,
    page,
    pageSize,
    searchParams,
    selectedTag,
    setSearchParams,
    sortBy,
    sortDirection,
  ]);

  const boundResourceIds = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.dataSource?.id).filter((id): id is string => !!id)),
      ),
    [items],
  );

  useEffect(() => {
    if (boundResourceIds.length === 0) {
      setResourceBuildTasks([]);
      setResourceBuildTasksLoading(false);
      return;
    }

    let cancelled = false;
    setResourceBuildTasksLoading(true);

    void Promise.all(
      boundResourceIds.map((resourceId) => listBuildTasks({ resourceId, silent: true })),
    )
      .then((taskGroups) => {
        if (!cancelled) {
          setResourceBuildTasks(taskGroups.flat());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResourceBuildTasks([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResourceBuildTasksLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boundResourceIds]);

  const buildTasksByResourceId = useMemo(() => {
    const next = new Map<string, BuildTask[]>();
    resourceBuildTasks.forEach((task) => {
      next.set(task.resourceId, [...(next.get(task.resourceId) ?? []), task]);
    });
    return next;
  }, [resourceBuildTasks]);

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
              void navigate(`/data-directory/resource/${resource.id}`);
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
      width: 140,
      render: (_value, record) => {
        const resourceId = record.dataSource?.id;
        if (!resourceId) {
          return "--";
        }

        const label = resourceBuildTasksLoading
          ? t("knowledgeNetwork.objectTypeDataViewIndexLoading")
          : formatIndexStateLabel(indexStateOf(buildTasksByResourceId.get(resourceId) ?? []), t);

        return (
          <button
            className={styles.tableLink}
            onClick={() => {
              void navigate(`/data-directory/resource/${resourceId}?tab=index`);
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

  const tableEmptyText = loading ? (
    <div className={styles.loadingEmptyState} />
  ) : (
    renderEmptyContent()
  );

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
          locale={{ emptyText: tableEmptyText }}
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

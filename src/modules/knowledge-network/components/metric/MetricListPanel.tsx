/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EllipsisOutlined,
  LineChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Empty, Input, Pagination, Select, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import type {
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkMetricScopeType,
  KnowledgeNetworkMetricType,
} from "@/modules/knowledge-network/types/knowledge-network";
import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type MetricListPanelProps = {
  loading?: boolean;
  metrics: KnowledgeNetworkMetricRecord[];
  networkId: string;
  onDelete: (metricId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  unsupported?: boolean;
};

function getMetricTypeLabel(
  value: KnowledgeNetworkMetricType,
  t: (key: string) => string,
) {
  switch (value) {
    case "derived":
      return t("knowledgeNetwork.metricTypeDerived");
    case "composite":
      return t("knowledgeNetwork.metricTypeComposite");
    case "atomic":
    default:
      return t("knowledgeNetwork.metricTypeAtomic");
  }
}

function getScopeTypeLabel(
  value: KnowledgeNetworkMetricScopeType,
  t: (key: string) => string,
) {
  switch (value) {
    case "subgraph":
      return t("knowledgeNetwork.metricScopeSubgraph");
    case "object_type":
    default:
      return t("knowledgeNetwork.metricScopeObjectType");
  }
}

export function MetricListPanel({
  loading,
  metrics,
  networkId,
  onDelete,
  onRefresh,
  unsupported = false,
}: MetricListPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    metrics.forEach((item) => {
      item.tags.forEach((tag) => tags.add(tag));
    });
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [metrics]);

  const hasActiveFilter = useMemo(
    () => Boolean(keyword.trim()) || selectedTag !== "all",
    [keyword, selectedTag],
  );

  const filteredMetrics = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const items = metrics.filter((item) => {
      const matchesKeyword =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.id.toLowerCase().includes(normalizedKeyword);
      const matchesTag = selectedTag === "all" || item.tags.includes(selectedTag);
      return matchesKeyword && matchesTag;
    });

    return [...items].sort((left, right) => {
      const leftValue = sortBy === "name" ? left.name : left.updateTime;
      const rightValue = sortBy === "name" ? right.name : right.updateTime;
      const compared = leftValue.localeCompare(rightValue);
      return sortDirection === "asc" ? compared : -compared;
    });
  }, [keyword, metrics, selectedTag, sortBy, sortDirection]);

  const pagedMetrics = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMetrics.slice(start, start + pageSize);
  }, [filteredMetrics, page, pageSize]);

  const confirmDelete = (records: KnowledgeNetworkMetricRecord[]) => {
    if (records.length === 0) {
      return;
    }

    void modal.confirm({
      cancelText: t("common.cancel"),
      content:
        records.length === 1
          ? t("knowledgeNetwork.metricDeleteDescription", { name: records[0].name })
          : t("knowledgeNetwork.metricBatchDeleteDescription", { count: records.length }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await Promise.all(records.map((record) => onDelete(record.id)));
        setSelectedRowKeys([]);
        void message.success(t("common.success"));
        await onRefresh();
      },
      title: t("knowledgeNetwork.metricDeleteTitle"),
    });
  };

  const handleOperate = (key: string, record: KnowledgeNetworkMetricRecord) => {
    if (key === "view") {
      void navigate(`/knowledge-network/workspace/${networkId}/metrics/${record.id}/detail`);
      return;
    }

    if (key === "edit") {
      void navigate(`/knowledge-network/workspace/${networkId}/metrics/${record.id}/edit`);
      return;
    }

    if (key === "delete") {
      confirmDelete([record]);
    }
  };

  const columns: TableProps<KnowledgeNetworkMetricRecord>["columns"] = [
    {
      dataIndex: "name",
      fixed: "left",
      key: "name",
      title: t("common.name"),
      width: 280,
      render: (value: string, record) => (
        <button
          className={styles.objectTitleBox}
          onClick={() => {
            void navigate(`/knowledge-network/workspace/${networkId}/metrics/${record.id}/detail`);
          }}
          type="button"
        >
          <span className={styles.objectIconSquare} style={{ backgroundColor: "#126ee3" }}>
            <LineChartOutlined />
          </span>
          <span className={styles.objectName}>{value}</span>
        </button>
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
      dataIndex: "metricType",
      key: "metricType",
      title: t("knowledgeNetwork.metricType"),
      width: 120,
      render: (value: KnowledgeNetworkMetricType) => getMetricTypeLabel(value, t),
    },
    {
      dataIndex: "scopeType",
      key: "scopeType",
      title: t("knowledgeNetwork.metricScopeType"),
      width: 120,
      render: (value: KnowledgeNetworkMetricScopeType) => getScopeTypeLabel(value, t),
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      width: 160,
      render: (tags: string[]) => (tags.length > 0 ? tags.join(", ") : "--"),
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
          description={t("knowledgeNetwork.metricEmptyNoSearchResult")}
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
                void navigate(`/knowledge-network/workspace/${networkId}/metrics/create`);
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

  const tableContent =
    filteredMetrics.length === 0 ? (
      renderEmptyContent()
    ) : (
      <>
        <Table
          columns={columns}
          dataSource={pagedMetrics}
          loading={loading}
          pagination={false}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          scroll={{ x: 980 }}
          size="middle"
        />
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
            total={filteredMetrics.length}
          />
        </div>
      </>
    );

  return (
    <section className={styles.page}>
      <h2 className={styles.title}>{t("knowledgeNetwork.metricsTitle")}</h2>
      {unsupported ? (
        <Alert
          className={styles.noticeBanner}
          message={t("knowledgeNetwork.metricApiUnavailableTitle")}
          showIcon
          type="warning"
          description={t("knowledgeNetwork.metricApiUnavailableDescription")}
        />
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <AppButton
            className={styles.toolbarButton}
            icon={<PlusOutlined />}
            onClick={() => {
              void navigate(`/knowledge-network/workspace/${networkId}/metrics/create`);
            }}
            type="primary"
          >
            {t("common.create")}
          </AppButton>
          <AppButton
            className={styles.toolbarButton}
            danger
            disabled={selectedRowKeys.length === 0}
            icon={<DeleteOutlined />}
            onClick={() => {
              const selectedRecords = metrics.filter((item) => selectedRowKeys.includes(item.id));
              confirmDelete(selectedRecords);
            }}
          >
            {t("common.delete")}
          </AppButton>
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
          <AppButton
            aria-label={t("common.refresh")}
            className={styles.iconButton}
            icon={<ReloadOutlined />}
            onClick={() => void onRefresh()}
          />
        </div>
      </div>

      <div className={styles.tableCard}>{tableContent}</div>
    </section>
  );
}

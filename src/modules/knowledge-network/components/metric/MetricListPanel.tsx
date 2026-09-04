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
import { Alert, Dropdown, Empty, Input, Select, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import { ResourceTagList } from "@/modules/knowledge-network/components/shared/ResourceTagList";
import { usePersistentPageSize } from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import {
  deleteKnowledgeNetworkMetrics,
  listKnowledgeNetworkMetrics,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkMetricType,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  resolveUpdaterDisplayName,
  useAccountDirectory,
} from "@/modules/knowledge-network/hooks/useAccountDirectory";
import { resolveMetricBoundObjectTypeName } from "@/modules/knowledge-network/utils/metric-display";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";
import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type MetricListPanelProps = {
  canDelete: boolean;
  canModify: boolean;
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

export function MetricListPanel({
  canDelete,
  canModify,
  loading,
  metrics,
  networkId,
  onDelete,
  onRefresh,
  unsupported = false,
}: MetricListPanelProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const [tableMetrics, setTableMetrics] = useState(metrics);
  const [tableLoading, setTableLoading] = useState(Boolean(loading));
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedBoundObjectType, setSelectedBoundObjectType] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("metrics");
  const [total, setTotal] = useState(metrics.length);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [authorizingRecord, setAuthorizingRecord] =
    useState<KnowledgeNetworkMetricRecord | null>(null);
  const accountDirectory = useAccountDirectory();

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    [...metrics, ...tableMetrics].forEach((item) => {
      item.tags.forEach((tag) => tags.add(tag));
    });
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [metrics, tableMetrics]);

  const boundObjectTypeOptions = useMemo(
    () =>
      [...objectTypes]
        .sort((left, right) => left.name.localeCompare(right.name, i18n.language || undefined))
        .map((item) => ({ label: item.name, value: item.id })),
    [i18n.language, objectTypes],
  );

  const hasActiveFilter = useMemo(
    () =>
      Boolean(keyword.trim()) || selectedTag !== "all" || selectedBoundObjectType !== "all",
    [keyword, selectedBoundObjectType, selectedTag],
  );

  const fetchMetrics = useCallback(async () => {
    setTableLoading(true);
    try {
      const result = await listKnowledgeNetworkMetrics(networkId, {
        direction: sortDirection,
        keyword,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        scopeRef: selectedBoundObjectType !== "all" ? selectedBoundObjectType : undefined,
        sort: sortBy === "name" ? "name" : "update_time",
        tag: selectedTag,
      });
      setTableMetrics(result.entries);
      setTotal(result.totalCount);
      setSelectedRowKeys([]);
    } finally {
      setTableLoading(false);
    }
  }, [keyword, networkId, page, pageSize, selectedBoundObjectType, selectedTag, sortBy, sortDirection]);

  useEffect(() => {
    void listKnowledgeNetworkObjectTypes(networkId).then(setObjectTypes);
  }, [networkId]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const confirmDelete = (records: KnowledgeNetworkMetricRecord[]) => {
    if (records.length === 0) {
      return;
    }

    void modal.confirm({
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      content:
        records.length === 1
          ? t("knowledgeNetwork.metricDeleteDescription", { name: records[0].name })
          : t("knowledgeNetwork.metricBatchDeleteDescription", { count: records.length }),
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        if (records.length === 1) {
          await onDelete(records[0].id);
        } else {
          await deleteKnowledgeNetworkMetrics(
            networkId,
            records.map((record) => record.id),
          );
        }
        setSelectedRowKeys([]);
        void message.success(t("common.success"));
        await Promise.all([fetchMetrics(), onRefresh()]);
      },
      title: t("knowledgeNetwork.metricDeleteTitle"),
      width: 520,
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

    if (key === "authorize") {
      setAuthorizingRecord(record);
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
        <div
          className={styles.objectTitleBox}
          onClick={() => {
            void navigate(`/knowledge-network/workspace/${networkId}/metrics/${record.id}/detail`);
          }}
          title={value}
        >
          <span className={styles.objectIconSquare} style={{ backgroundColor: "#5381DF" }}>
            <LineChartOutlined />
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
          ...(hasKnowledgeNetworkRecordOperation(record, "modify")
            ? [{ key: "edit", label: t("common.edit") }]
            : []),
          ...(hasKnowledgeNetworkRecordOperation(record, "authorize")
            ? [{ key: "authorize", label: t("knowledgeNetwork.authorizeAction") }]
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
      dataIndex: "metricType",
      key: "metricType",
      title: t("knowledgeNetwork.metricType"),
      width: 120,
      render: (value: KnowledgeNetworkMetricType) => getMetricTypeLabel(value, t),
    },
    {
      dataIndex: "scopeRef",
      key: "boundObjectType",
      title: t("knowledgeNetwork.metricBoundObjectType"),
      width: 180,
      render: (_value: string, record) =>
        resolveMetricBoundObjectTypeName(record, objectTypes),
    },
    {
      dataIndex: "tags",
      key: "tags",
      title: t("common.tag"),
      width: 160,
      render: (tags: string[]) =>
        tags.length > 0 ? (
          <ResourceTagList tags={tags} />
        ) : (
          "--"
        ),
    },
    {
      dataIndex: "updaterName",
      key: "updaterName",
      title: t("knowledgeNetwork.modifier"),
      width: 140,
      render: (value: string) => resolveUpdaterDisplayName(value, accountDirectory),
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

    if (!canModify) {
      return (
        <Empty
          className={styles.emptyPanel}
          description={t("knowledgeNetwork.emptyMetrics")}
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
    tableMetrics.length === 0 ? (
      renderEmptyContent()
    ) : (
      <Table
        columns={columns}
        dataSource={tableMetrics}
        loading={tableLoading}
        pagination={false}
        rowKey="id"
        rowSelection={
          canDelete
            ? {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as string[]),
              }
            : undefined
        }
        scroll={{ x: 980 }}
        size="middle"
      />
    );

  return (
    <>
      <section className={`${styles.page} ${styles.objectTypePage} ${styles.metricPage}`}>
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
          {canModify || canDelete ? (
            <>
              {canModify ? (
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
              ) : null}
              {canDelete ? (
              <AppButton
                className={styles.toolbarButton}
                danger
                disabled={selectedRowKeys.length === 0}
                icon={<DeleteOutlined />}
                onClick={() => {
                  const pageSelectedRecords = tableMetrics.filter((item) => selectedRowKeys.includes(item.id));
                  confirmDelete(pageSelectedRecords);
                }}
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
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t("knowledgeNetwork.metricBoundObjectType")}</span>
            <Select
              className={styles.filterSelect}
              onChange={(value) => {
                setSelectedBoundObjectType(value);
                setPage(1);
              }}
              optionFilterProp="label"
              options={[
                { label: t("common.all"), value: "all" },
                ...boundObjectTypeOptions,
              ]}
              showSearch
              value={selectedBoundObjectType}
            />
          </div>
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
            onClick={() => void Promise.all([fetchMetrics(), onRefresh()])}
          />
        </div>
      </div>

      <div className={styles.tableCard}>{tableContent}</div>

      {total > 0 ? (
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
            total={total}
          />
        </div>
      ) : null}
      </section>
      <KnowledgeNetworkObjectAuthorizeDrawer
        networkId={networkId}
        objectType="metric"
        onClose={() => setAuthorizingRecord(null)}
        open={Boolean(authorizingRecord)}
        record={authorizingRecord}
      />
    </>
  );
}

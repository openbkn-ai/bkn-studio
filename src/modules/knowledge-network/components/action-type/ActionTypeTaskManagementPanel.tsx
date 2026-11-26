/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EllipsisOutlined,
  ReloadOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { MenuProps, TableProps } from "antd";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  cancelKnowledgeNetworkActionTypeExecution,
  getKnowledgeNetworkActionTypeExecutionLogDetail,
  listKnowledgeNetworkActionTypeExecutionLogs,
  listKnowledgeNetworkActionTypeExecutionResults,
  retryKnowledgeNetworkActionTypeIndexSync,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeExecutionLog,
  ActionTypeExecutionLogDetail,
  ActionTypeExecutionLogResultItem,
  ActionTypeExecutionLogResultStatus,
  ActionTypeExecutionResultStatusFilter,
  ActionTypeExecutionStatus,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeTaskManagementPanel.module.css";

const RESULT_PAGE_SIZE_OPTIONS = [20, 50, 100];
// The results endpoint serves pages only within the first 10,000 results (offset + limit).
const RESULT_WINDOW = 10000;

type ActionTypeTaskManagementPanelProps = {
  actionTypeId: string;
  canManage?: boolean;
  networkId: string;
  refreshToken?: number;
  initialExecutionId?: string;
};

function formatDuration(durationMs: number) {
  if (durationMs <= 0) {
    return "--";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function RunResultSummary({
  failedCount,
  successCount,
}: {
  failedCount: number;
  successCount: number;
}) {
  return (
    <div className={styles.resultSummary}>
      <span>
        <CheckCircleOutlined className={styles.successIcon} />
        {successCount}
      </span>
      <span>
        <CloseCircleOutlined className={styles.failedIcon} />
        {failedCount}
      </span>
    </div>
  );
}

export function ActionTypeTaskManagementPanel({
  actionTypeId,
  canManage = true,
  networkId,
  refreshToken = 0,
  initialExecutionId,
}: ActionTypeTaskManagementPanelProps) {
  const { t } = useTranslation();
  const { modal, message, runtimeConfig } = useAppServices();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActionTypeExecutionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActionTypeExecutionStatus | "">("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailContext, setDetailContext] = useState<{
    actionTypeId: string;
    networkId: string;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [currentLog, setCurrentLog] = useState<ActionTypeExecutionLogDetail | null>(null);
  const [resultPage, setResultPage] = useState(1);
  const [resultPageSize, setResultPageSize] = useState(RESULT_PAGE_SIZE_OPTIONS[0]);
  const [resultStatus, setResultStatus] = useState<ActionTypeExecutionResultStatusFilter>("");
  const [resultRows, setResultRows] = useState<ActionTypeExecutionLogResultItem[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [resultsLoading, setResultsLoading] = useState(false);
  // An older backend has no results endpoint; the detail response then carries the first page.
  const [embeddedResultsOnly, setEmbeddedResultsOnly] = useState(false);
  const [resultRefresh, setResultRefresh] = useState(0);
  const [resultsFailed, setResultsFailed] = useState(false);
  const [syncRetrying, setSyncRetrying] = useState(false);
  const retryRef = useRef(false);
  const detailRequestRef = useRef(0);
  const isCurrentContext =
    detailContext?.actionTypeId === actionTypeId && detailContext?.networkId === networkId;

  useLayoutEffect(() => {
    setDrawerOpen(false);
    setDetailContext(null);
    setDrawerLoading(false);
    setCurrentLog(null);
    setResultRows([]);
    setResultTotal(0);
    setResultsLoading(false);
    setSyncRetrying(false);
    return () => {
      // A context change or unmount makes every outstanding detail response obsolete.
      detailRequestRef.current += 1;
    };
  }, [actionTypeId, networkId]);

  const statusOptions = useMemo(
    () => [
      { label: t("common.all"), value: "" },
      { label: t("knowledgeNetwork.actionTypeExecutionStatusPending"), value: "pending" },
      { label: t("knowledgeNetwork.actionTypeExecutionStatusRunning"), value: "running" },
      { label: t("knowledgeNetwork.actionTypeExecutionStatusCompleted"), value: "completed" },
      { label: t("knowledgeNetwork.actionTypeExecutionStatusFailed"), value: "failed" },
      { label: t("knowledgeNetwork.actionTypeExecutionStatusCancelled"), value: "cancelled" },
    ],
    [t],
  );

  const triggerOptions = useMemo(
    () => [
      { label: t("common.all"), value: "" },
      { label: t("knowledgeNetwork.actionTypeExecutionTriggerManual"), value: "manual" },
      { label: t("knowledgeNetwork.actionTypeExecutionTriggerSchedule"), value: "scheduled" },
      { label: t("knowledgeNetwork.actionTypeExecutionTriggerEvent"), value: "event" },
      { label: t("knowledgeNetwork.actionTypeExecutionTriggerAgent"), value: "agent" },
    ],
    [t],
  );

  const getTriggerLabel = useCallback(
    (value: string) => {
      switch (value) {
        case "manual":
          return t("knowledgeNetwork.actionTypeExecutionTriggerManual");
        // The platform records "scheduled"; "schedule" is what older records may hold.
        case "schedule":
        case "scheduled":
          return t("knowledgeNetwork.actionTypeExecutionTriggerSchedule");
        case "event":
          return t("knowledgeNetwork.actionTypeExecutionTriggerEvent");
        case "agent":
          return t("knowledgeNetwork.actionTypeExecutionTriggerAgent");
        default:
          return value || "--";
      }
    },
    [t],
  );

  const getStatusLabel = useCallback(
    (status: ActionTypeExecutionStatus) => {
      switch (status) {
        case "pending":
          return t("knowledgeNetwork.actionTypeExecutionStatusPending");
        case "running":
          return t("knowledgeNetwork.actionTypeExecutionStatusRunning");
        case "completed":
          return t("knowledgeNetwork.actionTypeExecutionStatusCompleted");
        case "failed":
          return t("knowledgeNetwork.actionTypeExecutionStatusFailed");
        case "cancelled":
          return t("knowledgeNetwork.actionTypeExecutionStatusCancelled");
        default:
          return status;
      }
    },
    [t],
  );

  const resultStatusOptions = useMemo(
    () => [
      { label: t("common.all"), value: "" },
      { label: t("knowledgeNetwork.actionTypeExecutionResultSuccess"), value: "success" },
      { label: t("knowledgeNetwork.actionTypeExecutionResultFailed"), value: "failed" },
      { label: t("knowledgeNetwork.actionTypeExecutionStatusCancelled"), value: "cancelled" },
    ],
    [t],
  );

  const getResultStatusLabel = (status: ActionTypeExecutionLogResultStatus) => {
    switch (status) {
      case "success":
        return t("knowledgeNetwork.actionTypeExecutionResultSuccess");
      case "failed":
        return t("knowledgeNetwork.actionTypeExecutionResultFailed");
      case "cancelled":
        return t("knowledgeNetwork.actionTypeExecutionStatusCancelled");
      case "pending":
        return t("knowledgeNetwork.actionTypeExecutionStatusPending");
      default:
        return status;
    }
  };

  const getStatusBadge = (status: ActionTypeExecutionStatus) => {
    switch (status) {
      case "completed":
        return "success";
      case "failed":
        return "error";
      case "running":
        return "processing";
      case "cancelled":
        return "warning";
      case "pending":
      default:
        return "default";
    }
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listKnowledgeNetworkActionTypeExecutionLogs(networkId, {
        actionTypeId,
        keyword,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        status: statusFilter,
        triggerType: triggerFilter,
      });
      setLogs(result.entries);
      setTotal(result.totalCount);
    } finally {
      setLoading(false);
    }
  }, [actionTypeId, keyword, networkId, page, pageSize, statusFilter, triggerFilter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, refreshToken]);

  const openLogDetail = useCallback(
    async (record: Pick<ActionTypeExecutionLog, "id">) => {
      const requestId = ++detailRequestRef.current;
      setDetailContext({ actionTypeId, networkId });
      setDrawerOpen(true);
      setDrawerLoading(true);
      setCurrentLog(null);
      setResultPage(1);
      setResultStatus("");
      setResultRows([]);
      setResultTotal(0);
      setEmbeddedResultsOnly(false);
      setSyncRetrying(false);

      try {
        const detail = await getKnowledgeNetworkActionTypeExecutionLogDetail(networkId, record.id);
        if (requestId === detailRequestRef.current) {
          if (detail?.actionTypeId && detail.actionTypeId !== actionTypeId)
            throw new Error(t("common.notFound"));
          setCurrentLog(detail);
        }
      } catch (error) {
        if (requestId === detailRequestRef.current) {
          setCurrentLog(null);
          void message.error(extractRequestErrorMessage(error));
        }
      } finally {
        if (requestId === detailRequestRef.current) {
          setDrawerLoading(false);
        }
      }
    },
    [actionTypeId, networkId, message, t],
  );

  const openDetailRef = useRef(openLogDetail);
  useEffect(() => {
    openDetailRef.current = openLogDetail;
  });
  useEffect(() => {
    if (initialExecutionId) void openDetailRef.current({ id: initialExecutionId });
  }, [initialExecutionId, networkId, actionTypeId]);

  const closeLogDetail = () => {
    detailRequestRef.current += 1;
    setDrawerOpen(false);
  };

  const currentLogId = isCurrentContext ? currentLog?.id : undefined;

  useEffect(() => {
    if (!drawerOpen || !isCurrentContext || !currentLogId || embeddedResultsOnly) {
      return;
    }

    let stale = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async (background = false) => {
      if (!background) setResultsLoading(true);
      setResultsFailed(false);
      try {
        const page = await listKnowledgeNetworkActionTypeExecutionResults(networkId, currentLogId, {
          limit: resultPageSize,
          offset: (resultPage - 1) * resultPageSize,
          status: resultStatus,
        });
        if (stale) return;
        if (page === null) {
          setEmbeddedResultsOnly(true);
          return;
        }
        setResultRows(page.entries);
        setResultTotal(page.totalCount);
        let executionStatus = currentLog?.status;
        if (executionStatus === "pending" || executionStatus === "running") {
          const detail = await getKnowledgeNetworkActionTypeExecutionLogDetail(
            networkId,
            currentLogId,
          );
          if (stale) return;
          if (detail) {
            setCurrentLog(detail);
            executionStatus = detail.status;
          }
        }
        if (
          ["pending", "running"].includes(executionStatus ?? "") ||
          page.entries.some((row) =>
            ["pending", "submitted", "retrying"].includes(row.indexSync?.status ?? ""),
          )
        )
          timer = setTimeout(() => void load(true), 5000);
      } catch (error) {
        if (!stale) {
          setResultsFailed(true);
          if (!background) {
            setResultRows([]);
            setResultTotal(0);
            void message.error(extractRequestErrorMessage(error));
          }
        }
      } finally {
        if (!stale && !background) setResultsLoading(false);
      }
    };
    void load();
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [
    currentLogId,
    currentLog?.status,
    drawerOpen,
    embeddedResultsOnly,
    isCurrentContext,
    message,
    networkId,
    resultPage,
    resultPageSize,
    resultStatus,
    resultRefresh,
  ]);

  // Without the results endpoint, page and filter the results embedded in the detail response.
  const embeddedResults = useMemo(() => {
    if (!embeddedResultsOnly) {
      return null;
    }
    const matched = (currentLog?.results ?? []).filter(
      (item) => !resultStatus || item.status === resultStatus,
    );
    const offset = (resultPage - 1) * resultPageSize;
    return { rows: matched.slice(offset, offset + resultPageSize), total: matched.length };
  }, [currentLog?.results, embeddedResultsOnly, resultPage, resultPageSize, resultStatus]);

  const shownResultRows = embeddedResults ? embeddedResults.rows : resultRows;
  const shownResultTotal = embeddedResults
    ? embeddedResults.total
    : Math.min(resultTotal, RESULT_WINDOW);

  // Say so when only part of the results can be browsed: past the endpoint's window, or, without
  // the endpoint, beyond the first page the detail response embeds.
  const embeddedResultCount = currentLog?.results?.length ?? 0;
  const browsableResults = embeddedResults
    ? (currentLog?.resultsTotal ?? 0) > embeddedResultCount
      ? { count: embeddedResultCount, total: currentLog?.resultsTotal ?? 0 }
      : null
    : resultTotal > RESULT_WINDOW
      ? { count: RESULT_WINDOW, total: resultTotal }
      : null;

  const canRetrySync = Boolean(
    drawerOpen &&
    isCurrentContext &&
    runtimeConfig.currentUser.id &&
    currentLog?.executorId === runtimeConfig.currentUser.id &&
    shownResultRows.some((row) => row.indexSync?.status === "failed"),
  );
  const retrySync = async () => {
    if (!canRetrySync || !currentLogId || resultsLoading || resultsFailed || retryRef.current)
      return;
    retryRef.current = true;
    setSyncRetrying(true);
    const revision = detailRequestRef.current;
    try {
      const count = await retryKnowledgeNetworkActionTypeIndexSync(networkId, currentLogId);
      if (revision === detailRequestRef.current)
        void message.success(
          t(
            count
              ? "knowledgeNetwork.actionTypeIndexSyncRetryQueued"
              : "knowledgeNetwork.actionTypeIndexSyncNothingToRetry",
          ),
        );
    } catch (error) {
      if (revision === detailRequestRef.current)
        void message.error(
          t(
            (error as { response?: { status?: number } }).response?.status === 403
              ? "knowledgeNetwork.actionTypeIndexSyncForbidden"
              : "knowledgeNetwork.actionTypeIndexSyncRetryFailed",
          ),
        );
    } finally {
      retryRef.current = false;
      if (revision === detailRequestRef.current) {
        setSyncRetrying(false);
        setResultRefresh((value) => value + 1);
      }
    }
  };

  const confirmCancel = (record: ActionTypeExecutionLog) => {
    void modal.confirm({
      title: t("knowledgeNetwork.actionTypeExecutionCancelTitle"),
      content: t("knowledgeNetwork.actionTypeExecutionCancelDescription"),
      cancelText: t("common.cancel"),
      okText: t("common.confirm"),
      onOk: async () => {
        await cancelKnowledgeNetworkActionTypeExecution(networkId, record.id);
        await loadLogs();
      },
    });
  };

  const buildRowMenu = (record: ActionTypeExecutionLog): MenuProps["items"] => {
    const items: MenuProps["items"] = [
      {
        key: "view",
        label: t("common.detail"),
      },
    ];

    if (canManage && (record.status === "pending" || record.status === "running")) {
      items.push({
        key: "cancel",
        label: t("knowledgeNetwork.actionTypeExecutionCancelAction"),
      });
    }

    return items;
  };

  const columns: TableProps<ActionTypeExecutionLog>["columns"] = [
    {
      dataIndex: "startTime",
      key: "startTime",
      title: t("knowledgeNetwork.actionTypeExecutionStartTime"),
      width: 180,
    },
    {
      dataIndex: "triggerType",
      key: "triggerType",
      render: (value: string) => getTriggerLabel(value),
      title: t("knowledgeNetwork.actionTypeExecutionTriggerType"),
      width: 120,
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: ActionTypeExecutionStatus) => (
        <Badge status={getStatusBadge(value)} text={getStatusLabel(value)} />
      ),
      title: t("knowledgeNetwork.actionTypeExecutionRunStatus"),
      width: 140,
    },
    {
      key: "resultSummary",
      render: (_value, record) => (
        <RunResultSummary failedCount={record.failedCount} successCount={record.successCount} />
      ),
      title: t("knowledgeNetwork.actionTypeExecutionRunSummary"),
      width: 120,
    },
    {
      dataIndex: "durationMs",
      key: "durationMs",
      render: (value: number) => formatDuration(value),
      title: t("knowledgeNetwork.actionTypeExecutionDuration"),
      width: 100,
    },
    {
      align: "center",
      key: "actions",
      render: (_value, record) => (
        <Dropdown
          menu={{
            items: buildRowMenu(record),
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === "view") {
                void openLogDetail(record);
              }
              if (key === "cancel") {
                confirmCancel(record);
              }
            },
          }}
          trigger={["click"]}
        >
          <AppButton
            aria-label={t("common.actions")}
            icon={<EllipsisOutlined />}
            onClick={(event) => event.stopPropagation()}
            type="text"
          />
        </Dropdown>
      ),
      title: t("common.actions"),
      width: 72,
    },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <Input
          allowClear
          className={styles.searchInput}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder={t("knowledgeNetwork.actionTypeExecutionSearchPlaceholder")}
          prefix={<SearchOutlined />}
          value={keyword}
        />
        <Select
          className={styles.filterSelect}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={statusOptions}
          value={statusFilter}
        />
        <Select
          className={styles.filterSelect}
          onChange={(value) => {
            setTriggerFilter(value);
            setPage(1);
          }}
          options={triggerOptions}
          value={triggerFilter}
        />
        <AppButton
          className={styles.refreshButton}
          icon={<ReloadOutlined />}
          onClick={() => void loadLogs()}
        >
          {t("common.refresh")}
        </AppButton>
      </div>

      <Table<ActionTypeExecutionLog>
        bordered
        columns={columns}
        dataSource={logs}
        loading={loading}
        locale={{
          emptyText: keyword ? (
            <Empty description={t("knowledgeNetwork.actionTypeExecutionEmptyNoSearchResult")} />
          ) : (
            <Empty description={t("knowledgeNetwork.actionTypeExecutionEmpty")} />
          ),
        }}
        onChange={(pagination) => {
          setPage(pagination.current ?? 1);
          setPageSize(pagination.pageSize ?? 10);
        }}
        pagination={{
          current: page,
          pageSize,
          showSizeChanger: true,
          total,
        }}
        rowKey="id"
        size="middle"
      />

      <Drawer
        destroyOnHidden
        onClose={closeLogDetail}
        open={drawerOpen && isCurrentContext}
        title={t("knowledgeNetwork.actionTypeExecutionLogDetailTitle")}
        width={960}
      >
        {drawerLoading ? (
          <div className={styles.drawerLoading}>
            <Spin />
          </div>
        ) : currentLog ? (
          <div className={styles.drawerBody}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="ID">{currentLog.id}</Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionRunStatus")}>
                {getStatusLabel(currentLog.status)}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionTriggerType")}>
                {getTriggerLabel(currentLog.triggerType)}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionStartTime")}>
                {currentLog.startTime}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionEndTime")}>
                {currentLog.endTime || "--"}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionDuration")}>
                {formatDuration(currentLog.durationMs)}
              </Descriptions.Item>
              <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionExecutor")}>
                {currentLog.executorName || "--"}
              </Descriptions.Item>
            </Descriptions>

            <div className={styles.resultHeader}>
              <h4>{t("knowledgeNetwork.actionTypeExecutionResultTitle")}</h4>
              <Space wrap>
                <Tooltip title={t("knowledgeNetwork.actionTypeIndexSyncHint")}>
                  <QuestionCircleOutlined
                    aria-label={t("knowledgeNetwork.actionTypeIndexSyncHint")}
                  />
                </Tooltip>
                <AppButton
                  size="small"
                  disabled={syncRetrying}
                  loading={resultsLoading}
                  onClick={() => setResultRefresh((value) => value + 1)}
                >
                  {t("knowledgeNetwork.actionTypeExecutionRefreshResults")}
                </AppButton>
                {canRetrySync ? (
                  <AppButton
                    size="small"
                    type="primary"
                    loading={syncRetrying}
                    disabled={resultsLoading || resultsFailed}
                    onClick={() => void retrySync()}
                  >
                    {t("knowledgeNetwork.actionTypeIndexSyncRetry")}
                  </AppButton>
                ) : null}
                <Select
                  aria-label={t("knowledgeNetwork.actionTypeExecutionResultStatusFilter")}
                  className={styles.filterSelect}
                  onChange={(value: ActionTypeExecutionResultStatusFilter) => {
                    setResultStatus(value);
                    setResultPage(1);
                  }}
                  options={resultStatusOptions}
                  value={resultStatus}
                />
              </Space>
            </div>
            {resultsFailed && shownResultRows.length > 0 ? (
              <Typography.Text type="secondary">
                {t("knowledgeNetwork.actionTypeExecutionResultsStale")}
              </Typography.Text>
            ) : null}
            {browsableResults ? (
              <div className={styles.resultHint}>
                {t("knowledgeNetwork.actionTypeExecutionResultWindowHint", browsableResults)}
              </div>
            ) : null}
            <Table<ActionTypeExecutionLogResultItem>
              bordered
              columns={[
                {
                  dataIndex: "displayName",
                  key: "displayName",
                  title: t("knowledgeNetwork.actionTypeExecutionResultTarget"),
                  width: 200,
                  render: (value?: string) => (
                    <Typography.Text style={{ maxWidth: "100%" }} ellipsis={{ tooltip: value }}>
                      {value || "—"}
                    </Typography.Text>
                  ),
                },
                {
                  dataIndex: "status",
                  key: "status",
                  render: (value: ActionTypeExecutionLogResultStatus) =>
                    getResultStatusLabel(value),
                  title: t("knowledgeNetwork.actionTypeExecutionRunStatus"),
                },
                {
                  key: "indexSync",
                  title: t("knowledgeNetwork.actionTypeIndexSync"),
                  width: 240,
                  render: (_, row) => {
                    const status = row.indexSync?.status;
                    const known = [
                      "pending",
                      "submitted",
                      "retrying",
                      "completed",
                      "failed",
                      "invalid",
                    ].includes(status ?? "");
                    return (
                      <Space direction="vertical" size={4}>
                        <Tooltip
                          title={
                            !known
                              ? t("knowledgeNetwork.actionTypeIndexSyncUnreportedHint")
                              : undefined
                          }
                        >
                          <Tag
                            color={
                              status === "completed"
                                ? "success"
                                : status === "failed"
                                  ? "error"
                                  : status === "invalid"
                                    ? "warning"
                                    : known
                                      ? "processing"
                                      : undefined
                            }
                          >
                            {t(
                              `knowledgeNetwork.actionTypeIndexSync${known ? status!.charAt(0).toUpperCase() + status!.slice(1) : "Unreported"}`,
                            )}
                          </Tag>
                        </Tooltip>
                        {row.indexSync?.error ? (
                          <Typography.Text type="secondary">{row.indexSync.error}</Typography.Text>
                        ) : null}
                        {!known ? (
                          <Typography.Text type="secondary">
                            {t("knowledgeNetwork.actionTypeIndexSyncUnreportedDescription")}
                          </Typography.Text>
                        ) : null}
                      </Space>
                    );
                  },
                },
                {
                  dataIndex: "durationMs",
                  key: "durationMs",
                  render: (value?: number) => formatDuration(value ?? 0),
                  title: t("knowledgeNetwork.actionTypeExecutionDuration"),
                },
                {
                  dataIndex: "errorMessage",
                  key: "errorMessage",
                  render: (value?: string) => value || "--",
                  title: t("knowledgeNetwork.actionTypeExecutionResultError"),
                },
              ]}
              tableLayout="fixed"
              dataSource={shownResultRows}
              loading={resultsLoading}
              locale={{ emptyText: t("knowledgeNetwork.actionTypeExecutionResultEmpty") }}
              onChange={(pagination) => {
                const nextPageSize = pagination.pageSize ?? resultPageSize;
                setResultPage(nextPageSize === resultPageSize ? (pagination.current ?? 1) : 1);
                setResultPageSize(nextPageSize);
              }}
              pagination={{
                current: resultPage,
                pageSize: resultPageSize,
                pageSizeOptions: RESULT_PAGE_SIZE_OPTIONS,
                showSizeChanger: true,
                total: shownResultTotal,
              }}
              rowKey={(record) =>
                `${record.displayName ?? "row"}-${shownResultRows.indexOf(record)}`
              }
              size="small"
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

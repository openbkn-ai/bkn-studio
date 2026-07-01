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
  SearchOutlined,
} from "@ant-design/icons";
import { Badge, Descriptions, Drawer, Dropdown, Empty, Input, Select, Spin, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  cancelKnowledgeNetworkActionTypeExecution,
  getKnowledgeNetworkActionTypeExecutionLogDetail,
  listKnowledgeNetworkActionTypeExecutionLogs,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeExecutionLog,
  ActionTypeExecutionLogDetail,
  ActionTypeExecutionStatus,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeTaskManagementPanel.module.css";

type ActionTypeTaskManagementPanelProps = {
  actionTypeId: string;
  networkId: string;
  refreshToken?: number;
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

function RunResultSummary({ failedCount, successCount }: { failedCount: number; successCount: number }) {
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
  networkId,
  refreshToken = 0,
}: ActionTypeTaskManagementPanelProps) {
  const { t } = useTranslation();
  const { modal, message } = useAppServices();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActionTypeExecutionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActionTypeExecutionStatus | "">("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [currentLog, setCurrentLog] = useState<ActionTypeExecutionLogDetail | null>(null);

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
      { label: t("knowledgeNetwork.actionTypeExecutionTriggerSchedule"), value: "schedule" },
      { label: t("knowledgeNetwork.actionTypeExecutionTriggerEvent"), value: "event" },
    ],
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

  const openLogDetail = async (record: ActionTypeExecutionLog) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setCurrentLog(null);

    try {
      const detail = await getKnowledgeNetworkActionTypeExecutionLogDetail(networkId, record.id);
      setCurrentLog(detail);
    } catch (error) {
      setCurrentLog(null);
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setDrawerLoading(false);
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

    if (record.status === "pending" || record.status === "running") {
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
      render: (value: string) =>
        value === "manual"
          ? t("knowledgeNetwork.actionTypeExecutionTriggerManual")
          : value === "schedule"
            ? t("knowledgeNetwork.actionTypeExecutionTriggerSchedule")
            : value === "event"
              ? t("knowledgeNetwork.actionTypeExecutionTriggerEvent")
              : value || "--",
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
        <AppButton icon={<ReloadOutlined />} onClick={() => void loadLogs()}>
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
        destroyOnClose
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        title={t("knowledgeNetwork.actionTypeExecutionLogDetailTitle")}
        width={720}
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
                {currentLog.triggerType}
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

            <h4>{t("knowledgeNetwork.actionTypeExecutionResultTitle")}</h4>
            <Table
              bordered
              columns={[
                {
                  dataIndex: "displayName",
                  key: "displayName",
                  title: t("knowledgeNetwork.actionTypeExecutionResultTarget"),
                },
                {
                  dataIndex: "status",
                  key: "status",
                  render: (value: "failed" | "success") =>
                    value === "success"
                      ? t("knowledgeNetwork.actionTypeExecutionResultSuccess")
                      : t("knowledgeNetwork.actionTypeExecutionResultFailed"),
                  title: t("knowledgeNetwork.actionTypeExecutionRunStatus"),
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
              dataSource={currentLog.results ?? []}
              locale={{ emptyText: t("knowledgeNetwork.actionTypeExecutionResultEmpty") }}
              pagination={false}
              rowKey={(record, index) => `${record.displayName ?? "row"}-${index}`}
              size="small"
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Alert, Descriptions, Drawer, Empty, Progress, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getDataConnectDiscoverTask } from "@/modules/data-connect/services/discover.service";
import type {
  DataConnectDiscoverSchedule,
  DataConnectDiscoverTask,
} from "@/modules/data-connect/types/discover";
import { formatDiscoverTaskTime } from "@/modules/data-connect/utils/discover-task-time";

import styles from "@/modules/data-catalog/components/BuildTaskDetailDrawer.module.css";
import sharedStyles from "@/modules/data-catalog/components/shared.module.css";

const EMPTY_VALUE = "-";

function priorityLabel(priority: number, t: (key: string, options?: Record<string, unknown>) => string) {
  const level = priority <= 10 ? "low" : priority >= 30 ? "high" : "normal";
  return t(`dataConnect.discoverTaskPriorities.${level}`, { priority });
}

function priorityTag(priority: number, t: (key: string, options?: Record<string, unknown>) => string) {
  const level = priority <= 10 ? "low" : priority >= 30 ? "high" : "normal";
  return (
    <Tag color={level === "high" ? "error" : level === "low" ? "default" : "processing"}>
      {priorityLabel(priority, t)}
    </Tag>
  );
}

function statusTag(
  status: DataConnectDiscoverTask["status"],
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const statusClass =
    status === "completed"
      ? sharedStyles.taskSucceeded
      : status === "failed"
        ? sharedStyles.taskFailed
        : status === "cancelled"
          ? sharedStyles.taskPending
          : sharedStyles.taskRunning;
  return <span className={[sharedStyles.tag, statusClass].join(" ")}>{t(`dataConnect.discoverTaskStatuses.${status}`)}</span>;
}

type DataConnectDiscoverTaskDrawerProps = {
  catalogs: Array<{ id: string; name: string }>;
  onClose: () => void;
  open: boolean;
  schedules: DataConnectDiscoverSchedule[];
  taskId: string;
};

type DiscoverResultRow = {
  count: number;
  key: string;
  metric: string;
};

export function DataConnectDiscoverTaskDrawer({
  catalogs,
  onClose,
  open,
  schedules,
  taskId,
}: DataConnectDiscoverTaskDrawerProps) {
  const { t } = useTranslation();
  const [task, setTask] = useState<DataConnectDiscoverTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setTask(null);

      try {
        setTask(await getDataConnectDiscoverTask(taskId));
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, taskId]);

  const catalogName =
    task?.catalogName ||
    catalogs.find((item) => item.id === task?.catalogId)?.name ||
    task?.catalogId ||
    EMPTY_VALUE;
  const scheduleName = task?.scheduleId
    ? (schedules.find((item) => item.id === task.scheduleId)?.name ||
      task.scheduleId)
    : EMPTY_VALUE;
  const resultRows: DiscoverResultRow[] = task?.result
    ? [
        { key: "new", metric: t("dataConnect.discoverResultNew"), count: task.result.newCount },
        { key: "updated", metric: t("dataConnect.discoverResultUpdated"), count: task.result.updatedCount },
        { key: "stale", metric: t("dataConnect.discoverResultStale"), count: task.result.staleCount },
        { key: "restored", metric: t("dataConnect.discoverResultRestored"), count: task.result.restoredCount },
        { key: "unchanged", metric: t("dataConnect.discoverResultUnchanged"), count: task.result.unchangedCount },
        { key: "failed", metric: t("dataConnect.discoverResultFailed"), count: task.result.failedCount },
      ]
    : [];
  const resultColumns: ColumnsType<DiscoverResultRow> = [
    { dataIndex: "metric", key: "metric", title: t("dataConnect.discoverResultMetric") },
    { align: "right", dataIndex: "count", key: "count", title: t("dataConnect.discoverResultCount"), width: 120 },
  ];

  return (
    <Drawer
      className={styles.drawer}
      destroyOnClose
      loading={loading}
      onClose={onClose}
      open={open}
      styles={{
        body: { padding: 16 },
        header: { padding: "12px 16px" },
      }}
      title={`${t("dataConnect.discoverTaskDetailTitle")} · ${taskId}`}
      width={560}
    >
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && !task ? (
        <Empty description={t("common.notFound")} />
      ) : null}
      {!loading && !loadError && task ? (
        <div className={styles.drawerContent}>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.status")}</h3>
            <div className={styles.statusRow}>
              <Tag color="processing">{t(`dataConnect.discoverStrategies.${task.strategy}`)}</Tag>
              <Tag color="processing">{t(`dataConnect.discoverTriggerTypes.${task.triggerType}`)}</Tag>
              {priorityTag(task.queuePriority, t)}
              {statusTag(task.status, t)}
            </div>
            <Progress
              percent={task.progress}
              showInfo
              size="small"
              status={task.status === "failed" ? "exception" : undefined}
            />
            {task.status === "failed" ? (
              <div className={sharedStyles.calloutWarn} style={{ marginTop: 12 }}>
                <ExclamationCircleOutlined />
                <span className={styles.failureContent}>
                  <b>{t("dataConnect.discoverMessage")}</b>
                  <span>{task.message || EMPTY_VALUE}</span>
                </span>
              </div>
            ) : (
              <div className={styles.metaLine}>
                {t("dataConnect.discoverMessage")}: {task.message || EMPTY_VALUE}
              </div>
            )}
          </section>

          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.task")}</h3>
            <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
              <Descriptions.Item label="ID">{task.id || EMPTY_VALUE}</Descriptions.Item>
              <Descriptions.Item label={t("dataCatalog.taskManagement.columns.catalog")}>{catalogName}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverCatalogId")}>{task.catalogId || EMPTY_VALUE}</Descriptions.Item>
              <Descriptions.Item label={t("dataCatalog.taskManagement.columns.resource")}>{task.resourceName || task.resourceId || EMPTY_VALUE}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverResourceId")}>{task.resourceId || EMPTY_VALUE}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverStrategy")}>
                {t(`dataConnect.discoverStrategies.${task.strategy}`)}
              </Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverTriggerType")}>
                {t(`dataConnect.discoverTriggerTypes.${task.triggerType}`)}
              </Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverQueuePriority")}>
                {priorityTag(task.queuePriority, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverScheduleName")}>{scheduleName}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverScheduleId")}>{task.scheduleId || EMPTY_VALUE}</Descriptions.Item>
            </Descriptions>
          </section>

          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.execution")}</h3>
            <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
              <Descriptions.Item label={t("dataConnect.discoverStartTime")}>{formatDiscoverTaskTime(task.startTime)}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverLastProgressTime")}>{formatDiscoverTaskTime(task.lastProgressTime)}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverFinishTime")}>{formatDiscoverTaskTime(task.finishTime)}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverMessage")}>{task.message || EMPTY_VALUE}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverResult")}>
                {task.result ? <div>
                  <Table<DiscoverResultRow>
                    className={styles.resultTable}
                    columns={resultColumns}
                    dataSource={resultRows}
                    pagination={false}
                    rowKey="key"
                    size="small"
                  />
                  <div className={styles.metaLine}>{t("dataConnect.discoverResultMessage")}: {task.result.message || EMPTY_VALUE}</div>
                </div> : EMPTY_VALUE}
              </Descriptions.Item>
            </Descriptions>
          </section>

          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.audit")}</h3>
            <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
              <Descriptions.Item label={t("dataConnect.creator")}>{task.creatorName || EMPTY_VALUE}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.createTime")}>{formatDiscoverTaskTime(task.createTime)}</Descriptions.Item>
            </Descriptions>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

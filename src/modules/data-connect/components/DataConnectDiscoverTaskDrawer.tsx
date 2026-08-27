/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Descriptions, Drawer, Empty, Progress, Tag } from "antd";
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
  const color =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "error"
        : status === "cancelled"
          ? "default"
          : "processing";
  return <Tag color={color}>{t(`dataConnect.discoverTaskStatuses.${status}`)}</Tag>;
}

type DataConnectDiscoverTaskDrawerProps = {
  catalogs: Array<{ id: string; name: string }>;
  onClose: () => void;
  open: boolean;
  schedules: DataConnectDiscoverSchedule[];
  taskId: string;
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
    task?.catalogName ??
    catalogs.find((item) => item.id === task?.catalogId)?.name ??
    task?.catalogId ??
    "-";
  const scheduleName = task?.scheduleId
    ? (schedules.find((item) => item.id === task.scheduleId)?.name ??
      task.scheduleId)
    : "-";

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
            <h3 className={styles.sectionTitle}>{t("common.status")}</h3>
            <div className={styles.statusRow}>
              <Tag color="processing">{t(`dataConnect.discoverStrategies.${task.strategy}`)}</Tag>
              {statusTag(task.status, t)}
            </div>
            <Progress
              percent={task.progress}
              showInfo
              size="small"
              status={task.status === "failed" ? "exception" : undefined}
            />
          </section>

          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataCatalog.taskManagement.details.taskInformation")}</h3>
            <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
              <Descriptions.Item label="ID">{task.id}</Descriptions.Item>
              <Descriptions.Item label={t("dataCatalog.taskManagement.columns.catalog")}>{catalogName}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverCatalogId")}>{task.catalogId || "-"}</Descriptions.Item>
              <Descriptions.Item label={t("dataCatalog.build.resource")}>{task.resourceName || task.resourceId || "-"}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverResourceId")}>{task.resourceId || "-"}</Descriptions.Item>
              {task.triggerType === "scheduled" ? <>
                <Descriptions.Item label={t("dataConnect.discoverScheduleName")}>{scheduleName}</Descriptions.Item>
                <Descriptions.Item label={t("dataConnect.discoverScheduleId")}>{task.scheduleId || "-"}</Descriptions.Item>
              </> : null}
              <Descriptions.Item label={t("dataConnect.discoverTriggerType")}>
                {t(`dataConnect.discoverTriggerTypes.${task.triggerType}`)}
              </Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverQueuePriority")}>
                {priorityTag(task.queuePriority, t)}
              </Descriptions.Item>
            </Descriptions>
          </section>

          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataConnect.discoverTaskExecution")}</h3>
            <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
              <Descriptions.Item label={t("dataConnect.discoverStartTime")}>{formatDiscoverTaskTime(task.startTime)}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverLastProgressTime")}>{formatDiscoverTaskTime(task.lastProgressTime)}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverFinishTime")}>{formatDiscoverTaskTime(task.finishTime)}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.discoverMessage")}>{task.message || "-"}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.creator")}>{task.creatorName || "-"}</Descriptions.Item>
              <Descriptions.Item label={t("dataConnect.createTime")}>{formatDiscoverTaskTime(task.createTime)}</Descriptions.Item>
            </Descriptions>
          </section>

          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataConnect.discoverResult")}</h3>
            {task.result ? (
              <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
                <Descriptions.Item label={t("dataConnect.discoverResultNew")}>{task.result.newCount}</Descriptions.Item>
                <Descriptions.Item label={t("dataConnect.discoverResultUpdated")}>{task.result.updatedCount}</Descriptions.Item>
                <Descriptions.Item label={t("dataConnect.discoverResultStale")}>{task.result.staleCount}</Descriptions.Item>
                <Descriptions.Item label={t("dataConnect.discoverResultRestored")}>{task.result.restoredCount}</Descriptions.Item>
                <Descriptions.Item label={t("dataConnect.discoverResultUnchanged")}>{task.result.unchangedCount}</Descriptions.Item>
                <Descriptions.Item label={t("dataConnect.discoverResultFailed")}>{task.result.failedCount}</Descriptions.Item>
                <Descriptions.Item label={t("dataConnect.discoverResultMessage")}>{task.result.message || "-"}</Descriptions.Item>
              </Descriptions>
            ) : <div className={styles.metaLine}>{t("dataConnect.discoverResultEmpty")}</div>}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

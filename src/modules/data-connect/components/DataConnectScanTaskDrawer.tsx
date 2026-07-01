/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Descriptions, Drawer, Empty, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getDataConnectScanTask } from "@/modules/data-connect/services/scan.service";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";
import type {
  DataConnectScanSchedule,
  DataConnectScanTask,
} from "@/modules/data-connect/types/scan";

import styles from "./DataConnectScanTaskDrawer.module.css";

type DataConnectScanTaskDrawerProps = {
  catalogs: DataConnectRecord[];
  onClose: () => void;
  open: boolean;
  schedules: DataConnectScanSchedule[];
  taskId: string;
};

const statusColorMap: Record<DataConnectScanTask["status"], string> = {
  pending: "default",
  running: "processing",
  completed: "success",
  failed: "error",
};

export function DataConnectScanTaskDrawer({
  catalogs,
  onClose,
  open,
  schedules,
  taskId,
}: DataConnectScanTaskDrawerProps) {
  const { t } = useTranslation();
  const [task, setTask] = useState<DataConnectScanTask | null>(null);
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
        setTask(await getDataConnectScanTask(taskId));
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, taskId]);

  const catalogName =
    catalogs.find((item) => item.id === task?.catalogId)?.name ?? task?.catalogId ?? "-";
  const scheduleName =
    schedules.find((item) => item.id === task?.scheduleId)?.name ?? task?.scheduleId ?? "-";

  return (
    <Drawer
      destroyOnClose
      loading={loading}
      onClose={onClose}
      open={open}
      title={t("dataConnect.scanTaskDetailTitle")}
      width={640}
    >
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && !task ? (
        <Empty description={t("common.notFound")} />
      ) : null}
      {!loading && !loadError && task ? (
        <div className={styles.drawerContent}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <div>
                <h2 className={styles.summaryTitle}>{task.scheduleId ? scheduleName : t("dataConnect.scanManualTask")}</h2>
                <p className={styles.summaryDescription}>{catalogName}</p>
              </div>
              <div className={styles.summaryStatus}>
                <Tag color={statusColorMap[task.status]}>
                  {t(`dataConnect.scanTaskStatuses.${task.status}`)}
                </Tag>
                <Tag>{t(`dataConnect.scanTriggerTypes.${task.triggerType}`)}</Tag>
              </div>
            </div>
            <div className={styles.metricRow}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>{t("dataConnect.scanProgress")}</span>
                <strong className={styles.metricValue}>{task.progress}%</strong>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>{t("dataConnect.scanStrategy")}</span>
                <strong className={styles.metricValue}>{t(`dataConnect.scanStrategies.${task.strategy}`)}</strong>
              </div>
            </div>
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
            <Descriptions
              bordered
              className={styles.descriptionBlock}
              column={1}
              items={[
                {
                  key: "id",
                  label: "ID",
                  children: task.id,
                },
                {
                  key: "catalog",
                  label: t("dataConnect.scanCatalog"),
                  children: catalogName,
                },
                {
                  key: "schedule",
                  label: t("dataConnect.scanScheduleName"),
                  children: task.scheduleId ? scheduleName : t("dataConnect.scanManualTask"),
                },
                {
                  key: "creator",
                  label: t("dataConnect.creator"),
                  children: task.creatorName,
                },
                {
                  key: "createTime",
                  label: t("dataConnect.createTime"),
                  children: task.createTime,
                },
              ]}
            />
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataConnect.scanTaskDetailTitle")}</h3>
            <Descriptions
              bordered
              className={styles.descriptionBlock}
              column={1}
              items={[
                {
                  key: "status",
                  label: t("dataConnect.scanTaskStatus"),
                  children: (
                    <Tag color={statusColorMap[task.status]}>
                      {t(`dataConnect.scanTaskStatuses.${task.status}`)}
                    </Tag>
                  ),
                },
                {
                  key: "triggerType",
                  label: t("dataConnect.scanTriggerType"),
                  children: t(`dataConnect.scanTriggerTypes.${task.triggerType}`),
                },
                {
                  key: "strategy",
                  label: t("dataConnect.scanStrategy"),
                  children: t(`dataConnect.scanStrategies.${task.strategy}`),
                },
                {
                  key: "progress",
                  label: t("dataConnect.scanProgress"),
                  children: `${task.progress}%`,
                },
                {
                  key: "message",
                  label: t("dataConnect.scanMessage"),
                  children: task.message || "-",
                },
                {
                  key: "startTime",
                  label: t("dataConnect.scanStartTime"),
                  children: task.startTime,
                },
                {
                  key: "finishTime",
                  label: t("dataConnect.scanFinishTime"),
                  children: task.finishTime,
                },
              ]}
            />
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Drawer, Empty } from "antd";
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
    catalogs.find((item) => item.id === task?.catalogId)?.name ??
    task?.catalogId ??
    "-";
  const scheduleName = task?.scheduleId
    ? (schedules.find((item) => item.id === task.scheduleId)?.name ??
      task.scheduleId)
    : t("dataConnect.scanManualTask");

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
      title={t("dataConnect.scanTaskDetailTitle")}
      width={520}
    >
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && !task ? (
        <Empty description={t("common.notFound")} />
      ) : null}
      {!loading && !loadError && task ? (
        <div className={styles.content}>
          <section className={styles.headerCard}>
            <div className={styles.headerRow}>
              <span className={styles.headerLabel}>{t("dataConnect.scanScheduleName")}</span>
              <span className={styles.headerValue}>{scheduleName}</span>
            </div>
            <div className={styles.headerRow}>
              <span className={styles.headerLabel}>{t("dataConnect.scanCatalog")}</span>
              <span className={styles.headerValue}>{catalogName}</span>
            </div>
            <div className={styles.headerMeta}>
              <div className={styles.headerRow}>
                <span className={styles.headerLabel}>{t("dataConnect.scanTaskStatus")}</span>
                <span className={styles.headerValue}>
                  {t(`dataConnect.scanTaskStatuses.${task.status}`)}
                </span>
              </div>
              <div className={styles.headerRow}>
                <span className={styles.headerLabel}>{t("dataConnect.scanTriggerType")}</span>
                <span className={styles.headerValue}>
                  {t(`dataConnect.scanTriggerTypes.${task.triggerType}`)}
                </span>
              </div>
              <div className={styles.headerRow}>
                <span className={styles.headerLabel}>{t("dataConnect.scanProgress")}</span>
                <span className={styles.headerValue}>{task.progress}%</span>
              </div>
            </div>
          </section>

          <section className={styles.detailCard}>
            <div className={styles.detailGrid}>
              <DetailItem label="ID" value={task.id} />
              <DetailItem
                label={t("dataConnect.scanStrategy")}
                value={t(`dataConnect.scanStrategies.${task.strategy}`)}
              />
              <DetailItem
                label={t("dataConnect.scanStartTime")}
                value={task.startTime || "-"}
              />
              <DetailItem
                label={t("dataConnect.scanFinishTime")}
                value={task.finishTime || "-"}
              />
              <DetailItem
                label={t("dataConnect.creator")}
                value={task.creatorName || "-"}
              />
              <DetailItem
                label={t("dataConnect.createTime")}
                value={task.createTime || "-"}
              />
              <DetailItem
                full
                label={t("dataConnect.scanMessage")}
                value={task.message || "-"}
              />
            </div>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

function DetailItem({
  full = false,
  label,
  value,
}: {
  full?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={full ? `${styles.detailItem} ${styles.detailItemFull}` : styles.detailItem}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue} title={value}>
        {value}
      </span>
    </div>
  );
}

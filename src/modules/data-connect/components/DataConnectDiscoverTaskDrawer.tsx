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
import { getDataConnectDiscoverTask } from "@/modules/data-connect/services/discover.service";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";
import type {
  DataConnectDiscoverSchedule,
  DataConnectDiscoverTask,
} from "@/modules/data-connect/types/discover";

import styles from "./DataConnectDiscoverTaskDrawer.module.css";

type DataConnectDiscoverTaskDrawerProps = {
  catalogs: DataConnectRecord[];
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
    catalogs.find((item) => item.id === task?.catalogId)?.name ??
    task?.catalogId ??
    "-";
  const scheduleName = task?.scheduleId
    ? (schedules.find((item) => item.id === task.scheduleId)?.name ??
      task.scheduleId)
    : t("dataConnect.discoverManualTask");

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
      title={t("dataConnect.discoverTaskDetailTitle")}
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
              <span className={styles.headerLabel}>{t("dataConnect.discoverScheduleName")}</span>
              <span className={styles.headerValue}>{scheduleName}</span>
            </div>
            <div className={styles.headerRow}>
              <span className={styles.headerLabel}>{t("dataConnect.discoverCatalog")}</span>
              <span className={styles.headerValue}>{catalogName}</span>
            </div>
            <div className={styles.headerMeta}>
              <div className={styles.headerRow}>
                <span className={styles.headerLabel}>{t("dataConnect.discoverTaskStatus")}</span>
                <span className={styles.headerValue}>
                  {t(`dataConnect.discoverTaskStatuses.${task.status}`)}
                </span>
              </div>
              <div className={styles.headerRow}>
                <span className={styles.headerLabel}>{t("dataConnect.discoverTriggerType")}</span>
                <span className={styles.headerValue}>
                  {t(`dataConnect.discoverTriggerTypes.${task.triggerType}`)}
                </span>
              </div>
              <div className={styles.headerRow}>
                <span className={styles.headerLabel}>{t("dataConnect.discoverProgress")}</span>
                <span className={styles.headerValue}>{task.progress}%</span>
              </div>
            </div>
          </section>

          <section className={styles.detailCard}>
            <div className={styles.detailGrid}>
              <DetailItem label="ID" value={task.id} />
              <DetailItem
                label={t("dataConnect.discoverStrategy")}
                value={t(`dataConnect.discoverStrategies.${task.strategy}`)}
              />
              <DetailItem
                label={t("dataConnect.discoverStartTime")}
                value={task.startTime || "-"}
              />
              <DetailItem
                label={t("dataConnect.discoverFinishTime")}
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
                label={t("dataConnect.discoverMessage")}
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

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Descriptions, Drawer, Empty, Spin } from "antd";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { HealthCheckScheduleFormModal } from "@/modules/data-connect/components/HealthCheckScheduleFormModal";
import {
  getDataConnectHealthCheckSchedule,
  getDataConnectRecord,
  updateDataConnectHealthCheckSchedule,
} from "@/modules/data-connect/services/data-connect.service";
import type {
  DataConnectConnectorType,
  DataConnectHealthCheckSchedule,
  DataConnectRecord,
} from "@/modules/data-connect/types/data-connect";

import styles from "./DataConnectDetailDrawer.module.css";

type DataConnectDetailDrawerProps = {
  connectorTypes: DataConnectConnectorType[];
  onClose: () => void;
  open: boolean;
  recordId: string;
};

export function DataConnectDetailDrawer({
  connectorTypes,
  onClose,
  open,
  recordId,
}: DataConnectDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [record, setRecord] = useState<DataConnectRecord | null>(null);
  const [schedule, setSchedule] =
    useState<DataConnectHealthCheckSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleUpdating, setScheduleUpdating] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setScheduleError(null);
      setRecord(null);
      setSchedule(null);

      const [recordResult, scheduleResult] = await Promise.allSettled([
        getDataConnectRecord(recordId),
        getDataConnectHealthCheckSchedule(recordId),
      ]);

      if (!active) {
        return;
      }

      if (recordResult.status === "fulfilled") {
        setRecord(recordResult.value);
      } else {
        setLoadError(extractRequestErrorMessage(recordResult.reason));
      }

      if (scheduleResult.status === "fulfilled") {
        setSchedule(scheduleResult.value);
      } else {
        setScheduleError(extractRequestErrorMessage(scheduleResult.reason));
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [open, recordId]);

  const connectorTypeName = useMemo(
    () =>
      connectorTypes.find((item) => item.type === record?.connectorType)?.name ??
      record?.connectorType ??
      "-",
    [connectorTypes, record?.connectorType],
  );

  const selectedConnectorType = useMemo(
    () => connectorTypes.find((item) => item.type === record?.connectorType),
    [connectorTypes, record?.connectorType],
  );

  return (
    <Drawer
      afterOpenChange={(visible) => {
        if (!visible) {
          setScheduleModalOpen(false);
        }
      }}
      className={styles.drawer}
      destroyOnClose
      onClose={onClose}
      open={open}
      styles={{
        body: { padding: 16 },
        header: { padding: "12px 16px" },
      }}
      title={t("dataConnect.detailTitle")}
      width={560}
    >
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && !record ? <Empty description={t("common.notFound")} /> : null}
      {!loading && !loadError && record ? (
        <div className={styles.drawerContent}>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
            <Descriptions
              bordered
              className={styles.descriptionBlock}
              column={2}
              items={[
                {
                  key: "name",
                  label: t("dataConnect.name"),
                  children: record.name,
                },
                {
                  key: "description",
                  label: t("common.description"),
                  children: record.description || "-",
                },
                {
                  key: "connectorType",
                  label: t("dataConnect.connectorType"),
                  children: connectorTypeName,
                },
                {
                  key: "category",
                  label: t("common.category"),
                  children: t(`dataConnect.categories.${record.category}`),
                },
                {
                  key: "mode",
                  label: t("common.mode"),
                  children: t(`dataConnect.modes.${record.mode}`),
                },
                {
                  key: "status",
                  label: t("common.status"),
                  children: record.enabled ? t("common.enabled") : t("common.disabled"),
                },
                {
                  key: "health",
                  label: t("common.healthStatus"),
                  children: t(`dataConnect.healthStatuses.${record.healthStatus}`),
                },
                {
                  key: "tags",
                  label: t("dataConnect.tags"),
                  children: record.tags.length > 0 ? record.tags.join(" / ") : "-",
                },
                {
                  key: "creator",
                  label: t("dataConnect.creator"),
                  children: record.creatorName,
                },
                {
                  key: "createTime",
                  label: t("dataConnect.createTime"),
                  children: record.createTime,
                },
                {
                  key: "updater",
                  label: t("dataConnect.updater"),
                  children: record.updaterName,
                },
                {
                  key: "updateTime",
                  label: t("dataConnect.updateTime"),
                  children: record.updateTime,
                },
              ]}
            />
          </section>
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                {t("dataConnect.healthCheckSchedule.title")}
              </h3>
              {schedule ? (
                <PermissionGate permissions="catalog:modify">
                  <AppButton
                    onClick={() => {
                      setScheduleModalOpen(true);
                    }}
                    size="small"
                    type="link"
                  >
                    {t("common.edit")}
                  </AppButton>
                </PermissionGate>
              ) : null}
            </div>
            {scheduleError ? (
              <Alert message={scheduleError} showIcon type="error" />
            ) : schedule ? (
              <Descriptions
                bordered
                className={styles.descriptionBlock}
                column={1}
                items={[
                  {
                    key: "mode",
                    label: t("dataConnect.healthCheckSchedule.mode"),
                    children: t(
                      `dataConnect.healthCheckSchedule.modes.${schedule.mode}`,
                    ),
                  },
                  {
                    key: "cronExpr",
                    label: t("dataConnect.healthCheckSchedule.cronExpr"),
                    children:
                      schedule.mode === "inherit"
                        ? t("dataConnect.healthCheckSchedule.platformDefault")
                        : schedule.cronExpr || "-",
                  },
                  {
                    key: "lastRun",
                    label: t("dataConnect.healthCheckSchedule.lastRun"),
                    children: schedule.lastRun,
                  },
                  {
                    key: "nextRun",
                    label: t("dataConnect.healthCheckSchedule.nextRun"),
                    children: schedule.nextRun,
                  },
                ]}
              />
            ) : (
              <Spin size="small" />
            )}
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataConnect.healthResult")}</h3>
            <Descriptions
              bordered
              className={styles.descriptionBlock}
              column={1}
              items={[
                {
                  key: "lastCheckTime",
                  label: t("dataConnect.lastCheckTime"),
                  children: record.lastCheckTime,
                },
                {
                  key: "healthResult",
                  label: t("dataConnect.healthResult"),
                  children: record.healthCheckResult || "-",
                },
              ]}
            />
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataConnect.connectorConfig")}</h3>
            {Object.entries(record.connectorConfig).length > 0 ? (
              <div className={styles.configGrid}>
                {buildConfigEntries(record, t, selectedConnectorType).map((item) => (
                  <div className={styles.configItem} key={item.key}>
                    <span className={styles.configLabel}>{item.label}</span>
                    {item.description ? (
                      <span className={styles.configHint}>{item.description}</span>
                    ) : null}
                    <span className={styles.configValue}>{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                description={t("dataConnect.noConnectorConfig")}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </section>
        </div>
      ) : null}
      {schedule ? (
        <HealthCheckScheduleFormModal
          loading={scheduleUpdating}
          onCancel={() => {
            setScheduleModalOpen(false);
          }}
          onSubmit={async (input) => {
            try {
              setScheduleUpdating(true);
              const nextSchedule =
                await updateDataConnectHealthCheckSchedule(recordId, input);
              setSchedule(nextSchedule);
              setScheduleModalOpen(false);
              message.success(t("common.success"));
            } catch (error) {
              void message.error(extractRequestErrorMessage(error));
            } finally {
              setScheduleUpdating(false);
            }
          }}
          open={scheduleModalOpen}
          schedule={schedule}
        />
      ) : null}
    </Drawer>
  );
}

function formatConfigValue(value: unknown, t: TFunction) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? t("dataConnect.booleanTrue") : t("dataConnect.booleanFalse");
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function buildConfigEntries(
  record: DataConnectRecord,
  t: TFunction,
  connectorType?: DataConnectConnectorType,
) {
  const config = record.connectorConfig ?? {};
  const fieldConfig = connectorType?.fieldConfig ?? {};
  const keys = Object.keys(config).sort((left, right) => {
    const leftRank = configFieldOrderRank(left);
    const rightRank = configFieldOrderRank(right);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftName = fieldConfig[left]?.name ?? humanizeConfigKey(left, t);
    const rightName = fieldConfig[right]?.name ?? humanizeConfigKey(right, t);
    return leftName.localeCompare(rightName, "zh-CN");
  });

  return keys.map((key) => {
    const configItem = fieldConfig[key];
    return {
      description: configItem?.description?.trim() || "",
      key,
      label: configItem?.name?.trim() || humanizeConfigKey(key, t),
      value: configItem?.encrypted ? "******" : formatConfigValue(config[key], t),
    };
  });
}

function configFieldOrderRank(key: string) {
  const normalized = key.trim().toLowerCase();
  const rankMap: Record<string, number> = {
    host: 1,
    hostname: 1,
    server: 1,
    user: 2,
    username: 2,
    account: 2,
    port: 3,
    database: 4,
    db: 4,
    database_list: 4,
    databases: 4,
    schema: 4,
    schema_list: 4,
  };

  return rankMap[normalized] ?? 100;
}

function humanizeConfigKey(key: string, t: TFunction) {
  const normalized = key.trim().toLowerCase();
  const fallback = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (char) => char.toUpperCase());

  return t(`dataConnect.connectorFieldLabels.${normalized}`, {
    defaultValue: fallback,
  });
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Descriptions, Drawer, Empty, Space, Spin, Tag } from "antd";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import {
  extractRequestErrorMessage,
  isRequestConflict,
} from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { HealthCheckScheduleFormModal } from "@/modules/data-connect/components/HealthCheckScheduleFormModal";
import { humanizeConnectorFieldLabel } from "@/modules/data-connect/lib/connector-template";
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
import { formatCatalogTime } from "@/modules/data-connect/utils/format-catalog-time";

import styles from "./DataConnectDetailDrawer.module.css";

type DataConnectDetailDrawerProps = {
  connectorTypes: DataConnectConnectorType[];
  onClose: () => void;
  open: boolean;
  recordId: string;
};

const HEALTH_STATUS_COLORS: Record<DataConnectRecord["healthStatus"], string> = {
  degraded: "orange",
  healthy: "success",
  offline: "error",
  unchecked: "default",
  unhealthy: "error",
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
  const recordIdentityKey = open ? recordId : "";
  const recordIdentityRef = useRef({ generation: 0, key: recordIdentityKey });
  if (recordIdentityRef.current.key !== recordIdentityKey) {
    recordIdentityRef.current = {
      generation: recordIdentityRef.current.generation + 1,
      key: recordIdentityKey,
    };
  }

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
  const configEntries = record
    ? buildConfigEntries(record, t, selectedConnectorType)
    : [];

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
              column={1}
              items={[
                {
                  key: "id",
                  label: t("common.id"),
                  children: record.id,
                },
                {
                  key: "name",
                  label: t("dataConnect.name"),
                  children: record.name,
                },
                {
                  key: "tags",
                  label: t("dataConnect.tags"),
                  children:
                    record.tags.length > 0 ? (
                      <Space size={[4, 4]} wrap>
                        {record.tags.map((tag) => (
                          <Tag className={styles.catalogTag} key={tag}>{tag}</Tag>
                        ))}
                      </Space>
                    ) : (
                      "-"
                    ),
                },
                {
                  key: "description",
                  label: t("common.description"),
                  children: record.description || "-",
                },
                {
                  key: "category",
                  label: t("common.category"),
                  children: t(`dataConnect.categories.${record.category}`),
                },
                {
                  key: "connectorType",
                  label: t("dataConnect.connectorType"),
                  children: connectorTypeName,
                },
                {
                  key: "mode",
                  label: t("common.mode"),
                  children: t(`dataConnect.modes.${record.mode}`),
                },
                {
                  key: "status",
                  label: t("common.status"),
                  children: (
                    <Tag color={record.enabled ? "success" : "default"}>
                      {record.enabled ? t("common.enabled") : t("common.disabled")}
                    </Tag>
                  ),
                },
                {
                  key: "health",
                  label: t("common.healthStatus"),
                  children: (
                    <Tag color={HEALTH_STATUS_COLORS[record.healthStatus]}>
                      {t(`dataConnect.healthStatuses.${record.healthStatus}`)}
                    </Tag>
                  ),
                },
                {
                  key: "creator",
                  label: t("dataConnect.creator"),
                  children: record.creatorName,
                },
                {
                  key: "createTime",
                  label: t("dataConnect.createTime"),
                  children: formatCatalogTime(record.createTime),
                },
                {
                  key: "updater",
                  label: t("dataConnect.updater"),
                  children: record.updaterName,
                },
                {
                  key: "updateTime",
                  label: t("dataConnect.updateTime"),
                  children: formatCatalogTime(record.updateTime),
                },
              ]}
            />
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("dataConnect.connectorConfig")}</h3>
            {configEntries.length > 0 ? (
              <div className={styles.configGrid}>
                {configEntries.map((item) => (
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
                  children: formatCatalogTime(record.lastCheckTime),
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
                    children: formatCatalogTime(schedule.lastRun),
                  },
                  {
                    key: "nextRun",
                    label: t("dataConnect.healthCheckSchedule.nextRun"),
                    children: formatCatalogTime(schedule.nextRun),
                  },
                  {
                    key: "updateTime",
                    label: t("dataConnect.updateTime"),
                    children: formatCatalogTime(schedule.updateTime),
                  },
                ]}
              />
            ) : (
              <Spin size="small" />
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
            const submittedRecordId = recordId;
            const submittedRecordIdentity = recordIdentityRef.current;

            try {
              setScheduleUpdating(true);
              const nextSchedule =
                await updateDataConnectHealthCheckSchedule(
                  submittedRecordId,
                  input,
                  schedule.expectedUpdateTime,
                );
              if (recordIdentityRef.current !== submittedRecordIdentity) {
                return;
              }
              setSchedule(nextSchedule);
              setScheduleModalOpen(false);
              message.success(t("common.success"));
            } catch (error) {
              if (recordIdentityRef.current !== submittedRecordIdentity) {
                return;
              }
              void message.error(extractRequestErrorMessage(error));
              if (isRequestConflict(error)) {
                try {
                  const latestSchedule =
                    await getDataConnectHealthCheckSchedule(submittedRecordId);
                  if (recordIdentityRef.current !== submittedRecordIdentity) {
                    return;
                  }
                  setSchedule(latestSchedule);
                  setScheduleError(null);
                } catch (refreshError) {
                  if (recordIdentityRef.current === submittedRecordIdentity) {
                    setScheduleError(extractRequestErrorMessage(refreshError));
                  }
                }
              }
            } finally {
              if (recordIdentityRef.current === submittedRecordIdentity) {
                setScheduleUpdating(false);
              }
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

  if (typeof value === "object" && !Array.isArray(value)) {
    return <ConfigObjectValue value={value as Record<string, unknown>} t={t} />;
  }

  return JSON.stringify(value, null, 2);
}

function DatabaseListValue({ values }: { values: unknown[] }) {
  return (
    <Space size={[4, 4]} wrap>
      {values.map((value, index) => (
        <Tag key={`${String(value)}-${index}`}>{String(value)}</Tag>
      ))}
    </Space>
  );
}

function ConfigObjectValue({ t, value }: { t: TFunction; value: Record<string, unknown> }) {
  return (
    <Space size={[4, 4]} wrap>
      {Object.entries(value).map(([key, item]) => (
        <Tag key={key}>
          {key}: {formatConfigTagValue(item, t)}
        </Tag>
      ))}
    </Space>
  );
}

function formatConfigTagValue(value: unknown, t: TFunction) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? t("dataConnect.booleanTrue") : t("dataConnect.booleanFalse");
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildConfigEntries(
  record: DataConnectRecord,
  t: TFunction,
  connectorType?: DataConnectConnectorType,
) {
  const config = record.connectorConfig ?? {};
  const fieldConfig = connectorType?.fieldConfig ?? {};
  const templateKeys = Object.keys(fieldConfig);
  const keys = (templateKeys.length > 0 ? templateKeys : Object.keys(config)).sort((left, right) => {
    const leftRank = configFieldOrderRank(left);
    const rightRank = configFieldOrderRank(right);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return humanizeConnectorFieldLabel(left, connectorType?.type).localeCompare(
      humanizeConnectorFieldLabel(right, connectorType?.type),
    );
  });

  return keys.map((key) => {
    const configItem = fieldConfig[key];
    const hasValue = Object.prototype.hasOwnProperty.call(config, key);
    return {
      description: "",
      key,
      label: humanizeConnectorFieldLabel(key, connectorType?.type),
      value: configItem?.encrypted
        ? t("dataConnect.sensitiveValueHidden")
        : hasValue
          ? isDatabaseListField(key) && Array.isArray(config[key])
            ? <DatabaseListValue values={config[key]} />
            : formatConfigValue(config[key], t)
          : "-",
    };
  });
}

function isDatabaseListField(key: string) {
  const normalized = key.trim().toLowerCase();
  return normalized === "database_list" || normalized === "databases";
}

function configFieldOrderRank(key: string) {
  const normalized = key.trim().toLowerCase();
  const rankMap: Record<string, number> = {
    host: 1,
    hostname: 1,
    server: 1,
    port: 2,
    user: 3,
    username: 3,
    account: 3,
    password: 4,
    database: 5,
    db: 5,
    database_list: 5,
    databases: 5,
    schema: 5,
    schema_list: 5,
  };

  return rankMap[normalized] ?? 100;
}

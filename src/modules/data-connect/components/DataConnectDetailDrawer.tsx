/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Descriptions, Drawer, Empty, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getDataConnectRecord } from "@/modules/data-connect/services/data-connect.service";
import type {
  DataConnectConnectorType,
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
  const [record, setRecord] = useState<DataConnectRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setRecord(null);

      try {
        setRecord(await getDataConnectRecord(recordId));
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
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
            <h3 className={styles.sectionTitle}>{t("dataConnect.healthResult")}</h3>
            <Descriptions
              bordered
              className={styles.descriptionBlock}
              column={1}
              items={[
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
                {buildConfigEntries(record, selectedConnectorType).map((item) => (
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
    </Drawer>
  );
}

function formatConfigValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function buildConfigEntries(
  record: DataConnectRecord,
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

    const leftName = fieldConfig[left]?.name ?? humanizeConfigKey(left);
    const rightName = fieldConfig[right]?.name ?? humanizeConfigKey(right);
    return leftName.localeCompare(rightName, "zh-CN");
  });

  return keys.map((key) => {
    const configItem = fieldConfig[key];
    return {
      description: configItem?.description?.trim() || "",
      key,
      label: configItem?.name?.trim() || humanizeConfigKey(key),
      value: configItem?.encrypted ? "******" : formatConfigValue(config[key]),
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

function humanizeConfigKey(key: string) {
  const normalized = key.trim().toLowerCase();
  const labelMap: Record<string, string> = {
    account: "账号",
    api_key: "API Key",
    catalog: "Catalog",
    cluster: "集群",
    database: "数据库",
    db: "数据库",
    endpoint: "访问地址",
    host: "主机地址",
    password: "密码",
    path: "路径",
    port: "端口",
    project: "项目",
    schema: "Schema",
    secret: "密钥",
    secret_key: "密钥",
    table: "数据表",
    token: "访问令牌",
    uri: "连接地址",
    url: "连接地址",
    user: "用户名",
    username: "用户名",
    warehouse: "仓库",
  };

  if (labelMap[normalized]) {
    return labelMap[normalized];
  }

  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (char) => char.toUpperCase());
}

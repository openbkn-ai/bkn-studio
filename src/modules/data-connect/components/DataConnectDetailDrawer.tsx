import { Alert, Descriptions, Drawer, Empty, Spin, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CatalogAuthorizeModal } from "@/modules/system-admin/components/CatalogAuthorizeModal";
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

const healthColorMap: Record<DataConnectRecord["healthStatus"], string> = {
  healthy: "green",
  degraded: "gold",
  unhealthy: "red",
  offline: "volcano",
  unchecked: "default",
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
  const [authorizeOpen, setAuthorizeOpen] = useState(false);

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

  return (
    <Drawer
      destroyOnClose
      extra={
        record ? (
          <PermissionGate permissions="admin-role:edit">
            <AppButton onClick={() => setAuthorizeOpen(true)} type="primary">
              {t("systemAdmin.authorize.grant")}
            </AppButton>
          </PermissionGate>
        ) : null
      }
      onClose={onClose}
      open={open}
      title={t("dataConnect.detailTitle")}
      width={760}
    >
      {record ? (
        <CatalogAuthorizeModal
          catalogId={record.id}
          catalogName={record.name}
          onClose={() => setAuthorizeOpen(false)}
          open={authorizeOpen}
        />
      ) : null}
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && !record ? (
        <Empty description={t("common.notFound")} />
      ) : null}
      {!loading && !loadError && record ? (
        <div className={styles.drawerContent}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <div className={styles.summaryCopy}>
                <h2 className={styles.summaryTitle}>{record.name}</h2>
                <p className={styles.summaryDescription}>{record.description || "-"}</p>
              </div>
              <div className={styles.summaryStatus}>
                <Tag color={record.enabled ? "green" : "default"}>
                  {record.enabled ? t("common.enabled") : t("common.disabled")}
                </Tag>
                <Tag color={healthColorMap[record.healthStatus]}>
                  {t(`dataConnect.healthStatuses.${record.healthStatus}`)}
                </Tag>
              </div>
            </div>
            <div className={styles.summaryMeta}>
              <span>{connectorTypeName}</span>
              <span>{t(`dataConnect.categories.${record.category}`)}</span>
              <span>{t(`dataConnect.modes.${record.mode}`)}</span>
            </div>
            {record.tags.length > 0 ? (
              <div className={styles.tagGroup}>
                {record.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            ) : null}
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
            <Descriptions
              bordered
              className={styles.descriptionBlock}
              column={1}
              items={[
                {
                  key: "name",
                  label: t("dataConnect.name"),
                  children: record.name,
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
                  key: "status",
                  label: t("common.status"),
                  children: (
                    <Tag color={record.enabled ? "green" : "default"}>
                      {record.enabled ? t("common.enabled") : t("common.disabled")}
                    </Tag>
                  ),
                },
                {
                  key: "health",
                  label: t("common.healthStatus"),
                  children: (
                    <Tag color={healthColorMap[record.healthStatus]}>
                      {t(`dataConnect.healthStatuses.${record.healthStatus}`)}
                    </Tag>
                  ),
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
                {Object.entries(record.connectorConfig).map(([key, value]) => (
                  <div className={styles.configItem} key={key}>
                    <span className={styles.configLabel}>{key}</span>
                    <span className={styles.configValue}>{formatConfigValue(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description={t("dataConnect.noConnectorConfig")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

function formatConfigValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

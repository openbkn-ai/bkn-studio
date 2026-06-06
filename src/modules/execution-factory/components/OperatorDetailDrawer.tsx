import { Alert, Descriptions, Drawer, Empty, Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  getOperatorDetail,
  getOperatorMarket,
} from "@/modules/execution-factory/services/operator.service";
import type {
  OperatorExecuteControl,
  OperatorRecord,
  OperatorRunLogEntry,
  OperatorStatus,
} from "@/modules/execution-factory/types/operator";

import { ConvertOperatorToToolModal } from "./ConvertOperatorToToolModal";
import { OperatorDebugModal } from "./OperatorDebugModal";
import { OperatorHistoryDrawer } from "./OperatorHistoryDrawer";
import { OperatorRunLogPanel } from "./OperatorRunLogPanel";
import styles from "./OperatorDetailDrawer.module.css";

type OperatorDetailDrawerProps = {
  marketMode?: boolean;
  onClose: () => void;
  onEdit?: (operatorId: string) => void;
  open: boolean;
  operatorId: string | null;
};

const statusColorMap: Record<OperatorStatus, string> = {
  published: "green",
  editing: "gold",
  offline: "default",
  unpublish: "blue",
};

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatExecuteControl(
  control: OperatorExecuteControl | undefined,
  t: (key: string) => string,
) {
  if (!control) {
    return "-";
  }

  const parts = [
    control.timeout !== undefined
      ? `${t("executionFactory.executeControlTimeout")}: ${control.timeout}ms`
      : null,
    control.retryPolicy?.maxAttempts !== undefined
      ? `${t("executionFactory.executeControlMaxAttempts")}: ${control.retryPolicy.maxAttempts}`
      : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "-";
}

export function OperatorDetailDrawer({
  marketMode = false,
  onClose,
  onEdit,
  open,
  operatorId,
}: OperatorDetailDrawerProps) {
  const { t } = useTranslation();
  const [record, setRecord] = useState<OperatorRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [executeControl, setExecuteControl] = useState<OperatorExecuteControl | undefined>();
  const [sessionLogs, setSessionLogs] = useState<OperatorRunLogEntry[]>([]);

  useEffect(() => {
    if (!open || !operatorId) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setRecord(null);

      try {
        if (marketMode) {
          setRecord(await getOperatorMarket(operatorId));
          setExecuteControl(undefined);
        } else {
          const detail = await getOperatorDetail(operatorId);
          setRecord(detail);
          setExecuteControl(detail.executeControl);
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [marketMode, open, operatorId]);

  return (
    <>
    <Drawer
      destroyOnClose
      extra={
        !marketMode && record ? (
          <div style={{ display: "flex", gap: 8 }}>
            {onEdit ? (
              <AppButton onClick={() => onEdit(record.operatorId)}>
                {t("executionFactory.cardMenu.edit")}
              </AppButton>
            ) : null}
            <AppButton onClick={() => setHistoryOpen(true)}>
              {t("executionFactory.operatorHistoryAction")}
            </AppButton>
            <PermissionGate permissions="execution-factory:tool:create">
              <AppButton onClick={() => setConvertOpen(true)}>
                {t("executionFactory.convertToTool")}
              </AppButton>
            </PermissionGate>
            <PermissionGate permissions="execution-factory:operator:debug">
              <AppButton onClick={() => setDebugOpen(true)} type="primary">
                {t("executionFactory.debug")}
              </AppButton>
            </PermissionGate>
          </div>
        ) : null
      }
      onClose={onClose}
      open={open}
      title={
        marketMode
          ? t("executionFactory.marketDetailTitle")
          : t("executionFactory.detailTitle")
      }
      width={760}
    >
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError && !record ? (
        <Empty description={t("common.notFound")} />
      ) : null}
      {!loading && !loadError && record ? (
        <div className={styles.drawerContent}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <div>
                <h2 className={styles.summaryTitle}>{record.name}</h2>
                <p className={styles.summaryDescription}>
                  {record.description || "-"}
                </p>
              </div>
              <div className={styles.summaryStatus}>
                <Tag color={statusColorMap[record.status]}>
                  {t(`executionFactory.statuses.${record.status}`)}
                </Tag>
                {record.isInternal ? (
                  <Tag>{t("executionFactory.internalTag")}</Tag>
                ) : null}
              </div>
            </div>
            <div className={styles.summaryMeta}>
              <span>{record.operatorId}</span>
              <span>{record.version}</span>
              {record.metadataType ? (
                <span>{t(`executionFactory.metadataTypes.${record.metadataType}`)}</span>
              ) : null}
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
                  key: "operatorId",
                  label: t("executionFactory.operatorId"),
                  children: record.operatorId,
                },
                {
                  key: "name",
                  label: t("executionFactory.operatorName"),
                  children: record.name,
                },
                {
                  key: "version",
                  label: t("executionFactory.version"),
                  children: record.version,
                },
                {
                  key: "category",
                  label: t("executionFactory.category"),
                  children: record.categoryName ?? record.category ?? "-",
                },
                {
                  key: "executeControl",
                  label: t("executionFactory.executeControlTitle"),
                  children: formatExecuteControl(executeControl, t),
                },
                {
                  key: "createUser",
                  label: t("executionFactory.createUser"),
                  children: record.createUser ?? "-",
                },
                {
                  key: "updateTime",
                  label: t("executionFactory.updateTime"),
                  children: formatTimestamp(record.updateTime),
                },
                {
                  key: "releaseUser",
                  label: t("executionFactory.releaseUser"),
                  children: record.releaseUser ?? "-",
                },
                {
                  key: "releaseTime",
                  label: t("executionFactory.releaseTime"),
                  children: formatTimestamp(record.releaseTime),
                },
              ]}
            />
          </section>
          {!marketMode ? (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>{t("executionFactory.runLogTitle")}</h3>
              <OperatorRunLogPanel
                operatorId={record.operatorId}
                sessionLogs={sessionLogs}
              />
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
    <OperatorDebugModal
      onClose={() => setDebugOpen(false)}
      onRunComplete={(entry) => {
        setSessionLogs((current) => [entry, ...current].slice(0, 20));
      }}
      open={debugOpen}
      record={record}
    />
    <ConvertOperatorToToolModal
      onClose={() => setConvertOpen(false)}
      open={convertOpen}
      record={record}
    />
    <OperatorHistoryDrawer
      onClose={() => setHistoryOpen(false)}
      open={historyOpen}
      operatorId={record?.operatorId ?? null}
      operatorName={record?.name}
    />
    </>
  );
}

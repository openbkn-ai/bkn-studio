/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Descriptions, Tag } from "antd";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ExecutionUnitDetailDrawerLayout } from "@/modules/execution-factory/components/execution-unit-detail/ExecutionUnitDetailDrawerLayout";
import { MetadataDetailSection } from "@/modules/execution-factory/components/execution-unit-detail/MetadataDetailSection";
import {
  getOperatorDetail,
  getOperatorMarket,
} from "@/modules/execution-factory/services/operator.service";
import type {
  OperatorDetail,
  OperatorRunLogEntry,
  OperatorStatus,
} from "@/modules/execution-factory/types/operator";
import {
  formatExecuteControlDisplay,
  formatOptionalTimestamp,
  resolveOperatorCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";

import { ConvertOperatorToToolModal } from "./ConvertOperatorToToolModal";
import { OperatorDebugModal } from "./OperatorDebugModal";
import { OperatorHistoryDrawer } from "./OperatorHistoryDrawer";
import { OperatorRunLogPanel } from "./OperatorRunLogPanel";
import styles from "./OperatorDetailDrawer.module.css";

type OperatorDetailDrawerProps = {
  installedInDomain?: boolean;
  marketMode?: boolean;
  onClose: () => void;
  onEdit?: (operatorId: string) => void;
  onMarketInstall?: () => void;
  open: boolean;
  operatorId: string | null;
};

const statusStyleMap: Record<OperatorStatus, CSSProperties> = {
  published: {
    background: "var(--color-success-bg)",
    borderColor: "var(--color-success-border)",
    color: "var(--color-success-text)",
  },
  editing: {
    background: "var(--color-warning-bg)",
    borderColor: "var(--color-warning-border)",
    color: "var(--color-warning-text)",
  },
  offline: {
    background: "var(--color-error-bg)",
    borderColor: "var(--color-error-border)",
    color: "var(--color-error-text)",
  },
  unpublish: {
    background: "var(--color-info-bg)",
    borderColor: "var(--color-info-border)",
    color: "var(--color-info-text)",
  },
};

export function OperatorDetailDrawer({
  installedInDomain = false,
  marketMode = false,
  onClose,
  onEdit,
  onMarketInstall,
  open,
  operatorId,
}: OperatorDetailDrawerProps) {
  const { t } = useTranslation();
  const [record, setRecord] = useState<OperatorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
        } else {
          setRecord(await getOperatorDetail(operatorId));
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
      <ExecutionUnitDetailDrawerLayout
        empty={!record}
        footerPrimary={
          marketMode ? (
            onMarketInstall ? (
              <AppButton onClick={onMarketInstall} type="primary">
                {t(
                  installedInDomain
                    ? "executionFactory.marketSync"
                    : "executionFactory.marketIntroduce",
                )}
              </AppButton>
            ) : null
          ) : record ? (
            <PermissionGate permissions="execution-factory:operator:debug">
              <AppButton onClick={() => setDebugOpen(true)} type="primary">
                {t("executionFactory.debug")}
              </AppButton>
            </PermissionGate>
          ) : null
        }
        footerSecondary={
          !marketMode && record ? (
            <>
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
            </>
          ) : null
        }
        loadError={loadError}
        loading={loading}
        marketMode={marketMode}
        onClose={onClose}
        open={open}
        title={
          marketMode
            ? t("executionFactory.marketDetailTitle")
            : t("executionFactory.detailTitle")
        }
      >
        {record ? (
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
                  <Tag style={statusStyleMap[record.status]}>
                    {t(`executionFactory.statuses.${record.status}`)}
                  </Tag>
                  {record.metadataType ? (
                    <Tag>{t(`executionFactory.metadataTypes.${record.metadataType}`)}</Tag>
                  ) : null}
                  {record.isInternal ? (
                    <Tag>{t("executionFactory.internalTag")}</Tag>
                  ) : null}
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
                    children: resolveOperatorCategoryLabel(record, t),
                  },
                  {
                    key: "metadataType",
                    label: t("executionFactory.metadataType"),
                    children: record.metadataType
                      ? t(`executionFactory.metadataTypes.${record.metadataType}`)
                      : "-",
                  },
                  {
                    key: "executeControl",
                    label: t("executionFactory.executeControlTitle"),
                    children: formatExecuteControlDisplay(record.executeControl, t),
                  },
                  {
                    key: "createUser",
                    label: t("executionFactory.createUser"),
                    children: record.createUser ?? "-",
                  },
                  {
                    key: "updateUser",
                    label: t("executionFactory.updateUser"),
                    children: record.updateUser ?? "-",
                  },
                  {
                    key: "createTime",
                    label: t("executionFactory.createTime"),
                    children: formatOptionalTimestamp(record.createTime),
                  },
                  {
                    key: "updateTime",
                    label: t("executionFactory.updateTime"),
                    children: formatOptionalTimestamp(record.updateTime),
                  },
                  {
                    key: "releaseUser",
                    label: t("executionFactory.releaseUser"),
                    children: record.releaseUser ?? "-",
                  },
                  {
                    key: "releaseTime",
                    label: t("executionFactory.releaseTime"),
                    children: formatOptionalTimestamp(record.releaseTime),
                  },
                ]}
              />
            </section>

            {!marketMode && record.metadataType ? (
              <MetadataDetailSection
                functionInput={record.functionInput}
                metadataType={record.metadataType}
                openapiSpec={record.openapiSpec}
              />
            ) : null}

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
      </ExecutionUnitDetailDrawerLayout>
      <OperatorDebugModal
        functionInput={record?.functionInput}
        onClose={() => setDebugOpen(false)}
        onRunComplete={(entry) => {
          setSessionLogs((current) => [entry, ...current].slice(0, 20));
        }}
        open={debugOpen}
        openapiSpec={record?.openapiSpec}
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

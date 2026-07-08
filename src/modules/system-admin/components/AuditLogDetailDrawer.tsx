/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Descriptions, Drawer, Tag } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { AuditLog } from "@/modules/system-admin/types/admin";
import { auditActionToken } from "@/modules/system-admin/utils/audit-labels";
import { formatAuditTime } from "@/modules/system-admin/utils/audit-lookup-cache";

import appStyles from "@/modules/system-admin/scenes/admin.module.css";
import styles from "./AuditLogDetailDrawer.module.css";

type AuditLogDetailDrawerProps = {
  actorLabel: (id: string) => string;
  log: AuditLog | null;
  onClose: () => void;
  open: boolean;
  targetLabel: (log: AuditLog) => string | undefined;
};

function formatDetailJson(detail?: string) {
  if (!detail?.trim()) {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
}

export function AuditLogDetailDrawer({
  actorLabel,
  log,
  onClose,
  open,
  targetLabel,
}: AuditLogDetailDrawerProps) {
  const { t, i18n } = useTranslation();

  const actionLabel = useMemo(() => {
    if (!log) {
      return "";
    }
    const token = auditActionToken(log.method, log.action);
    return token ? t(`systemAdmin.audit.act.${token}`) : `${log.resource} · ${log.action}`;
  }, [log, t]);

  const detailJson = useMemo(() => formatDetailJson(log?.detail), [log?.detail]);

  if (!log) {
    return null;
  }

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      title={t("systemAdmin.audit.detailTitle")}
      width={560}
    >
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label={t("systemAdmin.audit.columns.action")}>
          <span className={appStyles.chipRow}>
            <Tag className={appStyles.roleTag}>{log.method}</Tag>
            <span>{actionLabel}</span>
          </span>
        </Descriptions.Item>
        <Descriptions.Item label={t("systemAdmin.audit.columns.target")}>
          {targetLabel(log) || "—"}
        </Descriptions.Item>
        <Descriptions.Item label={t("systemAdmin.audit.detail.resourceType")}>
          {t(`systemAdmin.audit.resources.${log.resource.replace("-", "_")}`, {
            defaultValue: log.resource,
          })}
        </Descriptions.Item>
        <Descriptions.Item label={t("systemAdmin.audit.detail.targetId")}>
          {log.targetId || "—"}
        </Descriptions.Item>
        <Descriptions.Item label={t("systemAdmin.audit.columns.actor")}>
          {actorLabel(log.actorId)}
        </Descriptions.Item>
        <Descriptions.Item label={t("systemAdmin.audit.columns.status")}>
          <Tag
            className={[
              appStyles.statusTag,
              log.status >= 400 ? appStyles.statusFrozen : appStyles.statusEnabled,
            ].join(" ")}
          >
            {log.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t("systemAdmin.audit.columns.time")}>
          {formatAuditTime(log.createdAt, i18n.language)}
        </Descriptions.Item>
        <Descriptions.Item label={t("systemAdmin.audit.columns.clientIp")}>
          {log.clientIp || "—"}
        </Descriptions.Item>
        <Descriptions.Item label={t("systemAdmin.audit.detail.logId")}>{log.id}</Descriptions.Item>
      </Descriptions>

      <div className={styles.detailSection}>
        <h3 className={styles.detailSectionTitle}>{t("systemAdmin.audit.detail.payload")}</h3>
        {detailJson ? (
          <pre className={styles.detailJson}>{detailJson}</pre>
        ) : (
          <p className={styles.emptyDetail}>{t("systemAdmin.audit.detail.noPayload")}</p>
        )}
      </div>
    </Drawer>
  );
}

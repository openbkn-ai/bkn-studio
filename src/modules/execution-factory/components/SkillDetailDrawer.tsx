/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  IdcardOutlined,
  TagOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Tag } from "antd";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DetailMetaPanel } from "@/modules/execution-factory/components/DetailMetaPanel";
import { ExecutionUnitDetailDrawerLayout } from "@/modules/execution-factory/components/execution-unit-detail/ExecutionUnitDetailDrawerLayout";
import { getSkill, getSkillMarket } from "@/modules/execution-factory/services/skill.service";
import type { SkillRecord, SkillStatus } from "@/modules/execution-factory/types/skill";
import {
  formatOptionalTimestamp,
  resolveSkillCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";
import { formatAuditUserDisplay } from "@/modules/execution-factory/utils/audit-user-display";
import { useAuditUserDirectory } from "@/modules/execution-factory/utils/use-audit-user-directory";

import styles from "./ToolboxDetailDrawer.module.css";

type SkillDetailDrawerProps = {
  marketMode?: boolean;
  onClose: () => void;
  onEdit?: (skillId: string) => void;
  onOpenHistory?: (skillId: string) => void;
  onViewDetail?: (skillId: string) => void;
  open: boolean;
  skillId: string | null;
};

const statusStyleMap: Record<SkillStatus, CSSProperties> = {
  published: {
    background: "var(--color-success-bg)",
    borderColor: "var(--color-success-border)",
    color: "var(--color-success-text)",
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

export function SkillDetailDrawer({
  marketMode = false,
  onClose,
  onEdit,
  onOpenHistory,
  onViewDetail,
  open,
  skillId,
}: SkillDetailDrawerProps) {
  const { t } = useTranslation();
  const auditUserDirectory = useAuditUserDirectory();
  const [record, setRecord] = useState<SkillRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !skillId) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setRecord(null);

      try {
        const skillRecord = marketMode
          ? await getSkillMarket(skillId)
          : await getSkill(skillId);
        setRecord(skillRecord);
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [marketMode, open, skillId]);

  const drawerTitle = marketMode
    ? t("executionFactory.skillMarketDetailTitle")
    : t("executionFactory.skillDetailTitle");

  const basicInfoItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return [
      {
        key: "skillId",
        label: t("executionFactory.skillIdLabel"),
        value: record.skillId,
        icon: <IdcardOutlined />,
        variant: "mono" as const,
        span: "full" as const,
      },
      {
        key: "version",
        label: t("executionFactory.version"),
        value: record.version ?? "-",
        icon: <TagOutlined />,
        variant: "accent" as const,
      },
      {
        key: "category",
        label: t("executionFactory.category"),
        value: resolveSkillCategoryLabel(record, t),
        icon: <AppstoreOutlined />,
      },
      {
        key: "status",
        label: t("executionFactory.statusLabel"),
        value: t(`executionFactory.skillStatuses.${record.status}`),
      },
      {
        key: "createUser",
        label: t("executionFactory.createUser"),
        value: formatAuditUserDisplay({ directory: auditUserDirectory, id: record.createUser }),
        icon: <UserOutlined />,
      },
      {
        key: "createTime",
        label: t("executionFactory.createTime"),
        value: formatOptionalTimestamp(record.createTime),
        icon: <CalendarOutlined />,
      },
      {
        key: "updateTime",
        label: t("executionFactory.updateTime"),
        value: formatOptionalTimestamp(record.updateTime),
        icon: <ClockCircleOutlined />,
      },
    ];
  }, [auditUserDirectory, record, t]);

  return (
    <ExecutionUnitDetailDrawerLayout
      empty={!record}
      footerPrimary={
        onViewDetail && record ? (
          <AppButton onClick={() => onViewDetail(record.skillId)} type="primary">
            {t("executionFactory.viewSkillDetail")}
          </AppButton>
        ) : null
      }
      footerSecondary={
        !marketMode && skillId ? (
          <PermissionGate permissions="execution-factory:skill:view">
            <AppButton onClick={() => onOpenHistory?.(skillId)}>
              {t("executionFactory.skillHistoryTitle")}
            </AppButton>
          </PermissionGate>
        ) : null
      }
      headerExtra={
        !marketMode && skillId ? (
          <PermissionGate permissions="execution-factory:skill:edit">
            <AppButton onClick={() => onEdit?.(skillId)} type="link">
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
        ) : null
      }
      loadError={loadError}
      loading={loading}
      marketMode={marketMode}
      onClose={onClose}
      open={open}
      title={drawerTitle}
      width={860}
    >
      {record ? (
        <div className={styles.drawerContent}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <div>
                <h2 className={styles.summaryTitle}>{record.name}</h2>
                <p className={styles.summaryDescription}>{record.description || "-"}</p>
              </div>
              <div className={styles.summaryStatus}>
                <Tag style={statusStyleMap[record.status]}>
                  {t(`executionFactory.skillStatuses.${record.status}`)}
                </Tag>
                {record.version ? <Tag>{record.version}</Tag> : null}
              </div>
            </div>
          </section>

          <DetailMetaPanel
            columns={2}
            compact
            items={basicInfoItems}
            title={t("common.basicInfo")}
          />
        </div>
      ) : null}
    </ExecutionUnitDetailDrawerLayout>
  );
}

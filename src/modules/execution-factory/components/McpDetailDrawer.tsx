/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  DownloadOutlined,
  IdcardOutlined,
  KeyOutlined,
  LinkOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DetailMetaPanel } from "@/modules/execution-factory/components/DetailMetaPanel";
import { ExecutionUnitDetailDrawerLayout } from "@/modules/execution-factory/components/execution-unit-detail/ExecutionUnitDetailDrawerLayout";
import { getMcpDetail, getMcpMarket, listMcpTools } from "@/modules/execution-factory/services/mcp.service";
import type { McpDetail, McpStatus } from "@/modules/execution-factory/types/mcp";
import {
  formatOptionalTimestamp,
  formatRecordHeaders,
  resolveMcpCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";
import { useImpexExport } from "@/modules/execution-factory/utils/use-impex-export";

import styles from "./ToolboxDetailDrawer.module.css";

type McpDetailDrawerProps = {
  marketMode?: boolean;
  mcpId: string | null;
  onClose: () => void;
  onViewDetail?: (mcpId: string) => void;
  open: boolean;
};

const statusColorMap: Record<McpStatus, string> = {
  published: "green",
  editing: "gold",
  offline: "default",
  unpublish: "blue",
};

function resolveCreationTypeLabel(
  creationType: McpDetail["creationType"],
  t: (key: string) => string,
) {
  if (!creationType) {
    return "-";
  }

  const key = `executionFactory.mcpCreationTypes.${creationType}`;
  const translated = t(key);
  return translated !== key ? translated : creationType;
}

function resolveModeLabel(mode: McpDetail["mode"], t: (key: string) => string) {
  if (!mode) {
    return "-";
  }

  const key = `executionFactory.mcpModes.${mode}`;
  const translated = t(key);
  return translated !== key ? translated : mode;
}

export function McpDetailDrawer({
  marketMode = false,
  mcpId,
  onClose,
  onViewDetail,
  open,
}: McpDetailDrawerProps) {
  const { t } = useTranslation();
  const [record, setRecord] = useState<McpDetail | null>(null);
  const [toolCount, setToolCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { exportComponentById, isExporting } = useImpexExport();

  useEffect(() => {
    if (!open || !mcpId) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setRecord(null);
      setToolCount(0);

      try {
        const mcpRecord = marketMode
          ? await getMcpMarket(mcpId)
          : await getMcpDetail(mcpId);
        setRecord(mcpRecord);

        if (!marketMode) {
          try {
            const tools = await listMcpTools(mcpId);
            setToolCount(tools.length);
          } catch {
            setToolCount(mcpRecord.toolConfigs?.length ?? 0);
          }
        } else {
          setToolCount(mcpRecord.toolConfigs?.length ?? 0);
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [marketMode, mcpId, open]);

  const drawerTitle = marketMode
    ? t("executionFactory.mcpMarketDetailTitle")
    : t("executionFactory.mcpDetailTitle");

  const resolvedToolCount = toolCount || record?.toolConfigs?.length || 0;

  const basicInfoItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return [
      {
        key: "mcpId",
        label: t("executionFactory.mcpIdLabel"),
        value: record.mcpId,
        icon: <IdcardOutlined />,
        variant: "mono" as const,
        span: "full" as const,
      },
      {
        key: "creationType",
        label: t("executionFactory.mcpCreationType"),
        value: resolveCreationTypeLabel(record.creationType, t),
        icon: <ApiOutlined />,
        variant: "accent" as const,
      },
      {
        key: "category",
        label: t("executionFactory.category"),
        value: resolveMcpCategoryLabel(record.category, t),
        icon: <AppstoreOutlined />,
      },
      {
        key: "toolCount",
        label: t("executionFactory.mcpToolCountFieldLabel"),
        value: t("executionFactory.toolCountLabel", { count: resolvedToolCount }),
        icon: <ToolOutlined />,
      },
      {
        key: "url",
        label: t("executionFactory.serviceUrl"),
        value: record.url ?? "-",
        icon: <LinkOutlined />,
        span: "full" as const,
        variant: "mono" as const,
      },
      {
        key: "headers",
        label: t("executionFactory.mcpHeadersLabel"),
        value: formatRecordHeaders(record.headers),
        icon: <KeyOutlined />,
        span: "full" as const,
        variant: "muted" as const,
      },
      {
        key: "updateTime",
        label: t("executionFactory.updateTime"),
        value: formatOptionalTimestamp(record.updateTime),
        icon: <CalendarOutlined />,
      },
    ];
  }, [record, resolvedToolCount, t]);

  return (
    <ExecutionUnitDetailDrawerLayout
      empty={!record}
      footerPrimary={
        onViewDetail && record ? (
          <AppButton onClick={() => onViewDetail(record.mcpId)} type="primary">
            {t("executionFactory.viewMcpDetail")}
            {` (${resolvedToolCount})`}
          </AppButton>
        ) : null
      }
      footerSecondary={
        !marketMode && record && !record.isInternal ? (
          <PermissionGate permissions="execution-factory:impex:export">
            <AppButton
              icon={<DownloadOutlined />}
              loading={isExporting("mcp", record.mcpId)}
              onClick={() => {
                void exportComponentById("mcp", record.mcpId, record.name);
              }}
            >
              {t("executionFactory.cardMenu.export")}
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
                <Tag color={statusColorMap[record.status]}>
                  {t(`executionFactory.mcpStatuses.${record.status}`)}
                </Tag>
                {record.mode ? <Tag>{resolveModeLabel(record.mode, t)}</Tag> : null}
                {record.isInternal ? <Tag>{t("executionFactory.internalTag")}</Tag> : null}
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

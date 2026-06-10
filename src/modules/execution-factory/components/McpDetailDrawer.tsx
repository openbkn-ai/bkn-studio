import { Alert, Descriptions, Drawer, Empty, Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { McpToolDebugModal } from "@/modules/execution-factory/components/McpToolDebugModal";
import { getMcpDetail, getMcpMarket, listMcpTools } from "@/modules/execution-factory/services/mcp.service";
import type { McpDetail, McpProxyTool, McpStatus } from "@/modules/execution-factory/types/mcp";
import {
  formatOptionalTimestamp,
  formatRecordHeaders,
  resolveMcpCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";

import styles from "./ToolboxDetailDrawer.module.css";

type McpDetailDrawerProps = {
  marketMode?: boolean;
  mcpId: string | null;
  onClose: () => void;
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
  open,
}: McpDetailDrawerProps) {
  const { t } = useTranslation();
  const [record, setRecord] = useState<McpDetail | null>(null);
  const [tools, setTools] = useState<McpProxyTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugToolName, setDebugToolName] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !mcpId) {
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      setRecord(null);
      setTools([]);

      try {
        const mcpRecord = marketMode
          ? await getMcpMarket(mcpId)
          : await getMcpDetail(mcpId);
        setRecord(mcpRecord);

        if (!marketMode) {
          setTools(await listMcpTools(mcpId));
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [marketMode, mcpId, open]);

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      title={
        marketMode
          ? t("executionFactory.mcpMarketDetailTitle")
          : t("executionFactory.mcpDetailTitle")
      }
      width={860}
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
                <p className={styles.summaryDescription}>{record.description || "-"}</p>
              </div>
              <div className={styles.summaryStatus}>
                <Tag color={statusColorMap[record.status]}>
                  {t(`executionFactory.mcpStatuses.${record.status}`)}
                </Tag>
                {record.mode ? (
                  <Tag>{resolveModeLabel(record.mode, t)}</Tag>
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
              column={1}
              items={[
                {
                  key: "mcpId",
                  label: t("executionFactory.mcpIdLabel"),
                  children: record.mcpId,
                },
                {
                  key: "name",
                  label: t("executionFactory.mcpNameLabel"),
                  children: record.name,
                },
                {
                  key: "creationType",
                  label: t("executionFactory.mcpCreationType"),
                  children: resolveCreationTypeLabel(record.creationType, t),
                },
                {
                  key: "category",
                  label: t("executionFactory.category"),
                  children: resolveMcpCategoryLabel(record.category, t),
                },
                {
                  key: "mode",
                  label: t("executionFactory.mcpModeLabel"),
                  children: resolveModeLabel(record.mode, t),
                },
                {
                  key: "url",
                  label: t("executionFactory.serviceUrl"),
                  children: record.url ?? "-",
                },
                {
                  key: "headers",
                  label: t("executionFactory.mcpHeadersLabel"),
                  children: (
                    <span style={{ whiteSpace: "pre-wrap" }}>
                      {formatRecordHeaders(record.headers)}
                    </span>
                  ),
                },
                {
                  key: "createUser",
                  label: t("executionFactory.createUser"),
                  children: record.createUser ?? "-",
                },
                {
                  key: "updateTime",
                  label: t("executionFactory.updateTime"),
                  children: formatOptionalTimestamp(record.updateTime),
                },
              ]}
            />
          </section>

          {record.toolConfigs && record.toolConfigs.length > 0 ? (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>
                {t("executionFactory.mcpToolConfigsSectionTitle")}
              </h3>
              <div className={styles.toolList}>
                {record.toolConfigs.map((tool) => (
                  <div
                    className={styles.toolItem}
                    key={`${tool.boxId ?? "box"}-${tool.toolId ?? tool.toolName}`}
                  >
                    <div>
                      <div className={styles.toolName}>
                        {tool.toolName ?? tool.toolId ?? "-"}
                      </div>
                      {tool.description ? (
                        <div className={styles.toolMeta}>{tool.description}</div>
                      ) : null}
                      {tool.useRule ? (
                        <div className={styles.toolMeta}>{tool.useRule}</div>
                      ) : null}
                      {tool.boxId ? (
                        <div className={styles.toolMeta}>
                          {t("executionFactory.toolboxId")}: {tool.boxId}
                          {tool.toolId ? ` · ${tool.toolId}` : ""}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!marketMode ? (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>
                {t("executionFactory.mcpToolsSectionTitle")}
              </h3>
              {tools.length === 0 ? (
                <Empty description={t("executionFactory.mcpToolsEmpty")} />
              ) : (
                <div className={styles.toolList}>
                  {tools.map((tool) => (
                    <div className={styles.toolItem} key={tool.name}>
                      <div>
                        <div className={styles.toolName}>{tool.name}</div>
                        {tool.description ? (
                          <div className={styles.toolMeta}>{tool.description}</div>
                        ) : null}
                      </div>
                      <PermissionGate permissions="execution-factory:mcp:debug">
                        <AppButton onClick={() => setDebugToolName(tool.name)} type="link">
                          {t("executionFactory.debug")}
                        </AppButton>
                      </PermissionGate>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
      {mcpId && debugToolName ? (
        <McpToolDebugModal
          mcpId={mcpId}
          onClose={() => setDebugToolName(null)}
          open={Boolean(debugToolName)}
          toolName={debugToolName}
        />
      ) : null}
    </Drawer>
  );
}

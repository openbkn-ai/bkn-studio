import { Alert, Descriptions, Drawer, Empty, Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { McpToolDebugModal } from "@/modules/execution-factory/components/McpToolDebugModal";
import { getMcp, getMcpMarket, listMcpTools } from "@/modules/execution-factory/services/mcp.service";
import type { McpProxyTool, McpRecord, McpStatus } from "@/modules/execution-factory/types/mcp";

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

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function McpDetailDrawer({
  marketMode = false,
  mcpId,
  onClose,
  open,
}: McpDetailDrawerProps) {
  const { t } = useTranslation();
  const [record, setRecord] = useState<McpRecord | null>(null);
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
        const mcpRecord = marketMode ? await getMcpMarket(mcpId) : await getMcp(mcpId);
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
            <h2 className={styles.summaryTitle}>{record.name}</h2>
            <p className={styles.summaryDescription}>{record.description || "-"}</p>
            <div className={styles.summaryStatus}>
              <Tag color={statusColorMap[record.status]}>
                {t(`executionFactory.mcpStatuses.${record.status}`)}
              </Tag>
              {record.isInternal ? (
                <Tag>{t("executionFactory.internalTag")}</Tag>
              ) : null}
            </div>
            <div className={styles.summaryMeta}>
              <span>{record.mcpId}</span>
              {record.mode ? <span>{record.mode}</span> : null}
            </div>
          </section>
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
            <Descriptions
              bordered
              column={1}
              items={[
                {
                  key: "creationType",
                  label: t("executionFactory.mcpCreationType"),
                  children: record.creationType ?? "-",
                },
                {
                  key: "category",
                  label: t("executionFactory.category"),
                  children: record.category ?? "-",
                },
                {
                  key: "url",
                  label: t("executionFactory.serviceUrl"),
                  children: record.url ?? "-",
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
              ]}
            />
          </section>
          {!marketMode ? (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>{t("executionFactory.mcpToolsSectionTitle")}</h3>
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

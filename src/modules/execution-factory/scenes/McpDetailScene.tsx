import {
  ApiOutlined,
  AppstoreOutlined,
  BugOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  KeyOutlined,
  LinkOutlined,
  SettingOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { Alert, Breadcrumb, Empty, Layout, Space, Spin, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { McpDetailSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DetailMetaPanel } from "@/modules/execution-factory/components/DetailMetaPanel";
import { CreateMcpDrawer } from "@/modules/execution-factory/components/create-menu/CreateMcpDrawer";
import { JsonSchemaIoPanel } from "@/modules/execution-factory/components/JsonSchemaIoPanel";
import { McpToolDebugModal } from "@/modules/execution-factory/components/McpToolDebugModal";
import {
  getMcpDetail,
  getMcpMarket,
  listMcpTools,
} from "@/modules/execution-factory/services/mcp.service";
import type { McpDetail, McpProxyTool, McpStatus } from "@/modules/execution-factory/types/mcp";
import {
  formatOptionalTimestamp,
  formatRecordHeaders,
  resolveMcpCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";
import { useImpexExport } from "@/modules/execution-factory/utils/use-impex-export";

import styles from "./toolbox-detail.module.css";

const { Sider, Content } = Layout;
const { Paragraph, Title } = Typography;

const statusColorMap: Record<McpStatus, string> = {
  published: "green",
  editing: "gold",
  offline: "default",
  unpublish: "blue",
};

function resolveModeLabel(mode: McpDetail["mode"], t: (key: string) => string) {
  if (!mode) {
    return "-";
  }

  const key = `executionFactory.mcpModes.${mode}`;
  const translated = t(key);
  return translated !== key ? translated : mode;
}

export function McpDetailScene({ mcpId, onBack }: McpDetailSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogContext = searchParams.get("from") === "catalog";
  const viewMode = searchParams.get("action") !== "edit";
  const [record, setRecord] = useState<McpDetail | null>(null);
  const [tools, setTools] = useState<McpProxyTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpProxyTool | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toolsLoadError, setToolsLoadError] = useState<string | null>(null);
  const [debugToolName, setDebugToolName] = useState<string | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const { exportComponentById, isExporting } = useImpexExport();

  const loadRecord = useCallback(async () => {
    try {
      const nextRecord = catalogContext
        ? await getMcpMarket(mcpId)
        : await getMcpDetail(mcpId);
      setRecord(nextRecord);
    } catch {
      setRecord(null);
    }
  }, [catalogContext, mcpId]);

  const loadTools = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setToolsLoadError(null);

    try {
      await loadRecord();
      try {
        const nextTools = await listMcpTools(mcpId);
        setTools(nextTools);
        setSelectedTool(nextTools[0] ?? null);
      } catch (error) {
        setTools([]);
        setSelectedTool(null);
        setToolsLoadError(extractRequestErrorMessage(error));
      }
    } catch (error) {
      setTools([]);
      setSelectedTool(null);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [loadRecord, mcpId]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const handleEnterEditMode = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("action", "edit");
    setSearchParams(nextParams, { replace: true });
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (window.history.length > 1) {
      void navigate(-1);
      return;
    }

    void navigate(
      catalogContext
        ? "/execution-factory/catalog?activeTab=mcp"
        : "/execution-factory/units?activeTab=mcp",
    );
  };

  const statusTag = useMemo(() => {
    if (!record?.status) {
      return null;
    }

    return (
      <Tag color={statusColorMap[record.status]}>
        {t(`executionFactory.mcpStatuses.${record.status}`)}
      </Tag>
    );
  }, [record?.status, t]);

  const toolCount = tools.length || record?.toolConfigs?.length || 0;

  const toolInfoItems = useMemo(() => {
    if (!selectedTool || !record) {
      return [];
    }

    return [
      {
        key: "toolName",
        label: t("executionFactory.toolboxToolNameLabel"),
        value: selectedTool.name,
        icon: <TagOutlined />,
        variant: "strong" as const,
      },
      {
        key: "mode",
        label: t("executionFactory.mcpModeLabel"),
        value: resolveModeLabel(record.mode, t),
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
        key: "description",
        label: t("common.description"),
        value: selectedTool.description || "-",
        icon: <FileTextOutlined />,
        span: "full" as const,
      },
      {
        key: "serviceUrl",
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
  }, [record, selectedTool, t]);

  return (
    <section className={styles.page}>
      <div className={styles.backRow}>
        <Breadcrumb
          items={[
            {
              title: (
                <button className={styles.breadcrumbLink} onClick={handleBack} type="button">
                  {catalogContext
                    ? t("executionFactory.catalogTitle")
                    : t("executionFactory.unitManagementTitle")}
                </button>
              ),
            },
            {
              title: record?.name ?? t("executionFactory.mcpDetailPageTitle"),
            },
            {
              title: t("executionFactory.mcpDetailPageTitle"),
            },
          ]}
        />
        <AppButton icon={<SettingOutlined />} onClick={handleBack} type="link">
          {t("executionFactory.toolboxDetailBack")}
        </AppButton>
      </div>

      {record ? (
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.titleRow}>
              <Title className={styles.title} level={3}>
                {record.name}
              </Title>
              {statusTag}
            </div>
            <Paragraph className={styles.description}>
              {record.description || "-"}
            </Paragraph>
            <div className={styles.metaRow}>
              <span>
                <ApiOutlined />{" "}
                {t("executionFactory.mcpToolCountLabel", { count: toolCount })}
              </span>
              <span>
                <ClockCircleOutlined />{" "}
                {formatExecutionUnitTime(record.updateTime)}
              </span>
            </div>
          </div>
          {viewMode ? (
            <Space>
              <PermissionGate permissions="execution-factory:mcp:edit">
                <AppButton onClick={handleEnterEditMode} type="primary">
                  {t("executionFactory.mcpDetailEnterEdit")}
                </AppButton>
              </PermissionGate>
            </Space>
          ) : (
            <Space>
              {!record.isInternal ? (
                <PermissionGate permissions="execution-factory:impex:export">
                  <AppButton
                    icon={<DownloadOutlined />}
                    loading={isExporting("mcp", mcpId)}
                    onClick={() => {
                      void exportComponentById("mcp", mcpId, record.name);
                    }}
                  >
                    {t("executionFactory.cardMenu.export")}
                  </AppButton>
                </PermissionGate>
              ) : null}
              <PermissionGate permissions="execution-factory:mcp:edit">
                <AppButton onClick={() => setEditDrawerOpen(true)} type="primary">
                  {t("executionFactory.cardMenu.edit")}
                </AppButton>
              </PermissionGate>
            </Space>
          )}
        </div>
      ) : null}

      {loadError ? (
        <Alert message={loadError} showIcon style={{ marginBottom: 16 }} type="error" />
      ) : null}

      {!loading && !loadError ? (
        <Alert
          message={
            viewMode
              ? t("executionFactory.mcpDetailViewHint")
              : t("executionFactory.mcpDetailEditHint")
          }
          showIcon
          style={{ marginBottom: 16 }}
          type="info"
        />
      ) : null}

      {toolsLoadError && catalogContext ? (
        <Alert message={t("executionFactory.mcpDetailCatalogToolsHint")} showIcon style={{ marginBottom: 16 }} type="warning" />
      ) : null}

      {loading ? (
        <div className={styles.emptyWrap}>
          <Spin size="large" />
        </div>
      ) : tools.length === 0 ? (
        <div className={styles.emptyWrap}>
          <Empty description={t("executionFactory.mcpToolsEmpty")} />
        </div>
      ) : (
        <Layout className={styles.layout}>
          <Sider className={styles.sider} width={320}>
            <div className={styles.siderHeader}>
              <span>
                <ApiOutlined />{" "}
                {t("executionFactory.mcpToolsSectionTitle")} ({tools.length})
              </span>
            </div>
            <div className={styles.toolList}>
              {tools.map((item, index) => {
                const active = selectedTool?.name === item.name;

                return (
                  <div
                    className={`${styles.toolItem} ${active ? styles.toolItemActive : ""}`}
                    key={item.name}
                    onClick={() => setSelectedTool(item)}
                  >
                    <div className={styles.toolItemTop}>
                      <span className={styles.toolIndex}>{index + 1}</span>
                      <span className={styles.toolName}>{item.name}</span>
                    </div>
                    <div className={styles.toolDesc}>{item.description || "-"}</div>
                    <div className={styles.toolItemFooter}>
                      <PermissionGate permissions="execution-factory:mcp:debug">
                        <AppButton
                          icon={<BugOutlined />}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTool(item);
                            setDebugToolName(item.name);
                          }}
                          size="small"
                          type="link"
                        >
                          {t("executionFactory.debug")}
                        </AppButton>
                      </PermissionGate>
                    </div>
                  </div>
                );
              })}
            </div>
          </Sider>
          <Content className={styles.content}>
            {selectedTool ? (
              <>
                <DetailMetaPanel
                  columns={3}
                  items={toolInfoItems}
                  title={t("executionFactory.mcpToolInfoTitle")}
                />
                <div className={styles.ioPanel}>
                  <div className={styles.ioHeader}>
                    <span>{t("executionFactory.toolboxInputOutputTitle")}</span>
                    <PermissionGate permissions="execution-factory:mcp:debug">
                      <AppButton onClick={() => setDebugToolName(selectedTool.name)} type="primary">
                        {t("executionFactory.debug")}
                      </AppButton>
                    </PermissionGate>
                  </div>
                  <JsonSchemaIoPanel schema={selectedTool.inputSchema} />
                </div>
              </>
            ) : (
              <div className={styles.emptyWrap}>
                <Empty />
              </div>
            )}
          </Content>
        </Layout>
      )}

      <CreateMcpDrawer
        mcpId={mcpId}
        onClose={() => setEditDrawerOpen(false)}
        onUpdated={() => {
          setEditDrawerOpen(false);
          void loadTools();
        }}
        open={editDrawerOpen}
      />

      {debugToolName ? (
        <McpToolDebugModal
          inputSchema={tools.find((tool) => tool.name === debugToolName)?.inputSchema}
          mcpId={mcpId}
          onClose={() => setDebugToolName(null)}
          open={Boolean(debugToolName)}
          toolName={debugToolName}
        />
      ) : null}
    </section>
  );
}

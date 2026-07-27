/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  IdcardOutlined,
  KeyOutlined,
  LinkOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Layout, Spin, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { McpDetailSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  CapabilityIoCounts,
  CapabilityReadinessHint,
  CapabilityReadinessScore,
} from "@/modules/execution-factory/components/CapabilityReadiness";
import { DetailBasicInfoButton } from "@/modules/execution-factory/components/DetailBasicInfoButton";
import { DetailMetaPanel } from "@/modules/execution-factory/components/DetailMetaPanel";
import { EntityListRail } from "@/modules/execution-factory/components/EntityListRail";
import { CreateMcpDrawer } from "@/modules/execution-factory/components/create-menu/CreateMcpDrawer";
import { JsonSchemaIoPanel } from "@/modules/execution-factory/components/JsonSchemaIoPanel";
import { McpToolDebugModal } from "@/modules/execution-factory/components/McpToolDebugModal";
import {
  getMcpDetail,
  getMcpMarket,
  listMcpTools,
} from "@/modules/execution-factory/services/mcp.service";
import type { McpDetail, McpProxyTool, McpStatus } from "@/modules/execution-factory/types/mcp";
import { buildMcpToolCapabilityManifest } from "@/modules/execution-factory/utils/capability-manifest";
import {
  formatOptionalTimestamp,
  formatRecordHeaders,
  resolveMcpCategoryLabel,
  resolveMcpCreationTypeLabel,
} from "@/modules/execution-factory/utils/detail-display";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";
import { useImpexExport } from "@/modules/execution-factory/utils/use-impex-export";

import styles from "./toolbox-detail.module.css";

const { Sider, Content } = Layout;

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
  const [searchParams] = useSearchParams();
  const catalogContext = searchParams.get("from") === "catalog";
  const [record, setRecord] = useState<McpDetail | null>(null);
  const [tools, setTools] = useState<McpProxyTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpProxyTool | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toolsLoadError, setToolsLoadError] = useState<string | null>(null);
  const [debugToolName, setDebugToolName] = useState<string | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [railKeyword, setRailKeyword] = useState("");
  const { exportComponentById, isExporting } = useImpexExport();

  // MCP 工具一次性全量拉回来（listMcpTools 没分页），筛选放本地做。
  const visibleTools = useMemo(() => {
    const keyword = railKeyword.trim().toLowerCase();
    return keyword
      ? tools.filter((item) => item.name.toLowerCase().includes(keyword))
      : tools;
  }, [railKeyword, tools]);

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

  // 原来只在 MCP 详情抽屉里露过，卡片改直连本页后搬到页面上，否则这些字段就没入口了。
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
        value: resolveMcpCreationTypeLabel(record.creationType, t),
        icon: <ApiOutlined />,
        variant: "accent" as const,
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
        key: "toolCount",
        label: t("executionFactory.mcpToolCountFieldLabel"),
        value: t("executionFactory.toolCountLabel", { count: toolCount }),
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
  }, [record, t, toolCount]);


  const selectedToolManifest = useMemo(() => {
    if (!record || !selectedTool) {
      return null;
    }

    return buildMcpToolCapabilityManifest({
      mcpId,
      serviceName: record.name,
      tool: selectedTool,
    });
  }, [mcpId, record, selectedTool]);

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderMain}>
          <button
            aria-label={t("common.back")}
            className={styles.backChevron}
            onClick={handleBack}
            type="button"
          >
            <ArrowLeftOutlined />
          </button>
          <span className={styles.pageHeaderIcon}>
            <ApiOutlined />
          </span>
          <h1 className={styles.pageHeaderTitle}>
            {record?.name ?? t("executionFactory.mcpDetailTitle")}
          </h1>
          {record ? statusTag : null}
        </div>
        {record ? (
          <div className={styles.pageHeaderActions}>
            {/* 进来即可用：不再要求先点「编辑 MCP」切态。基础信息统一走抽屉；市场预览态（from=catalog）不给编辑/导出入口。 */}
            <DetailBasicInfoButton items={basicInfoItems} />
            {!catalogContext ? (
              <>
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
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {record ? (
        <div className={styles.pageSubline}>
          {record.description ? <span>{record.description}</span> : null}
          <span>
            <ApiOutlined /> {t("executionFactory.mcpToolCountLabel", { count: toolCount })}
          </span>
          <span>
            <ClockCircleOutlined /> {formatExecutionUnitTime(record.updateTime)}
          </span>
        </div>
      ) : null}

      {loadError ? (
        <Alert message={loadError} showIcon style={{ marginBottom: 16 }} type="error" />
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
            <EntityListRail
              activeId={selectedTool?.name ?? null}
              emptyText={t("executionFactory.mcpToolListEmptyFiltered")}
              icon={<ApiOutlined />}
              items={visibleTools.map((item) => ({
                id: item.name,
                name: item.name,
              }))}
              onSelect={(name) => {
                const target = tools.find((item) => item.name === name);
                if (target) {
                  setSelectedTool(target);
                }
              }}
              search={{
                onChange: setRailKeyword,
                placeholder: t("executionFactory.mcpFilterTools"),
                value: railKeyword,
              }}
              title={t("executionFactory.mcpToolListTitle", { count: tools.length })}
            />
          </Sider>
          <Content className={styles.content}>
            {selectedTool ? (
              <>
                <DetailMetaPanel
                  className={styles.section}
                  footer={
                    selectedToolManifest ? (
                      <CapabilityReadinessHint manifest={selectedToolManifest} />
                    ) : undefined
                  }
                  headerAside={
                    selectedToolManifest ? (
                      <div className={styles.toolHeaderAside}>
                        <CapabilityReadinessScore manifest={selectedToolManifest} />
                      </div>
                    ) : undefined
                  }
                  items={[]}
                  subheader={
                    // 与 HTTP 工具详情同构：描述直接接在标题下，不再作为 dl 里的一行。
                    // MCP 工具的名称和描述由服务端 tools/list 给出，本地改不了,
                    // 所以这里是只读文本，没有 HTTP 那侧的 InlineEditableText。
                    <div className={styles.toolIdentity}>
                      <div className={styles.toolIdentityDesc}>
                        {selectedTool.description ||
                          t("executionFactory.agentReadiness.emptyIntent", {
                            defaultValue:
                              "暂未补充业务用途，Agent 只能基于名称和技术 schema 推断使用方式。",
                          })}
                      </div>
                    </div>
                  }
                  title={
                    <span className={styles.toolIdentityTitle}>
                      <span className={styles.apiBadge}>mcp</span>
                      <span className={styles.toolIdentityName}>{selectedTool.name}</span>
                    </span>
                  }
                  variant="plain"
                />
                <div className={styles.ioPanel}>
                  <div className={styles.ioHeader}>
                    <span>
                      {t("executionFactory.toolboxInputOutputTitle")}
                      {selectedToolManifest ? (
                        <CapabilityIoCounts manifest={selectedToolManifest} />
                      ) : null}
                    </span>
                    <PermissionGate permissions="execution-factory:mcp:debug">
                      <AppButton onClick={() => setDebugToolName(selectedTool.name)} type="primary">
                        {t("executionFactory.debug")}
                      </AppButton>
                    </PermissionGate>
                  </div>
                  <JsonSchemaIoPanel
                    outputSchema={selectedTool.outputSchema}
                    schema={selectedTool.inputSchema}
                  />
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

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ArrowLeftOutlined,
  BarsOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Layout, Space, Spin, Switch, Tag } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { ToolboxToolsSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
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
import {
  EntityListRail,
  EntityListTag,
} from "@/modules/execution-factory/components/EntityListRail";
import { HttpMethodTag } from "@/modules/execution-factory/components/HttpMethodTag";
import { InlineEditableText } from "@/modules/execution-factory/components/InlineEditableText";
import { ToolDebugModal } from "@/modules/execution-factory/components/ToolDebugModal";
import { ToolFormDrawer } from "@/modules/execution-factory/components/ToolFormDrawer";
import { ToolIoPanel } from "@/modules/execution-factory/components/ToolIoPanel";
import { AddCapabilityWizard } from "@/modules/execution-factory/components/create-menu/AddCapabilityWizard";
import {
  HTTP_API_CAPABILITY_MODES,
  isCapabilityUxV2,
} from "@/modules/execution-factory/utils/capability-ux";
import { getToolbox, getToolboxMarket } from "@/modules/execution-factory/services/toolbox.service";
import {
  deleteTools,
  getToolDetail,
  listTools,
  updateTool,
  updateToolStatus,
} from "@/modules/execution-factory/services/tool.service";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import type { ToolRecord, ToolRunLogEntry, ToolStatus } from "@/modules/execution-factory/types/tool";
import {
  buildToolCapabilityManifest,
  hasCapabilityIoFacts,
} from "@/modules/execution-factory/utils/capability-manifest";
import { buildToolboxBasicInfoItems } from "@/modules/execution-factory/utils/toolbox-info-items";
import { formatAuditUserDisplay } from "@/modules/execution-factory/utils/audit-user-display";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";
import { useAuditUserDirectory } from "@/modules/execution-factory/utils/use-audit-user-directory";
import { useImpexExport } from "@/modules/execution-factory/utils/use-impex-export";

import styles from "./toolbox-detail.module.css";

const { Sider, Content } = Layout;

export function ToolboxToolsScene({ boxId, onBack }: ToolboxToolsSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogContext = searchParams.get("from") === "catalog";
  // Enter in editing mode. Only marketplace preview (from=catalog, another domain's toolbox) stays
  // read-only; do not require an Edit tool action first. Individual PermissionGates still protect writes.
  const viewMode = catalogContext;
  const [toolbox, setToolbox] = useState<ToolboxRecord | null>(null);
  const [items, setItems] = useState<ToolRecord[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolRecord | null>(null);
  const [selectedToolDetail, setSelectedToolDetail] = useState<Awaited<
    ReturnType<typeof getToolDetail>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | null>(null);
  const [editToolId, setEditToolId] = useState<string | null>(null);
  // Request sequence for tool selection, used to discard stale detail responses during rapid changes.
  const selectRequestRef = useRef(0);
  const [debugRecord, setDebugRecord] = useState<ToolRecord | null>(null);
  const [toolRunLogs, setToolRunLogs] = useState<ToolRunLogEntry[]>([]);
  const [quickAddApiOpen, setQuickAddApiOpen] = useState(false);
  const capabilityUxV2 = isCapabilityUxV2();
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [railKeyword, setRailKeyword] = useState("");
  const { exportComponentById, isExporting } = useImpexExport();
  const auditUserDirectory = useAuditUserDirectory();

  const loadToolbox = useCallback(async () => {
    try {
      const record = catalogContext
        ? await getToolboxMarket(boxId)
        : await getToolbox(boxId);
      setToolbox(record);
    } catch {
      setToolbox(null);
    }
  }, [boxId, catalogContext]);

  const loadTools = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listTools(boxId, {
        page: 1,
        pageSize: 100,
      });
      setItems(listResult.items);
      setSelectedToolIds([]);

      if (listResult.items[0]) {
        const detail = await getToolDetail(boxId, listResult.items[0].toolId);
        setSelectedTool(detail);
        setSelectedToolDetail(detail);
      } else {
        setSelectedTool(null);
        setSelectedToolDetail(null);
      }
    } catch (error) {
      setItems([]);
      setSelectedTool(null);
      setSelectedToolDetail(null);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [boxId]);

  useEffect(() => {
    void loadToolbox();
  }, [loadToolbox]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  useEffect(() => {
    if (viewMode || loading || searchParams.get("create") !== "1") {
      return;
    }

    setFormMode("create");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }, [loading, searchParams, setSearchParams, viewMode]);

  const isFunctionToolbox = toolbox?.metadataType === "function";

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (window.history.length > 1) {
      void navigate(-1);
      return;
    }

    // Toolboxes split into API and function views; return to the one containing the toolbox.
    const viewQuery = `&toolboxView=${isFunctionToolbox ? "function" : "openapi"}`;
    void navigate(
      catalogContext
        ? `/execution-factory/catalog?activeTab=toolbox${viewQuery}`
        : `/execution-factory/units?activeTab=toolbox${viewQuery}`,
    );
  };

  const handleSelectTool = async (tool: ToolRecord) => {
    // During rapid selection, do not let the first detail response overwrite the later selection; number requests and compare the latest before writing.
    const requestId = selectRequestRef.current + 1;
    selectRequestRef.current = requestId;
    setSelectedTool(tool);
    // Details are per tool, so clear them on switch. Retaining a previous tool's details briefly
    // shows its schema and makes inline saves use the wrong snapshot.
    setSelectedToolDetail(null);
    setToolRunLogs([]);

    try {
      const detail = await getToolDetail(boxId, tool.toolId);
      if (selectRequestRef.current !== requestId) {
        return;
      }
      setSelectedTool(detail);
      setSelectedToolDetail(detail);
    } catch {
      if (selectRequestRef.current !== requestId) {
        return;
      }
      setSelectedToolDetail(null);
    }
  };

  const handleDebugRunComplete = (entry: ToolRunLogEntry) => {
    setToolRunLogs((current) => [entry, ...current].slice(0, 20));
  };

  /**
   * Click-to-edit names/descriptions. updateTool replaces the whole payload, including data,
   * use_rule, and global_parameters, so write from the complete selectedToolDetail snapshot. If
   * details are unavailable, do not save: use the edit drawer rather than overwrite an OpenAPI spec with a partial payload.
   */
  const handleInlinePatch = useCallback(
    async (patch: { description?: string; name?: string }) => {
      if (catalogContext || !selectedTool) {
        return;
      }

      const nextName = (patch.name ?? selectedTool.name).trim();
      const nextDescription = patch.description ?? selectedTool.description ?? "";

      if (!nextName) {
        void message.error(t("common.required"));
        return;
      }

      if (
        nextName === selectedTool.name &&
        nextDescription === (selectedTool.description ?? "")
      ) {
        return;
      }

      const detail = selectedToolDetail;
      // Details load asynchronously and may remain a prior tool's snapshot while switching. A
      // non-null check is insufficient: using it would write the previous tool's openapiSpec onto the current tool.
      if (!detail || detail.toolId !== selectedTool.toolId) {
        void message.error(t("common.requestFailed"));
        return;
      }

      const { toolId } = selectedTool;

      try {
        await updateTool(boxId, toolId, {
          description: nextDescription,
          functionInput: detail.functionInput,
          globalParameters: detail.globalParameters,
          metadataType: detail.metadataType,
          name: nextName,
          openapiSpec: detail.openapiSpec,
          useRule: detail.useRule,
        });
        setSelectedTool((current) =>
          current && current.toolId === toolId
            ? { ...current, description: nextDescription, name: nextName }
            : current,
        );
        setSelectedToolDetail((current) =>
          current && current.toolId === toolId
            ? { ...current, description: nextDescription, name: nextName }
            : current,
        );
        setItems((current) =>
          current.map((item) =>
            item.toolId === toolId
              ? { ...item, description: nextDescription, name: nextName }
              : item,
          ),
        );
        void message.success(t("common.success"));
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    },
    [boxId, catalogContext, message, selectedTool, selectedToolDetail, t],
  );

  /** Marketplace preview and users without tool:edit see plain text with no click entry point. */
  const renderToolEditable = (editable: ReactNode, readOnly: ReactNode) =>
    catalogContext ? (
      readOnly
    ) : (
      <PermissionGate fallback={readOnly} permissions="execution-factory:tool:edit">
        {editable}
      </PermissionGate>
    );

  const handleToggleStatus = useCallback((tool: ToolRecord) => {
    // Marketplace preview is read-only. A render-layer guard can be bypassed with ?action=edit,
    // so enforce the write gate in the handler to avoid changing another domain's toolbox.
    if (catalogContext) {
      return;
    }
    const nextStatus: ToolStatus = tool.status === "enabled" ? "disabled" : "enabled";

    void modal.confirm({
      title: t("executionFactory.toolStatusChangeConfirmTitle"),
      content: t("executionFactory.toolStatusChangeConfirmDescription", {
        name: tool.name,
        status: t(`executionFactory.toolStatuses.${nextStatus}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await updateToolStatus(boxId, [tool.toolId], nextStatus);
        void message.success(t("common.success"));
        await loadTools();
      },
    });
  }, [boxId, catalogContext, loadTools, message, modal, t]);

  const handleBatchStatus = (nextStatus: ToolStatus) => {
    // Marketplace preview is read-only. viewMode hides bulk UI, but keep the write-side handler
    // gate consistent with handleToggleStatus rather than relying on rendering alone.
    if (catalogContext) {
      return;
    }
    if (selectedToolIds.length === 0) {
      return;
    }

    void modal.confirm({
      title: t("executionFactory.toolBatchStatusConfirmTitle"),
      content: t("executionFactory.toolBatchStatusConfirmDescription", {
        count: selectedToolIds.length,
        status: t(`executionFactory.toolStatuses.${nextStatus}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await updateToolStatus(boxId, selectedToolIds, nextStatus);
        void message.success(t("common.success"));
        await loadTools();
      },
    });
  };

  const handleBatchDelete = () => {
    // Marketplace preview is read-only: enforce the write gate in the handler, not only the render-layer guard.
    if (catalogContext) {
      return;
    }
    if (selectedToolIds.length === 0) {
      return;
    }

    void modal.confirm({
      title: t("executionFactory.toolBatchDeleteConfirmTitle"),
      content: t("executionFactory.toolBatchDeleteConfirmDescription", {
        count: selectedToolIds.length,
      }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await deleteTools(boxId, selectedToolIds);
        void message.success(t("common.success"));
        await loadTools();
      },
    });
  };

  const toggleToolSelection = (toolId: string, checked: boolean) => {
    setSelectedToolIds((current) =>
      checked ? [...new Set([...current, toolId])] : current.filter((id) => id !== toolId),
    );
  };

  /**
   * Input/output tags for list cards. They use buildToolCapabilityManifest just like the right-side
   * Input/Output row, preventing one tool from showing two different counts on the same screen.
   */
  const renderToolIoTags = (tool: ToolRecord) => {
    const manifest = buildToolCapabilityManifest(tool);

    // Do not render labels without queryable input/output facts from the backend; missing metadata is not zero inputs and zero outputs.
    if (!hasCapabilityIoFacts(manifest)) {
      return null;
    }

    return (
      <>
        <EntityListTag>
          {t("executionFactory.ioInCount", { count: manifest.inputSemantics?.length ?? 0 })}
        </EntityListTag>
        <EntityListTag>
          {t("executionFactory.ioOutCount", { count: manifest.outputSemantics?.length ?? 0 })}
        </EntityListTag>
      </>
    );
  };

  // Load up to 100 tools once with loadTools and filter locally; no backend filtering is needed.
  const visibleItems = useMemo(() => {
    const keyword = railKeyword.trim().toLowerCase();
    return keyword
      ? items.filter((item) => item.name.toLowerCase().includes(keyword))
      : items;
  }, [items, railKeyword]);

  const statusTag = useMemo(() => {
    if (!toolbox?.status) {
      return null;
    }

    const style: CSSProperties =
      toolbox.status === "published"
        ? {
            background: "var(--color-success-bg)",
            borderColor: "var(--color-success-border)",
            color: "var(--color-success-text)",
          }
        : toolbox.status === "offline"
          ? {
              background: "var(--color-error-bg)",
              borderColor: "var(--color-error-border)",
              color: "var(--color-error-text)",
            }
          : {
              background: "var(--color-info-bg)",
              borderColor: "var(--color-info-border)",
              color: "var(--color-info-text)",
            };

    return (
      <Tag style={style}>
        {t(`executionFactory.toolboxStatuses.${toolbox.status}`)}
      </Tag>
    );
  }, [t, toolbox?.status]);

  const renderToolboxExportButton = () => {
    if (!toolbox || toolbox.isInternal) {
      return null;
    }

    return (
      <PermissionGate permissions="execution-factory:impex:export">
        <AppButton
          icon={<DownloadOutlined />}
          loading={isExporting("toolbox", boxId)}
          onClick={() => {
            void exportComponentById("toolbox", boxId, toolbox.name);
          }}
        >
          {t("executionFactory.cardMenu.export")}
        </AppButton>
      </PermissionGate>
    );
  };

  // These fields were previously visible only in the toolbox detail drawer. Move them here now that cards link directly to this page.
  const toolboxInfoItems = useMemo(
    () =>
      toolbox
        ? buildToolboxBasicInfoItems(toolbox, {
            t,
            auditUserDirectory,
            toolCount: items.length || toolbox.toolCount || 0,
            includeRelease: true,
          })
        : [],
    [auditUserDirectory, items.length, t, toolbox],
  );

  const selectedToolManifest = useMemo(() => {
    if (selectedToolDetail) {
      return buildToolCapabilityManifest(selectedToolDetail);
    }

    if (!selectedTool) {
      return null;
    }

    return buildToolCapabilityManifest(selectedTool);
  }, [selectedTool, selectedToolDetail]);

  return (
    <>
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
              {isFunctionToolbox ? <CodeOutlined /> : <ToolOutlined />}
            </span>
            <h1 className={styles.pageHeaderTitle}>
              {toolbox?.name ?? t("executionFactory.toolboxToolsPageTitle")}
            </h1>
            {toolbox ? statusTag : null}
          </div>
          {toolbox ? (
            <div className={styles.pageHeaderActions}>
              <Space>
                <DetailBasicInfoButton items={toolboxInfoItems} />
                {renderToolboxExportButton()}
                {/* 市场预览态（from=catalog）看的是别的域的工具箱，只读，不给任何编辑入口。 */}
                {!catalogContext && !toolbox.isInternal ? (
                  <PermissionGate permissions="execution-factory:toolbox:edit">
                    <AppButton
                      onClick={() => {
                        void navigate(`/execution-factory/toolboxes/${boxId}/edit`);
                      }}
                    >
                      {t("executionFactory.toolboxEditTitle")}
                    </AppButton>
                  </PermissionGate>
                ) : null}
                {!catalogContext ? (
                  <PermissionGate permissions="execution-factory:tool:create">
                    <AppButton
                      onClick={() => {
                        if (capabilityUxV2 && !isFunctionToolbox) {
                          setQuickAddApiOpen(true);
                          return;
                        }
                        setFormMode("create");
                      }}
                      type="primary"
                    >
                      {capabilityUxV2 && !isFunctionToolbox
                        ? t("executionFactory.addApiButton")
                        : t("common.create")}
                    </AppButton>
                  </PermissionGate>
                ) : null}
              </Space>
            </div>
          ) : null}
        </div>

        {toolbox ? (
          <div className={styles.pageSubline}>
            {toolbox.description ? <span>{toolbox.description}</span> : null}
            <span>
              {t("executionFactory.toolCountLabel", {
                count: items.length || toolbox.toolCount || 0,
              })}
            </span>
            <span>
              <ClockCircleOutlined /> {formatExecutionUnitTime(toolbox.updateTime)}
            </span>
            {toolbox.updateUser ? (
              <span>
                <UserOutlined />{" "}
                {formatAuditUserDisplay({ directory: auditUserDirectory, id: toolbox.updateUser })}
              </span>
            ) : null}
          </div>
        ) : null}

        {loadError ? (
          <Alert message={loadError} showIcon style={{ marginBottom: 16 }} type="error" />
        ) : null}

        {loading ? (
          <div className={styles.emptyWrap}>
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyWrap}>
            <Empty description={t("executionFactory.toolsEmpty")}>
              {!viewMode ? (
                <Space direction="vertical" size={16} style={{ marginTop: 16, width: "100%" }}>
                  {isFunctionToolbox ? (
                    <Alert message={t("executionFactory.functionToolCreateHint")} showIcon type="info" />
                  ) : null}
                  <Space>
                    <PermissionGate permissions="execution-factory:tool:create">
                      <AppButton
                        onClick={() => {
                          if (capabilityUxV2 && !isFunctionToolbox) {
                            setQuickAddApiOpen(true);
                            return;
                          }
                          setFormMode("create");
                        }}
                        type="primary"
                      >
                        {capabilityUxV2 && !isFunctionToolbox
                          ? t("executionFactory.addApiButton")
                          : t("common.create")}
                      </AppButton>
                    </PermissionGate>
                  </Space>
                </Space>
              ) : null}
            </Empty>
          </div>
        ) : (
          <>
            {/* 批量操作栏放在列表区上方全宽处，窄侧栏放不下会换行。 */}
            {!viewMode && selectedToolIds.length > 0 ? (
              <div className={styles.batchBar}>
                <span>
                  {t("executionFactory.toolBatchSelectedCount", {
                    count: selectedToolIds.length,
                  })}
                </span>
                <Space size={8}>
                  <AppButton onClick={() => setSelectedToolIds([])} size="small">
                    {t("common.cancel")}
                  </AppButton>
                  <PermissionGate permissions="execution-factory:tool:edit">
                    <AppButton onClick={() => handleBatchStatus("enabled")} size="small">
                      {t("executionFactory.enable")}
                    </AppButton>
                    <AppButton onClick={() => handleBatchStatus("disabled")} size="small">
                      {t("executionFactory.disable")}
                    </AppButton>
                    <AppButton
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleBatchDelete}
                      size="small"
                    >
                      {t("common.delete")}
                    </AppButton>
                  </PermissionGate>
                </Space>
              </div>
            ) : null}
            <Layout
              className={`${styles.layout} ${styles.layoutHeadAligned}`}
            >
            <Sider className={styles.sider} width={320}>
              <EntityListRail
                activeId={selectedTool?.toolId ?? null}
                emptyText={t("executionFactory.toolboxToolListEmptyFiltered")}
                icon={<BarsOutlined />}
                items={visibleItems.map((item) => ({
                  badge: <HttpMethodTag compact method={item.method} />,
                  id: item.toolId,
                  muted: item.status === "disabled",
                  name: item.name,
                  status: {
                    checked: item.status === "enabled",
                    // Marketplace preview (from=catalog) views another domain's toolbox, so show status without a toggle.
                    disabled: catalogContext,
                    label: t(`executionFactory.toolStatuses.${item.status}`),
                    onChange: viewMode ? undefined : () => handleToggleStatus(item),
                  },
                  /*
                    与右侧「输入输出」那行同源：都取 buildToolCapabilityManifest 的口径
                    （入参 = api_spec.parameters，出参 = 响应状态码），免得同一个工具在
                    一屏里给出两个数。查不到出入参事实时 renderToolIoTags 返回 null。
                  */
                  tags: renderToolIoTags(item),
                }))}
                onSelect={(toolId) => {
                  const target = items.find((item) => item.toolId === toolId);
                  if (target) {
                    void handleSelectTool(target);
                  }
                }}
                onToggleSelect={toggleToolSelection}
                search={{
                  onChange: setRailKeyword,
                  placeholder: t("executionFactory.toolboxFilterTools"),
                  value: railKeyword,
                }}
                selectable={!viewMode}
                selectedIds={selectedToolIds}
                /* 与详情区状态开关同口径：需要 tool:edit。手工构造 ?from=catalog&action=edit
                   会让 viewMode 为假，靠这道门禁 + 上面的 disabled 兜住，避免改到别人域里
                   工具的启用状态。 */
                statusPermission="execution-factory:tool:edit"
                title={t("executionFactory.toolboxToolListTitle", {
                  count: items.length,
                })}
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
                      <div className={styles.toolHeaderAside}>
                        <span className={styles.toolStatus}>
                          {/*
                            开关按设计是「不进编辑态也能直接扳」，所以这里不跟着 viewMode 禁用；
                            但仍要门禁：没有 tool:edit 的人不该拿到这个入口，市场预览态（from=catalog）
                            更不该改到别人工具箱里的工具状态。状态文案不进门禁，只读用户也要看得到。
                          */}
                          <PermissionGate permissions="execution-factory:tool:edit">
                            <Switch
                              checked={selectedTool.status === "enabled"}
                              disabled={catalogContext}
                              onChange={() => handleToggleStatus(selectedTool)}
                              size="small"
                            />
                          </PermissionGate>
                          {selectedTool.status === "enabled"
                            ? t("executionFactory.toolboxToolEnabled")
                            : t("executionFactory.toolboxToolDisabled")}
                        </span>
                        {selectedToolManifest ? (
                          <CapabilityReadinessScore manifest={selectedToolManifest} />
                        ) : null}
                      </div>
                    }
                    items={[]}
                    subheader={
                      <div className={styles.toolIdentity}>
                        <div className={styles.toolIdentityDesc}>
                          {renderToolEditable(
                            <InlineEditableText
                              block
                              emptyLabel={t("executionFactory.agentReadiness.emptyIntent")}
                              key={`${selectedTool.toolId}-description`}
                              multiline
                              onChange={(description) => void handleInlinePatch({ description })}
                              rows={2}
                              value={selectedTool.description ?? ""}
                            />,
                            <span
                              className={styles.toolIdentityDescClamp}
                              title={selectedTool.description}
                            >
                              {selectedTool.description ||
                                t("executionFactory.agentReadiness.emptyIntent")}
                            </span>,
                          )}
                        </div>
                      </div>
                    }
                    title={
                      // Align with the function-workbench header: badge plus clickable name instead of a Tool information heading.
                      <span className={styles.toolIdentityTitle}>
                        <span className={styles.apiBadge}>api</span>
                        {renderToolEditable(
                          <InlineEditableText
                            className={styles.toolIdentityNameInput}
                            emptyLabel={t("executionFactory.workbenchClickToName")}
                            key={`${selectedTool.toolId}-name`}
                            onChange={(name) => void handleInlinePatch({ name })}
                            value={selectedTool.name}
                          />,
                          <span className={styles.toolIdentityName}>{selectedTool.name}</span>,
                        )}
                      </span>
                    }
                    variant="plain"
                  />
                  {selectedTool.method || selectedTool.path ? (
                    /*
                      端点信息另起一档：头部只放「徽标 + 名字 + 描述」两行，与函数工作台
                      和 MCP 详情同高；端点挤进头里会把左右两栏的分隔线撑得高低不一。
                    */
                    <div className={`${styles.section} ${styles.endpoint}`}>
                      <div className={styles.endpointRow}>
                        <span className={styles.endpointLabel}>
                          <NodeIndexOutlined />
                          {t("executionFactory.toolEndpointLabel")}
                        </span>
                        <span className={styles.endpointValue}>
                          <HttpMethodTag compact method={selectedTool.method} />
                          <span className={styles.endpointPath}>{selectedTool.path || "-"}</span>
                        </span>
                      </div>
                      <div className={styles.endpointRow}>
                        <span className={styles.endpointLabel}>
                          <LinkOutlined />
                          {t("executionFactory.toolServerRootLabel")}
                        </span>
                        <span className={styles.endpointServer}>
                          {selectedTool.serverUrl || toolbox?.serviceUrl || "-"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className={styles.ioPanel}>
                    <div className={styles.ioHeader}>
                      <span>
                        {t("executionFactory.toolboxInputOutputTitle")}
                        {selectedToolManifest ? (
                          <CapabilityIoCounts manifest={selectedToolManifest} />
                        ) : null}
                      </span>
                      <span className={styles.toolHeaderActions}>
                        {/*
                          市场预览态（from=catalog）看的是别的域的工具箱，不给编辑入口，
                          与「编辑工具箱」按钮的 !catalogContext 守卫对齐。
                        */}
                        {!catalogContext ? (
                          <PermissionGate permissions="execution-factory:tool:edit">
                            <AppButton
                              onClick={() => setEditToolId(selectedTool.toolId)}
                              type="link"
                            >
                              {t("common.edit")}
                            </AppButton>
                          </PermissionGate>
                        ) : null}
                        <PermissionGate permissions="execution-factory:tool:debug">
                          <AppButton onClick={() => setDebugRecord(selectedTool)} type="primary">
                            {t("executionFactory.debug")}
                          </AppButton>
                        </PermissionGate>
                      </span>
                    </div>
                    <ToolIoPanel
                      functionInput={
                        selectedToolDetail?.metadataType === "function"
                          ? selectedToolDetail.functionInput
                          : undefined
                      }
                      ioSpec={selectedToolDetail?.ioSpec}
                      runLogs={toolRunLogs}
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
          </>
        )}
      </section>

      <ToolFormDrawer
        boxId={boxId}
        mode="create"
        onClose={() => setFormMode(null)}
        onSuccess={() => {
          void loadTools();
        }}
        open={formMode === "create"}
        toolboxMetadataType={toolbox?.metadataType}
      />
      <ToolFormDrawer
        boxId={boxId}
        mode="edit"
        onClose={() => setEditToolId(null)}
        onSuccess={() => {
          const editedId = editToolId;
          setEditToolId(null);
          void loadTools();
          if (editedId && selectedTool?.toolId === editedId) {
            void handleSelectTool(selectedTool);
          }
        }}
        open={!catalogContext && editToolId !== null}
        toolId={editToolId ?? undefined}
        toolboxMetadataType={toolbox?.metadataType}
      />
      <AddCapabilityWizard
        allowedModesOverride={HTTP_API_CAPABILITY_MODES}
        contextTab="toolbox"
        initialBoxId={boxId}
        onClose={() => setQuickAddApiOpen(false)}
        onCreated={() => {
          void loadTools();
        }}
        onRefresh={() => {
          void loadTools();
        }}
        open={quickAddApiOpen}
      />
      <ToolDebugModal
        boxId={boxId}
        functionInput={
          selectedToolDetail?.metadataType === "function"
            ? selectedToolDetail.functionInput
            : undefined
        }
        ioSpec={selectedToolDetail?.ioSpec}
        onClose={() => setDebugRecord(null)}
        onRunComplete={handleDebugRunComplete}
        open={Boolean(debugRecord)}
        record={selectedToolDetail ?? debugRecord}
      />
    </>
  );
}

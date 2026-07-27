/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  ArrowLeftOutlined,
  BarsOutlined,
  BugOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  TagOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Checkbox, Empty, Layout, Space, Spin, Switch, Tag } from "antd";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { ToolboxToolsSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CapabilityAgentReadinessPanel } from "@/modules/execution-factory/components/CapabilityAgentReadinessPanel";
import { DetailBasicInfoButton } from "@/modules/execution-factory/components/DetailBasicInfoButton";
import { DetailMetaPanel } from "@/modules/execution-factory/components/DetailMetaPanel";
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
  updateToolStatus,
} from "@/modules/execution-factory/services/tool.service";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import type { ToolRecord, ToolRunLogEntry, ToolStatus } from "@/modules/execution-factory/types/tool";
import { buildToolCapabilityManifest } from "@/modules/execution-factory/utils/capability-manifest";
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
  // 进来即可编辑：只有市场预览（from=catalog，看的是别人域的工具箱）保持只读，
  // 不再要求先点「编辑工具」切到编辑态。写侧仍靠各自的 PermissionGate 兜底。
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
  // 工具选择的请求序号，用于丢弃过期的详情回写（快速切换时旧详情盖新选择）。
  const selectRequestRef = useRef(0);
  const [debugRecord, setDebugRecord] = useState<ToolRecord | null>(null);
  const [toolRunLogs, setToolRunLogs] = useState<ToolRunLogEntry[]>([]);
  const [quickAddApiOpen, setQuickAddApiOpen] = useState(false);
  const capabilityUxV2 = isCapabilityUxV2();
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
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

    // 工具集拆成 API / 函数两个视图，回退要落回工具箱本身所属的那个。
    const viewQuery = `&toolboxView=${isFunctionToolbox ? "function" : "openapi"}`;
    void navigate(
      catalogContext
        ? `/execution-factory/catalog?activeTab=toolbox${viewQuery}`
        : `/execution-factory/units?activeTab=toolbox${viewQuery}`,
    );
  };

  const handleSelectTool = async (tool: ToolRecord) => {
    // 连点两个工具时，先返回的详情别盖住后选中的：给每次选择编号，回写前比对最新编号。
    const requestId = selectRequestRef.current + 1;
    selectRequestRef.current = requestId;
    setSelectedTool(tool);
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

  const handleToggleStatus = useCallback((tool: ToolRecord) => {
    // 市场预览态（from=catalog）只读：渲染层门禁能被 ?action=edit 绕过，写操作的闸
    // 必须落在 handler 里，否则会改到别人域的工具箱。
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
    // 市场预览态只读：批量 UI 靠 viewMode 隐藏进不去，写侧闸仍落在 handler 里，
    // 与 handleToggleStatus 同口径，别只靠渲染层。
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
    // 市场预览态只读：同上，写侧闸落在 handler，不只靠渲染层门禁。
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

  // 原来只在工具箱详情抽屉里露过，卡片改直连本页后搬到页面上，否则这些字段就没入口了。
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

  const toolInfoItems = useMemo(() => {
    if (!selectedTool) {
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
        key: "method",
        label: t("executionFactory.toolboxRequestMethodLabel"),
        value: selectedTool.method ? (
          <span className={styles.methodTag}>{selectedTool.method}</span>
        ) : (
          "-"
        ),
        icon: <ApiOutlined />,
        variant: "accent" as const,
      },
      {
        key: "status",
        label: t("executionFactory.toolboxToolStatusLabel"),
        value: (
          <>
            {/*
              开关按设计是「不进编辑态也能直接扳」，所以这里不跟着 viewMode 禁用；
              但仍要门禁：没有 tool:edit 的人不该拿到这个入口，市场预览态（from=catalog）
              更不该改到别人工具箱里的工具状态。
            */}
            <PermissionGate permissions="execution-factory:tool:edit">
              <Switch
                checked={selectedTool.status === "enabled"}
                disabled={catalogContext}
                onChange={() => handleToggleStatus(selectedTool)}
                size="small"
              />{" "}
            </PermissionGate>
            {selectedTool.status === "enabled"
              ? t("executionFactory.toolboxToolEnabled")
              : t("executionFactory.toolboxToolDisabled")}
          </>
        ),
      },
      {
        key: "description",
        label: t("executionFactory.toolboxToolDescLabel"),
        value: selectedTool.description || t("executionFactory.toolboxNoRule"),
        icon: <FileTextOutlined />,
        span: "full" as const,
      },
      {
        key: "useRule",
        label: t("executionFactory.toolboxToolRuleLabel"),
        value: selectedTool.useRule || t("executionFactory.toolboxNoRule"),
        span: "full" as const,
        variant: "muted" as const,
      },
      {
        key: "serverUrl",
        label: t("executionFactory.toolboxServerUrlLabel"),
        value: selectedTool.serverUrl || toolbox?.serviceUrl || "-",
        icon: <LinkOutlined />,
        span: "full" as const,
        variant: "mono" as const,
      },
      {
        key: "path",
        label: t("executionFactory.toolboxToolPathLabel"),
        value: selectedTool.path || "-",
        icon: <NodeIndexOutlined />,
        variant: "mono" as const,
      },
    ];
  }, [catalogContext, handleToggleStatus, selectedTool, t, toolbox?.serviceUrl]);

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
            <Layout className={styles.layout}>
            <Sider className={styles.sider} width={320}>
              <div className={styles.siderHeader}>
                <span>
                  <BarsOutlined />{" "}
                  {t("executionFactory.toolboxToolListTitle", {
                    count: items.length,
                  })}
                </span>
              </div>
              <div className={styles.toolList}>
                {items.map((item, index) => {
                  const active = selectedTool?.toolId === item.toolId;

                  return (
                    <div
                      className={`${styles.toolItem} ${active ? styles.toolItemActive : ""}`}
                      key={item.toolId}
                      onClick={() => {
                        void handleSelectTool(item);
                      }}
                    >
                      <div className={styles.toolItemTop}>
                        {!viewMode ? (
                          <Checkbox
                            checked={selectedToolIds.includes(item.toolId)}
                            onChange={(event) => {
                              toggleToolSelection(item.toolId, event.target.checked);
                            }}
                            onClick={(event) => event.stopPropagation()}
                          />
                        ) : null}
                        <span className={styles.toolIndex}>{index + 1}</span>
                        <span className={styles.toolName}>{item.name}</span>
                        {item.method ? (
                          <span className={styles.methodTag}>{item.method}</span>
                        ) : null}
                      </div>
                      <div className={styles.toolDesc}>{item.description || "-"}</div>
                      <div className={styles.toolItemFooter}>
                        {/* 与详情区状态开关同口径：需要 tool:edit，且市场预览态禁用。
                            手工构造 ?from=catalog&action=edit 会让 viewMode 为假，靠这两道
                            门禁兜住，避免改到别人域里工具的启用状态。 */}
                        {!viewMode ? (
                          <PermissionGate permissions="execution-factory:tool:edit">
                            <Switch
                              checked={item.status === "enabled"}
                              disabled={catalogContext}
                              onChange={() => handleToggleStatus(item)}
                              onClick={(_, event) => event.stopPropagation()}
                              size="small"
                            />
                          </PermissionGate>
                        ) : null}
                        <PermissionGate permissions="execution-factory:tool:debug">
                          <AppButton
                            icon={<BugOutlined />}
                            onClick={(event) => {
                              event.stopPropagation();
                              void (async () => {
                                await handleSelectTool(item);
                                setDebugRecord(item);
                              })();
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
                    title={t("executionFactory.toolboxToolInfoTitle")}
                    titleExtra={
                      // 市场预览态（from=catalog）看的是别的域的工具箱，不给编辑入口，
                      // 与「编辑工具箱」按钮的 !catalogContext 守卫对齐。写侧闸见下方抽屉 open。
                      !catalogContext ? (
                        <PermissionGate permissions="execution-factory:tool:edit">
                          <AppButton
                            onClick={() => setEditToolId(selectedTool.toolId)}
                            style={{ fontSize: 15, fontWeight: 500, padding: 0 }}
                            type="link"
                          >
                            {t("common.edit")}
                          </AppButton>
                        </PermissionGate>
                      ) : undefined
                    }
                  />
                  {selectedToolManifest ? (
                    <CapabilityAgentReadinessPanel manifest={selectedToolManifest} />
                  ) : null}
                  <div className={styles.ioPanel}>
                    <div className={styles.ioHeader}>
                      <span>{t("executionFactory.toolboxInputOutputTitle")}</span>
                      <div>
                        <PermissionGate permissions="execution-factory:tool:debug">
                          <AppButton
                            onClick={() => setDebugRecord(selectedTool)}
                            type="primary"
                          >
                            {t("executionFactory.debug")}
                          </AppButton>
                        </PermissionGate>
                      </div>
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

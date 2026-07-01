/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  BarsOutlined,
  BugOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { Alert, Breadcrumb, Checkbox, Empty, Layout, Space, Spin, Switch, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { ToolboxToolsSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DetailMetaPanel } from "@/modules/execution-factory/components/DetailMetaPanel";
import { ToolDebugModal } from "@/modules/execution-factory/components/ToolDebugModal";
import { ToolFormDrawer } from "@/modules/execution-factory/components/ToolFormDrawer";
import { ToolIoPanel } from "@/modules/execution-factory/components/ToolIoPanel";
import { AddCapabilityWizard } from "@/modules/execution-factory/components/create-menu/AddCapabilityWizard";
import { ImportOpenApiToolsModal } from "@/modules/execution-factory/components/create-menu/ImportOpenApiToolsModal";
import { isCapabilityUxV2 } from "@/modules/execution-factory/utils/capability-ux";
import { getToolbox, getToolboxMarket } from "@/modules/execution-factory/services/toolbox.service";
import {
  deleteTools,
  getToolDetail,
  listTools,
  updateToolStatus,
} from "@/modules/execution-factory/services/tool.service";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import type { ToolRecord, ToolRunLogEntry, ToolStatus } from "@/modules/execution-factory/types/tool";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";
import { useImpexExport } from "@/modules/execution-factory/utils/use-impex-export";

import styles from "./toolbox-detail.module.css";

const { Sider, Content } = Layout;
const { Paragraph, Title } = Typography;

export function ToolboxToolsScene({ boxId, onBack }: ToolboxToolsSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogContext = searchParams.get("from") === "catalog";
  const viewMode =
    searchParams.get("action") !== "edit" && searchParams.get("create") !== "1";
  const [toolbox, setToolbox] = useState<ToolboxRecord | null>(null);
  const [items, setItems] = useState<ToolRecord[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolRecord | null>(null);
  const [selectedToolDetail, setSelectedToolDetail] = useState<Awaited<
    ReturnType<typeof getToolDetail>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | null>(null);
  const [debugRecord, setDebugRecord] = useState<ToolRecord | null>(null);
  const [toolRunLogs, setToolRunLogs] = useState<ToolRunLogEntry[]>([]);
  const [importOpenApiOpen, setImportOpenApiOpen] = useState(false);
  const [quickAddApiOpen, setQuickAddApiOpen] = useState(false);
  const capabilityUxV2 = isCapabilityUxV2();
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const { exportComponentById, isExporting } = useImpexExport();

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

  const handleEnterEditMode = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("action", "edit");
    nextParams.delete("create");
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
        ? "/execution-factory/catalog?activeTab=toolbox"
        : "/execution-factory/units?activeTab=toolbox",
    );
  };

  const handleSelectTool = async (tool: ToolRecord) => {
    setSelectedTool(tool);
    setToolRunLogs([]);

    try {
      const detail = await getToolDetail(boxId, tool.toolId);
      setSelectedTool(detail);
      setSelectedToolDetail(detail);
    } catch {
      setSelectedToolDetail(null);
    }
  };

  const handleDebugRunComplete = (entry: ToolRunLogEntry) => {
    setToolRunLogs((current) => [entry, ...current].slice(0, 20));
  };

  const handleToggleStatus = (tool: ToolRecord) => {
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
  };

  const handleBatchStatus = (nextStatus: ToolStatus) => {
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

    const color =
      toolbox.status === "published"
        ? "success"
        : toolbox.status === "offline"
          ? "default"
          : "processing";

    return (
      <Tag color={color}>
        {t(`executionFactory.toolboxStatuses.${toolbox.status}`)}
      </Tag>
    );
  }, [t, toolbox?.status]);

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
            <Switch
              checked={selectedTool.status === "enabled"}
              disabled={viewMode}
              onChange={() => handleToggleStatus(selectedTool)}
              size="small"
            />{" "}
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
  }, [handleToggleStatus, selectedTool, t, toolbox?.serviceUrl, viewMode]);

  return (
    <>
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
                title: toolbox?.name ?? t("executionFactory.toolboxToolsPageTitle"),
              },
              {
                title: t("executionFactory.toolboxToolsPageTitle"),
              },
            ]}
          />
          <AppButton icon={<SettingOutlined />} onClick={handleBack} type="link">
            {t("executionFactory.toolboxDetailBack")}
          </AppButton>
        </div>

        {toolbox ? (
          <div className={styles.header}>
            <div className={styles.headerMain}>
              <div className={styles.titleRow}>
                <Title className={styles.title} level={3}>
                  {toolbox.name}
                </Title>
                {statusTag}
              </div>
              <Paragraph className={styles.description}>
                {toolbox.description || "-"}
              </Paragraph>
              <div className={styles.metaRow}>
                <span>
                  {t("executionFactory.toolCountLabel", {
                    count: items.length || toolbox.toolCount || 0,
                  })}
                </span>
                <span>
                  <ClockCircleOutlined />{" "}
                  {formatExecutionUnitTime(toolbox.updateTime)}
                </span>
              </div>
            </div>
            {viewMode ? (
              <Space>
                <PermissionGate permissions="execution-factory:tool:edit">
                  <AppButton onClick={handleEnterEditMode} type="primary">
                    {t("executionFactory.toolboxToolsEnterEdit")}
                  </AppButton>
                </PermissionGate>
              </Space>
            ) : (
              <PermissionGate permissions="execution-factory:tool:create">
                <Space>
                  {!toolbox.isInternal ? (
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
                  ) : null}
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
                  {!isFunctionToolbox ? (
                    <AppButton onClick={() => setImportOpenApiOpen(true)}>
                      {t("executionFactory.importOpenApiToolsButton")}
                    </AppButton>
                  ) : null}
                </Space>
              </PermissionGate>
            )}
          </div>
        ) : null}

        {loadError ? (
          <Alert message={loadError} showIcon style={{ marginBottom: 16 }} type="error" />
        ) : null}

        {!loading && items.length > 0 ? (
          <Alert
            message={
              viewMode
                ? t("executionFactory.toolboxToolsViewHint")
                : t("executionFactory.toolboxToolsDebugHint")
            }
            showIcon
            style={{ marginBottom: 16 }}
            type="info"
          />
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
                      {!isFunctionToolbox ? (
                        <AppButton onClick={() => setImportOpenApiOpen(true)}>
                          {t("executionFactory.importOpenApiToolsButton")}
                        </AppButton>
                      ) : null}
                    </PermissionGate>
                  </Space>
                </Space>
              ) : null}
            </Empty>
          </div>
        ) : (
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
              {!viewMode && selectedToolIds.length > 0 ? (
                <div className={styles.batchBar}>
                  <span>
                    {t("executionFactory.toolBatchSelectedCount", {
                      count: selectedToolIds.length,
                    })}
                  </span>
                  <Space size={8} wrap>
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
                        {!viewMode ? (
                          <Switch
                            checked={item.status === "enabled"}
                            onChange={() => handleToggleStatus(item)}
                            onClick={(_, event) => event.stopPropagation()}
                            size="small"
                          />
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
                      !viewMode ? (
                        <PermissionGate permissions="execution-factory:tool:edit">
                          <AppButton
                            onClick={() =>
                              void navigate(
                                `/execution-factory/toolboxes/${boxId}/tools/${selectedTool.toolId}/edit`,
                              )
                            }
                            type="link"
                          >
                            {t("executionFactory.openToolIde")}
                          </AppButton>
                        </PermissionGate>
                      ) : null
                    }
                  />
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
                        {!viewMode ? (
                          <PermissionGate permissions="execution-factory:tool:edit">
                            <AppButton
                              icon={<SettingOutlined />}
                              onClick={() => {
                                void navigate(
                                  `/execution-factory/toolboxes/${boxId}/tools/${selectedTool.toolId}/edit`,
                                );
                              }}
                              style={{ marginLeft: 8 }}
                            />
                          </PermissionGate>
                        ) : null}
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
        )}
      </section>

      {!viewMode && selectedToolIds.length > 0 ? (
        <div className={styles.batchBarFixed}>
          <span>
            {t("executionFactory.toolBatchSelectedCount", {
              count: selectedToolIds.length,
            })}
          </span>
          <Space size={8} wrap>
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
      <ImportOpenApiToolsModal
        boxId={boxId}
        onClose={() => setImportOpenApiOpen(false)}
        onSuccess={() => {
          void loadTools();
        }}
        open={importOpenApiOpen}
      />
      <AddCapabilityWizard
        contextTab="toolbox"
        initialBoxId={boxId}
        initialMode="quick-api"
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
        record={debugRecord}
      />
    </>
  );
}

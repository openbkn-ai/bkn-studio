import {
  BarsOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Layout, Spin, Switch, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { ToolboxToolsSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ToolDebugModal } from "@/modules/execution-factory/components/ToolDebugModal";
import { ToolFormDrawer } from "@/modules/execution-factory/components/ToolFormDrawer";
import { getToolbox, getToolboxMarket } from "@/modules/execution-factory/services/toolbox.service";
import {
  getTool,
  listTools,
  updateToolStatus,
} from "@/modules/execution-factory/services/tool.service";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import type { ToolRecord, ToolStatus } from "@/modules/execution-factory/types/tool";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

import styles from "./toolbox-detail.module.css";

const { Sider, Content } = Layout;
const { Paragraph, Title } = Typography;

export function ToolboxToolsScene({ boxId, onBack }: ToolboxToolsSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get("action") === "view";
  const [toolbox, setToolbox] = useState<ToolboxRecord | null>(null);
  const [items, setItems] = useState<ToolRecord[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [debugRecord, setDebugRecord] = useState<ToolRecord | null>(null);

  const loadToolbox = useCallback(async () => {
    try {
      const record = viewMode
        ? await getToolboxMarket(boxId)
        : await getToolbox(boxId);
      setToolbox(record);
    } catch {
      setToolbox(null);
    }
  }, [boxId, viewMode]);

  const loadTools = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listTools(boxId, {
        page: 1,
        pageSize: 100,
      });
      setItems(listResult.items);

      if (listResult.items[0]) {
        const detail = await getTool(boxId, listResult.items[0].toolId);
        setSelectedTool(detail);
      } else {
        setSelectedTool(null);
      }
    } catch (error) {
      setItems([]);
      setSelectedTool(null);
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

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate(viewMode ? "/execution-factory/catalog?activeTab=toolbox" : "/execution-factory/units?activeTab=toolbox");
  };

  const handleSelectTool = async (tool: ToolRecord) => {
    try {
      setSelectedTool(await getTool(boxId, tool.toolId));
    } catch {
      setSelectedTool(tool);
    }
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

  return (
    <>
      <section className={styles.page}>
        <div className={styles.backRow} onClick={handleBack}>
          <LeftOutlined />
          {t("executionFactory.toolboxDetailBack")}
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
            {!viewMode ? (
              <PermissionGate permissions="execution-factory:tool:create">
                <AppButton onClick={() => setFormMode("create")} type="primary">
                  {t("common.create")}
                </AppButton>
              </PermissionGate>
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
            <Empty description={t("executionFactory.toolsEmpty")} />
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
                        <span className={styles.toolIndex}>{index + 1}</span>
                        <span className={styles.toolName}>{item.name}</span>
                        {item.method ? (
                          <span className={styles.methodTag}>{item.method}</span>
                        ) : null}
                      </div>
                      <div className={styles.toolDesc}>{item.description || "-"}</div>
                      {!viewMode ? (
                        <div className={styles.toolItemFooter}>
                          <Switch
                            checked={item.status === "enabled"}
                            onChange={() => handleToggleStatus(item)}
                            onClick={(_, event) => event.stopPropagation()}
                            size="small"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Sider>
            <Content className={styles.content}>
              {selectedTool ? (
                <>
                  <div className={styles.infoPanel}>
                    <div className={styles.infoTitle}>
                      <span>{t("executionFactory.toolboxToolInfoTitle")}</span>
                      {!viewMode ? (
                        <PermissionGate permissions="execution-factory:tool:edit">
                          <AppButton
                            onClick={() => setFormMode("edit")}
                            type="link"
                          >
                            {t("common.edit")}
                          </AppButton>
                        </PermissionGate>
                      ) : null}
                    </div>
                    <div className={styles.infoGrid}>
                      <span className={styles.infoLabel}>
                        {t("executionFactory.toolboxToolNameLabel")}
                      </span>
                      <span className={styles.infoValue}>{selectedTool.name}</span>
                      <span className={styles.infoLabel}>
                        {t("executionFactory.toolboxToolDescLabel")}
                      </span>
                      <span className={styles.infoValue}>
                        {selectedTool.description || t("executionFactory.toolboxNoRule")}
                      </span>
                      <span className={styles.infoLabel}>
                        {t("executionFactory.toolboxToolRuleLabel")}
                      </span>
                      <span className={styles.infoValue}>
                        {selectedTool.useRule || t("executionFactory.toolboxNoRule")}
                      </span>
                      <span className={styles.infoLabel}>
                        {t("executionFactory.toolboxServerUrlLabel")}
                      </span>
                      <span className={styles.infoValue}>
                        {selectedTool.serverUrl || toolbox?.serviceUrl || "-"}
                      </span>
                      <span className={styles.infoLabel}>
                        {t("executionFactory.toolboxToolPathLabel")}
                      </span>
                      <span className={styles.infoValue}>
                        {selectedTool.path || "-"}
                      </span>
                      <span className={styles.infoLabel}>
                        {t("executionFactory.toolboxRequestMethodLabel")}
                      </span>
                      <span className={styles.infoValue}>
                        {selectedTool.method ? (
                          <span className={styles.methodTag}>{selectedTool.method}</span>
                        ) : (
                          "-"
                        )}
                      </span>
                      <span className={styles.infoLabel}>
                        {t("executionFactory.toolboxToolStatusLabel")}
                      </span>
                      <span className={styles.infoValue}>
                        <Switch
                          checked={selectedTool.status === "enabled"}
                          disabled={viewMode}
                          onChange={() => handleToggleStatus(selectedTool)}
                          size="small"
                        />{" "}
                        {selectedTool.status === "enabled"
                          ? t("executionFactory.toolboxToolEnabled")
                          : t("executionFactory.toolboxToolDisabled")}
                      </span>
                    </div>
                  </div>
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
                        <AppButton icon={<SettingOutlined />} style={{ marginLeft: 8 }} />
                      </div>
                    </div>
                    <Empty description={t("executionFactory.debugResultTitle")} />
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

      <ToolFormDrawer
        boxId={boxId}
        mode={formMode ?? "create"}
        onClose={() => setFormMode(null)}
        onSuccess={() => {
          void loadTools();
        }}
        open={formMode !== null}
        toolId={formMode === "edit" ? selectedTool?.toolId : undefined}
      />
      <ToolDebugModal
        boxId={boxId}
        onClose={() => setDebugRecord(null)}
        open={Boolean(debugRecord)}
        record={debugRecord}
      />
    </>
  );
}

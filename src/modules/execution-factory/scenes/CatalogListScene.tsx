import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CatalogListSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { InstallFromCatalogModal } from "@/modules/execution-factory/components/InstallFromCatalogModal";
import { McpDetailDrawer } from "@/modules/execution-factory/components/McpDetailDrawer";
import { OperatorDetailDrawer } from "@/modules/execution-factory/components/OperatorDetailDrawer";
import { SkillDetailDrawer } from "@/modules/execution-factory/components/SkillDetailDrawer";
import { ToolboxDetailDrawer } from "@/modules/execution-factory/components/ToolboxDetailDrawer";
import type { ImpexComponentType } from "@/modules/execution-factory/types/impex";
import { listMcpMarket } from "@/modules/execution-factory/services/mcp.service";
import { listOperatorMarket } from "@/modules/execution-factory/services/operator.service";
import { listSkillMarket } from "@/modules/execution-factory/services/skill.service";
import { listToolboxMarket } from "@/modules/execution-factory/services/toolbox.service";
import type {
  OperatorRecord,
  OperatorStatus,
} from "@/modules/execution-factory/types/operator";
import type { McpRecord } from "@/modules/execution-factory/types/mcp";
import type { SkillRecord } from "@/modules/execution-factory/types/skill";
import type { ToolboxRecord, ToolboxStatus } from "@/modules/execution-factory/types/toolbox";

type CatalogTab = "operators" | "toolboxes" | "mcps" | "skills";

import styles from "./execution-factory-list.module.css";

const operatorStatusClassMap: Record<OperatorStatus, string> = {
  published: styles.statusTagPublished,
  editing: styles.statusTagEditing,
  offline: styles.statusTagOffline,
  unpublish: styles.statusTagDefault,
};

const toolboxStatusClassMap: Record<ToolboxStatus, string> = {
  published: styles.statusTagPublished,
  offline: styles.statusTagOffline,
  unpublish: styles.statusTagDefault,
};

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function CatalogListScene({
  defaultKeyword,
  onOpenDetail,
}: CatalogListSceneProps) {
  const { t } = useTranslation();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState();
  const [activeTab, setActiveTab] = useState<CatalogTab>("operators");
  const [operatorItems, setOperatorItems] = useState<OperatorRecord[]>([]);
  const [toolboxItems, setToolboxItems] = useState<ToolboxRecord[]>([]);
  const [mcpItems, setMcpItems] = useState<McpRecord[]>([]);
  const [skillItems, setSkillItems] = useState<SkillRecord[]>([]);
  const [operatorTotal, setOperatorTotal] = useState(0);
  const [toolboxTotal, setToolboxTotal] = useState(0);
  const [mcpTotal, setMcpTotal] = useState(0);
  const [skillTotal, setSkillTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailOperatorId, setDetailOperatorId] = useState<string | null>(null);
  const [detailBoxId, setDetailBoxId] = useState<string | null>(null);
  const [detailMcpId, setDetailMcpId] = useState<string | null>(null);
  const [detailSkillId, setDetailSkillId] = useState<string | null>(null);
  const [installTarget, setInstallTarget] = useState<{
    id: string;
    name: string;
    type: ImpexComponentType;
  } | null>(null);

  const loadOperators = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listOperatorMarket(query);
      setOperatorItems(listResult.items);
      setOperatorTotal(listResult.total);
    } catch (error) {
      setOperatorItems([]);
      setOperatorTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadToolboxes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listToolboxMarket(query);
      setToolboxItems(listResult.items);
      setToolboxTotal(listResult.total);
    } catch (error) {
      setToolboxItems([]);
      setToolboxTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadMcps = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listMcpMarket(query);
      setMcpItems(listResult.items);
      setMcpTotal(listResult.total);
    } catch (error) {
      setMcpItems([]);
      setMcpTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listSkillMarket(query);
      setSkillItems(listResult.items);
      setSkillTotal(listResult.total);
    } catch (error) {
      setSkillItems([]);
      setSkillTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (defaultKeyword) {
      setKeyword(defaultKeyword);
    }
  }, [defaultKeyword, setKeyword]);

  useEffect(() => {
    if (activeTab === "operators") {
      void loadOperators();
      return;
    }

    if (activeTab === "toolboxes") {
      void loadToolboxes();
      return;
    }

    if (activeTab === "mcps") {
      void loadMcps();
      return;
    }

    void loadSkills();
  }, [activeTab, loadMcps, loadOperators, loadSkills, loadToolboxes]);

  const operatorColumns: ColumnsType<OperatorRecord> = [
    {
      dataIndex: "name",
      title: t("executionFactory.operatorName"),
      render: (_, record) => (
        <div className={styles.nameCell}>
          <div className={styles.nameTitle}>{record.name}</div>
          <span className={styles.operatorIdText}>{record.operatorId}</span>
        </div>
      ),
    },
    {
      dataIndex: "version",
      title: t("executionFactory.version"),
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (value: OperatorStatus) => (
        <Tag className={operatorStatusClassMap[value] ?? styles.statusTagDefault}>
          {t(`executionFactory.statuses.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "categoryName",
      title: t("executionFactory.category"),
      render: (value?: string) => value ?? "-",
    },
    {
      dataIndex: "releaseUser",
      title: t("executionFactory.createUser"),
      render: (value?: string) => value ?? "-",
    },
    {
      dataIndex: "updateTime",
      title: t("executionFactory.updateTime"),
      render: (value?: number) => formatTimestamp(value),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <div className={styles.actionGroup}>
          <PermissionGate permissions="execution-factory:catalog:view">
            <AppButton
              onClick={() => {
                if (onOpenDetail) {
                  onOpenDetail(record.operatorId);
                  return;
                }

                setDetailOperatorId(record.operatorId);
              }}
              type="link"
            >
              {t("common.detail")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:catalog:install">
            <AppButton
              onClick={() =>
                setInstallTarget({
                  id: record.operatorId,
                  name: record.name,
                  type: "operator",
                })
              }
              type="link"
            >
              {t("executionFactory.install")}
            </AppButton>
          </PermissionGate>
        </div>
      ),
    },
  ];

  const toolboxColumns: ColumnsType<ToolboxRecord> = [
    {
      dataIndex: "name",
      title: t("executionFactory.toolboxName"),
      render: (_, record) => (
        <div className={styles.nameCell}>
          <div className={styles.nameTitle}>{record.name}</div>
          <span className={styles.operatorIdText}>{record.boxId}</span>
        </div>
      ),
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (value: ToolboxStatus) => (
        <Tag className={toolboxStatusClassMap[value] ?? styles.statusTagDefault}>
          {t(`executionFactory.toolboxStatuses.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "toolCount",
      title: t("executionFactory.toolCount"),
      render: (value?: number) => value ?? 0,
    },
    {
      dataIndex: "categoryName",
      title: t("executionFactory.category"),
      render: (value?: string) => value ?? "-",
    },
    {
      dataIndex: "updateTime",
      title: t("executionFactory.updateTime"),
      render: (value?: number) => formatTimestamp(value),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <div className={styles.actionGroup}>
          <PermissionGate permissions="execution-factory:catalog:view">
            <AppButton onClick={() => setDetailBoxId(record.boxId)} type="link">
              {t("common.detail")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:catalog:install">
            <AppButton
              onClick={() =>
                setInstallTarget({
                  id: record.boxId,
                  name: record.name,
                  type: "toolbox",
                })
              }
              type="link"
            >
              {t("executionFactory.install")}
            </AppButton>
          </PermissionGate>
        </div>
      ),
    },
  ];

  const mcpColumns: ColumnsType<McpRecord> = [
    {
      dataIndex: "name",
      title: t("executionFactory.mcpName"),
      render: (_, record) => (
        <div className={styles.nameCell}>
          <div className={styles.nameTitle}>{record.name}</div>
          <span className={styles.operatorIdText}>{record.mcpId}</span>
        </div>
      ),
    },
    {
      dataIndex: "mode",
      title: t("executionFactory.mcpMode"),
      render: (value?: string) => value ?? "-",
    },
    {
      dataIndex: "category",
      title: t("executionFactory.category"),
      render: (value?: string) => value ?? "-",
    },
    {
      dataIndex: "updateTime",
      title: t("executionFactory.updateTime"),
      render: (value?: number) => formatTimestamp(value),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <div className={styles.actionGroup}>
          <PermissionGate permissions="execution-factory:catalog:view">
            <AppButton onClick={() => setDetailMcpId(record.mcpId)} type="link">
              {t("common.detail")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:catalog:install">
            <AppButton
              onClick={() =>
                setInstallTarget({
                  id: record.mcpId,
                  name: record.name,
                  type: "mcp",
                })
              }
              type="link"
            >
              {t("executionFactory.install")}
            </AppButton>
          </PermissionGate>
        </div>
      ),
    },
  ];

  const skillColumns: ColumnsType<SkillRecord> = [
    {
      dataIndex: "name",
      title: t("executionFactory.skillName"),
      render: (_, record) => (
        <div className={styles.nameCell}>
          <div className={styles.nameTitle}>{record.name}</div>
          <span className={styles.operatorIdText}>{record.skillId}</span>
        </div>
      ),
    },
    {
      dataIndex: "version",
      title: t("executionFactory.version"),
    },
    {
      dataIndex: "categoryName",
      title: t("executionFactory.category"),
      render: (value?: string) => value ?? "-",
    },
    {
      dataIndex: "updateTime",
      title: t("executionFactory.updateTime"),
      render: (value?: number) => formatTimestamp(value),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <PermissionGate permissions="execution-factory:catalog:view">
          <AppButton onClick={() => setDetailSkillId(record.skillId)} type="link">
            {t("common.detail")}
          </AppButton>
        </PermissionGate>
      ),
    },
  ];

  const getSearchPlaceholder = () => {
    if (activeTab === "operators") {
      return t("executionFactory.searchPlaceholder");
    }

    if (activeTab === "toolboxes") {
      return t("executionFactory.toolboxSearchPlaceholder");
    }

    if (activeTab === "mcps") {
      return t("executionFactory.mcpSearchPlaceholder");
    }

    return t("executionFactory.skillSearchPlaceholder");
  };

  const reloadCurrentTab = () => {
    reset();

    if (activeTab === "operators") {
      void loadOperators();
      return;
    }

    if (activeTab === "toolboxes") {
      void loadToolboxes();
      return;
    }

    if (activeTab === "mcps") {
      void loadMcps();
      return;
    }

    void loadSkills();
  };

  return (
    <>
      <section className={styles.contentSurface}>
        <div className={styles.pageIntro}>
          <h2 className={styles.pageIntroTitle}>{t("executionFactory.catalogTitle")}</h2>
          <p className={styles.pageIntroDescription}>
            {t("executionFactory.catalogDescription")}
          </p>
        </div>
        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
              <AppButton icon={<ReloadOutlined />} onClick={reloadCurrentTab}>
                {t("common.refresh")}
              </AppButton>
            </div>
            <span className={styles.toolbarMeta}>
              {t("executionFactory.catalogToolbarHint")}
            </span>
          </div>
          <div className={styles.toolbarFilters}>
            <Input.Search
              allowClear
              className={styles.searchInput}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={setKeyword}
              placeholder={getSearchPlaceholder()}
              value={pageState.keyword}
            />
          </div>
        </div>
        <div className={styles.tabSurface}>
          <Tabs
            activeKey={activeTab}
            items={[
              {
                key: "operators",
                label: t("executionFactory.operatorMarketTab"),
                children: (
                  <div className={styles.tableSurface}>
                    {loadError ? (
                      <Alert
                        action={
                          <AppButton onClick={() => void loadOperators()} type="link">
                            {t("common.retry")}
                          </AppButton>
                        }
                        message={loadError}
                        showIcon
                        type="error"
                      />
                    ) : null}
                    <AppTable
                      columns={operatorColumns}
                      dataSource={operatorItems}
                      loading={loading}
                      locale={{
                        emptyText: (
                          <EmptyStatePanel
                            description={t("executionFactory.catalogEmptyDescription")}
                            title={t("executionFactory.catalogEmpty")}
                          />
                        ),
                      }}
                      onChange={(pagination) => {
                        setPagination(pagination.current ?? 1, pagination.pageSize ?? 10);
                      }}
                      pagination={{
                        current: pageState.page,
                        pageSize: pageState.pageSize,
                        showSizeChanger: true,
                        total: operatorTotal,
                      }}
                      rowKey="operatorId"
                    />
                  </div>
                ),
              },
              {
                key: "toolboxes",
                label: t("executionFactory.toolboxMarketTab"),
                children: (
                  <div className={styles.tableSurface}>
                    {loadError ? (
                      <Alert
                        action={
                          <AppButton onClick={() => void loadToolboxes()} type="link">
                            {t("common.retry")}
                          </AppButton>
                        }
                        message={loadError}
                        showIcon
                        type="error"
                      />
                    ) : null}
                    <AppTable
                      columns={toolboxColumns}
                      dataSource={toolboxItems}
                      loading={loading}
                      locale={{
                        emptyText: (
                          <EmptyStatePanel
                            description={t("executionFactory.toolboxCatalogEmptyDescription")}
                            title={t("executionFactory.toolboxCatalogEmpty")}
                          />
                        ),
                      }}
                      onChange={(pagination) => {
                        setPagination(pagination.current ?? 1, pagination.pageSize ?? 10);
                      }}
                      pagination={{
                        current: pageState.page,
                        pageSize: pageState.pageSize,
                        showSizeChanger: true,
                        total: toolboxTotal,
                      }}
                      rowKey="boxId"
                    />
                  </div>
                ),
              },
              {
                key: "mcps",
                label: t("executionFactory.mcpMarketTab"),
                children: (
                  <div className={styles.tableSurface}>
                    {loadError ? (
                      <Alert
                        action={
                          <AppButton onClick={() => void loadMcps()} type="link">
                            {t("common.retry")}
                          </AppButton>
                        }
                        message={loadError}
                        showIcon
                        type="error"
                      />
                    ) : null}
                    <AppTable
                      columns={mcpColumns}
                      dataSource={mcpItems}
                      loading={loading}
                      locale={{
                        emptyText: (
                          <EmptyStatePanel
                            description={t("executionFactory.mcpCatalogEmptyDescription")}
                            title={t("executionFactory.mcpCatalogEmpty")}
                          />
                        ),
                      }}
                      onChange={(pagination) => {
                        setPagination(pagination.current ?? 1, pagination.pageSize ?? 10);
                      }}
                      pagination={{
                        current: pageState.page,
                        pageSize: pageState.pageSize,
                        showSizeChanger: true,
                        total: mcpTotal,
                      }}
                      rowKey="mcpId"
                    />
                  </div>
                ),
              },
              {
                key: "skills",
                label: t("executionFactory.skillMarketTab"),
                children: (
                  <div className={styles.tableSurface}>
                    {loadError ? (
                      <Alert
                        action={
                          <AppButton onClick={() => void loadSkills()} type="link">
                            {t("common.retry")}
                          </AppButton>
                        }
                        message={loadError}
                        showIcon
                        type="error"
                      />
                    ) : null}
                    <AppTable
                      columns={skillColumns}
                      dataSource={skillItems}
                      loading={loading}
                      locale={{
                        emptyText: (
                          <EmptyStatePanel
                            description={t("executionFactory.skillCatalogEmptyDescription")}
                            title={t("executionFactory.skillCatalogEmpty")}
                          />
                        ),
                      }}
                      onChange={(pagination) => {
                        setPagination(pagination.current ?? 1, pagination.pageSize ?? 10);
                      }}
                      pagination={{
                        current: pageState.page,
                        pageSize: pageState.pageSize,
                        showSizeChanger: true,
                        total: skillTotal,
                      }}
                      rowKey="skillId"
                    />
                  </div>
                ),
              },
            ]}
            onChange={(key) => {
              setActiveTab(key as CatalogTab);
              setPagination(1, pageState.pageSize);
            }}
          />
        </div>
      </section>
      <OperatorDetailDrawer
        marketMode
        onClose={() => setDetailOperatorId(null)}
        open={Boolean(detailOperatorId)}
        operatorId={detailOperatorId}
      />
      <ToolboxDetailDrawer
        boxId={detailBoxId}
        marketMode
        onClose={() => setDetailBoxId(null)}
        open={Boolean(detailBoxId)}
      />
      <McpDetailDrawer
        marketMode
        mcpId={detailMcpId}
        onClose={() => setDetailMcpId(null)}
        open={Boolean(detailMcpId)}
      />
      <SkillDetailDrawer
        marketMode
        onClose={() => setDetailSkillId(null)}
        open={Boolean(detailSkillId)}
        skillId={detailSkillId}
      />
      <InstallFromCatalogModal
        componentId={installTarget?.id ?? ""}
        componentName={installTarget?.name ?? ""}
        componentType={installTarget?.type ?? "operator"}
        onClose={() => setInstallTarget(null)}
        open={Boolean(installTarget)}
      />
    </>
  );
}

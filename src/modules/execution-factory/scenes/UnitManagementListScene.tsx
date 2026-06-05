import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { UnitManagementListSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { OperatorDebugModal } from "@/modules/execution-factory/components/OperatorDebugModal";
import { OperatorDetailDrawer } from "@/modules/execution-factory/components/OperatorDetailDrawer";
import { ToolboxDetailDrawer } from "@/modules/execution-factory/components/ToolboxDetailDrawer";
import {
  deleteOperator,
  listOperators,
  updateOperatorStatus,
} from "@/modules/execution-factory/services/operator.service";
import {
  deleteToolbox,
  listToolboxes,
  updateToolboxStatus,
} from "@/modules/execution-factory/services/toolbox.service";
import type {
  OperatorRecord,
  OperatorStatus,
  PublicOperatorStatus,
} from "@/modules/execution-factory/types/operator";
import type { ToolboxRecord, ToolboxStatus } from "@/modules/execution-factory/types/toolbox";

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

export function UnitManagementListScene({
  defaultKeyword,
  onOpenDetail,
}: UnitManagementListSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState();
  const [activeTab, setActiveTab] = useState<"operators" | "toolboxes">("operators");
  const [selectedStatus, setSelectedStatus] = useState<OperatorStatus>();
  const [selectedToolboxStatus, setSelectedToolboxStatus] = useState<ToolboxStatus>();
  const [operatorItems, setOperatorItems] = useState<OperatorRecord[]>([]);
  const [toolboxItems, setToolboxItems] = useState<ToolboxRecord[]>([]);
  const [operatorTotal, setOperatorTotal] = useState(0);
  const [toolboxTotal, setToolboxTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailOperatorId, setDetailOperatorId] = useState<string | null>(null);
  const [detailBoxId, setDetailBoxId] = useState<string | null>(null);
  const [debugRecord, setDebugRecord] = useState<OperatorRecord | null>(null);

  useEffect(() => {
    if (defaultKeyword) {
      setKeyword(defaultKeyword);
    }
  }, [defaultKeyword, setKeyword]);

  const operatorQuery = useMemo(
    () => ({
      ...query,
      status: selectedStatus,
    }),
    [query, selectedStatus],
  );

  const toolboxQuery = useMemo(
    () => ({
      ...query,
      status: selectedToolboxStatus,
    }),
    [query, selectedToolboxStatus],
  );

  const loadOperators = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listOperators(operatorQuery);
      setOperatorItems(listResult.items);
      setOperatorTotal(listResult.total);
    } catch (error) {
      setOperatorItems([]);
      setOperatorTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [operatorQuery]);

  const loadToolboxes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listToolboxes(toolboxQuery);
      setToolboxItems(listResult.items);
      setToolboxTotal(listResult.total);
    } catch (error) {
      setToolboxItems([]);
      setToolboxTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [toolboxQuery]);

  useEffect(() => {
    if (activeTab === "operators") {
      void loadOperators();
      return;
    }

    void loadToolboxes();
  }, [activeTab, loadOperators, loadToolboxes]);

  const openDetail = (operatorId: string) => {
    if (onOpenDetail) {
      onOpenDetail(operatorId);
      return;
    }

    setDetailOperatorId(operatorId);
  };

  const handleStatusChange = (
    record: OperatorRecord,
    status: PublicOperatorStatus,
  ) => {
    void modal.confirm({
      title: t("executionFactory.statusChangeConfirmTitle"),
      content: t("executionFactory.statusChangeConfirmDescription", {
        name: record.name,
        status: t(`executionFactory.statuses.${status}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await updateOperatorStatus(record.operatorId, status);
        void message.success(t("common.success"));
        await loadOperators();
      },
    });
  };

  const handleToolboxStatusChange = (
    record: ToolboxRecord,
    status: ToolboxStatus,
  ) => {
    void modal.confirm({
      title: t("executionFactory.toolboxStatusChangeConfirmTitle"),
      content: t("executionFactory.toolboxStatusChangeConfirmDescription", {
        name: record.name,
        status: t(`executionFactory.toolboxStatuses.${status}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await updateToolboxStatus(record.boxId, status);
        void message.success(t("common.success"));
        await loadToolboxes();
      },
    });
  };

  const handleToolboxDelete = (record: ToolboxRecord) => {
    void modal.confirm({
      title: t("executionFactory.toolboxDeleteConfirmTitle"),
      content: t("executionFactory.toolboxDeleteConfirmDescription", {
        name: record.name,
      }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await deleteToolbox(record.boxId);
        void message.success(t("common.success"));
        await loadToolboxes();
      },
    });
  };

  const handleDelete = (record: OperatorRecord) => {
    void modal.confirm({
      title: t("executionFactory.deleteConfirmTitle"),
      content: t("executionFactory.deleteConfirmDescription", {
        name: record.name,
      }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await deleteOperator(record.operatorId, record.version);
        void message.success(t("common.success"));
        await loadOperators();
      },
    });
  };

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
      dataIndex: "metadataType",
      title: t("executionFactory.metadataType"),
      render: (value?: string) =>
        value ? t(`executionFactory.metadataTypes.${value}`) : "-",
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
          <PermissionGate permissions="execution-factory:operator:view">
            <AppButton onClick={() => openDetail(record.operatorId)} type="link">
              {t("common.detail")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:operator:edit">
            <AppButton
              onClick={() => {
                void navigate(`/execution-factory/units/${record.operatorId}/edit`);
              }}
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          {!record.isInternal && record.status !== "published" ? (
            <PermissionGate permissions="execution-factory:operator:publish">
              <AppButton
                onClick={() => handleStatusChange(record, "published")}
                type="link"
              >
                {t("executionFactory.publish")}
              </AppButton>
            </PermissionGate>
          ) : null}
          {!record.isInternal && record.status === "published" ? (
            <PermissionGate permissions="execution-factory:operator:publish">
              <AppButton
                onClick={() => handleStatusChange(record, "offline")}
                type="link"
              >
                {t("executionFactory.offline")}
              </AppButton>
            </PermissionGate>
          ) : null}
          <PermissionGate permissions="execution-factory:operator:debug">
            <AppButton onClick={() => setDebugRecord(record)} type="link">
              {t("executionFactory.debug")}
            </AppButton>
          </PermissionGate>
          {!record.isInternal ? (
            <PermissionGate permissions="execution-factory:operator:delete">
              <AppButton
                className={styles.actionDanger}
                danger
                onClick={() => handleDelete(record)}
                type="link"
              >
                {t("common.delete")}
              </AppButton>
            </PermissionGate>
          ) : null}
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
          <PermissionGate permissions="execution-factory:toolbox:view">
            <AppButton onClick={() => setDetailBoxId(record.boxId)} type="link">
              {t("common.detail")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:tool:view">
            <AppButton
              onClick={() => {
                void navigate(`/execution-factory/toolboxes/${record.boxId}/tools`);
              }}
              type="link"
            >
              {t("executionFactory.manageTools")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:toolbox:edit">
            <AppButton
              onClick={() => {
                void navigate(`/execution-factory/toolboxes/${record.boxId}/edit`);
              }}
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          {!record.isInternal && record.status !== "published" ? (
            <PermissionGate permissions="execution-factory:toolbox:publish">
              <AppButton
                onClick={() => handleToolboxStatusChange(record, "published")}
                type="link"
              >
                {t("executionFactory.publish")}
              </AppButton>
            </PermissionGate>
          ) : null}
          {!record.isInternal && record.status === "published" ? (
            <PermissionGate permissions="execution-factory:toolbox:publish">
              <AppButton
                onClick={() => handleToolboxStatusChange(record, "offline")}
                type="link"
              >
                {t("executionFactory.offline")}
              </AppButton>
            </PermissionGate>
          ) : null}
          {!record.isInternal ? (
            <PermissionGate permissions="execution-factory:toolbox:delete">
              <AppButton
                className={styles.actionDanger}
                danger
                onClick={() => handleToolboxDelete(record)}
                type="link"
              >
                {t("common.delete")}
              </AppButton>
            </PermissionGate>
          ) : null}
        </div>
      ),
    },
  ];

  const reloadCurrentTab = () => {
    reset();
    setSelectedStatus(undefined);
    setSelectedToolboxStatus(undefined);

    if (activeTab === "operators") {
      void loadOperators();
      return;
    }

    void loadToolboxes();
  };

  return (
    <>
      <section className={styles.contentSurface}>
        <div className={styles.pageIntro}>
          <h2 className={styles.pageIntroTitle}>{t("executionFactory.unitManagementTitle")}</h2>
          <p className={styles.pageIntroDescription}>
            {t("executionFactory.unitManagementDescription")}
          </p>
        </div>
        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
              {activeTab === "operators" ? (
                <PermissionGate permissions="execution-factory:operator:create">
                  <AppButton
                    onClick={() => {
                      void navigate("/execution-factory/units/new");
                    }}
                    type="primary"
                  >
                    {t("common.create")}
                  </AppButton>
                </PermissionGate>
              ) : (
                <PermissionGate permissions="execution-factory:toolbox:create">
                  <AppButton
                    onClick={() => {
                      void navigate("/execution-factory/toolboxes/new");
                    }}
                    type="primary"
                  >
                    {t("common.create")}
                  </AppButton>
                </PermissionGate>
              )}
              <AppButton icon={<ReloadOutlined />} onClick={reloadCurrentTab}>
                {t("common.refresh")}
              </AppButton>
            </div>
            <span className={styles.toolbarMeta}>
              {t("executionFactory.toolbarHint")}
            </span>
          </div>
          <div className={styles.toolbarFilters}>
            <Input.Search
              allowClear
              className={styles.searchInput}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={setKeyword}
              placeholder={
                activeTab === "operators"
                  ? t("executionFactory.searchPlaceholder")
                  : t("executionFactory.toolboxSearchPlaceholder")
              }
              value={pageState.keyword}
            />
            {activeTab === "operators" ? (
              <Select
                allowClear
                className={styles.filterSelect}
                onChange={(value) => setSelectedStatus(value)}
                options={(
                  ["unpublish", "published", "offline", "editing"] as OperatorStatus[]
                ).map((status) => ({
                  label: t(`executionFactory.statuses.${status}`),
                  value: status,
                }))}
                placeholder={t("executionFactory.statusFilterPlaceholder")}
                value={selectedStatus}
              />
            ) : (
              <Select
                allowClear
                className={styles.filterSelect}
                onChange={(value) => setSelectedToolboxStatus(value)}
                options={(
                  ["unpublish", "published", "offline"] as ToolboxStatus[]
                ).map((status) => ({
                  label: t(`executionFactory.toolboxStatuses.${status}`),
                  value: status,
                }))}
                placeholder={t("executionFactory.statusFilterPlaceholder")}
                value={selectedToolboxStatus}
              />
            )}
          </div>
        </div>
        <div className={styles.tabSurface}>
          <Tabs
            activeKey={activeTab}
            items={[
              {
                key: "operators",
                label: t("executionFactory.operatorsTab"),
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
                            description={t("executionFactory.emptyDescription")}
                            title={t("executionFactory.empty")}
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
                label: t("executionFactory.toolboxesTab"),
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
                            description={t("executionFactory.toolboxEmptyDescription")}
                            title={t("executionFactory.toolboxEmpty")}
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
            ]}
            onChange={(key) => {
              setActiveTab(key as "operators" | "toolboxes");
              setPagination(1, pageState.pageSize);
            }}
          />
        </div>
      </section>
      <OperatorDetailDrawer
        onClose={() => setDetailOperatorId(null)}
        open={Boolean(detailOperatorId)}
        operatorId={detailOperatorId}
      />
      <ToolboxDetailDrawer
        boxId={detailBoxId}
        onClose={() => setDetailBoxId(null)}
        open={Boolean(detailBoxId)}
      />
      <OperatorDebugModal
        onClose={() => setDebugRecord(null)}
        open={Boolean(debugRecord)}
        record={debugRecord}
      />
    </>
  );
}

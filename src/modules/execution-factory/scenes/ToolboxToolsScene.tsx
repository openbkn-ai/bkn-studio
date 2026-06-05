import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { ToolboxToolsSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ToolDebugModal } from "@/modules/execution-factory/components/ToolDebugModal";
import { ToolFormDrawer } from "@/modules/execution-factory/components/ToolFormDrawer";
import { getToolbox } from "@/modules/execution-factory/services/toolbox.service";
import {
  deleteTools,
  listTools,
  updateToolStatus,
} from "@/modules/execution-factory/services/tool.service";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import type { ToolRecord, ToolStatus } from "@/modules/execution-factory/types/tool";

import styles from "./execution-factory-list.module.css";

const statusClassMap: Record<ToolStatus, string> = {
  enabled: styles.statusTagPublished,
  disabled: styles.statusTagOffline,
};

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function ToolboxToolsScene({ boxId, onBack }: ToolboxToolsSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState();
  const [toolbox, setToolbox] = useState<ToolboxRecord | null>(null);
  const [items, setItems] = useState<ToolRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ToolStatus>();
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [debugRecord, setDebugRecord] = useState<ToolRecord | null>(null);

  const toolQuery = useMemo(
    () => ({
      ...query,
      status: selectedStatus,
    }),
    [query, selectedStatus],
  );

  const loadToolbox = useCallback(async () => {
    try {
      setToolbox(await getToolbox(boxId));
    } catch {
      setToolbox(null);
    }
  }, [boxId]);

  const loadTools = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listTools(boxId, toolQuery);
      setItems(listResult.items);
      setTotal(listResult.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [boxId, toolQuery]);

  useEffect(() => {
    void loadToolbox();
  }, [loadToolbox]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const handleStatusChange = (record: ToolRecord, status: ToolStatus) => {
    void modal.confirm({
      title: t("executionFactory.toolStatusChangeConfirmTitle"),
      content: t("executionFactory.toolStatusChangeConfirmDescription", {
        name: record.name,
        status: t(`executionFactory.toolStatuses.${status}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await updateToolStatus(boxId, [record.toolId], status);
        void message.success(t("common.success"));
        await loadTools();
      },
    });
  };

  const handleDelete = (record: ToolRecord) => {
    void modal.confirm({
      title: t("executionFactory.toolDeleteConfirmTitle"),
      content: t("executionFactory.toolDeleteConfirmDescription", {
        name: record.name,
      }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await deleteTools(boxId, [record.toolId]);
        void message.success(t("common.success"));
        await loadTools();
      },
    });
  };

  const columns: ColumnsType<ToolRecord> = [
    {
      dataIndex: "name",
      title: t("executionFactory.toolName"),
      render: (_, record) => (
        <div className={styles.nameCell}>
          <div className={styles.nameTitle}>{record.name}</div>
          <span className={styles.operatorIdText}>{record.toolId}</span>
        </div>
      ),
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (value: ToolStatus) => (
        <Tag className={statusClassMap[value] ?? styles.statusTagDefault}>
          {t(`executionFactory.toolStatuses.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "metadataType",
      title: t("executionFactory.metadataType"),
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
          <PermissionGate permissions="execution-factory:tool:edit">
            <AppButton
              onClick={() => {
                setEditingToolId(record.toolId);
                setFormMode("edit");
              }}
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="execution-factory:tool:debug">
            <AppButton onClick={() => setDebugRecord(record)} type="link">
              {t("executionFactory.debug")}
            </AppButton>
          </PermissionGate>
          {record.status === "disabled" ? (
            <PermissionGate permissions="execution-factory:tool:edit">
              <AppButton
                onClick={() => handleStatusChange(record, "enabled")}
                type="link"
              >
                {t("executionFactory.enable")}
              </AppButton>
            </PermissionGate>
          ) : (
            <PermissionGate permissions="execution-factory:tool:edit">
              <AppButton
                onClick={() => handleStatusChange(record, "disabled")}
                type="link"
              >
                {t("executionFactory.disable")}
              </AppButton>
            </PermissionGate>
          )}
          <PermissionGate permissions="execution-factory:tool:delete">
            <AppButton
              className={styles.actionDanger}
              danger
              onClick={() => handleDelete(record)}
              type="link"
            >
              {t("common.delete")}
            </AppButton>
          </PermissionGate>
        </div>
      ),
    },
  ];

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/execution-factory/units");
  };

  return (
    <>
      <CrudFormPage
        description={toolbox?.description ?? t("executionFactory.toolboxToolsDescription")}
        title={t("executionFactory.toolboxToolsTitle", {
          name: toolbox?.name ?? boxId,
        })}
      >
        <section className={styles.contentSurface}>
          <div className={styles.operationBar}>
            <div className={styles.operationPrimary}>
              <div className={styles.toolbarActions}>
                <PermissionGate permissions="execution-factory:tool:create">
                  <AppButton onClick={() => setFormMode("create")} type="primary">
                    {t("common.create")}
                  </AppButton>
                </PermissionGate>
                <AppButton icon={<ReloadOutlined />} onClick={() => void loadTools()}>
                  {t("common.refresh")}
                </AppButton>
                <AppButton onClick={handleBack}>{t("common.back")}</AppButton>
              </div>
              <span className={styles.toolbarMeta}>
                {t("executionFactory.toolboxToolsHint")}
              </span>
            </div>
            <div className={styles.toolbarFilters}>
              <Input.Search
                allowClear
                className={styles.searchInput}
                onChange={(event) => setKeyword(event.target.value)}
                onSearch={setKeyword}
                placeholder={t("executionFactory.toolSearchPlaceholder")}
                value={pageState.keyword}
              />
              <Select
                allowClear
                className={styles.filterSelect}
                onChange={(value) => setSelectedStatus(value)}
                options={(["enabled", "disabled"] as ToolStatus[]).map((status) => ({
                  label: t(`executionFactory.toolStatuses.${status}`),
                  value: status,
                }))}
                placeholder={t("executionFactory.statusFilterPlaceholder")}
                value={selectedStatus}
              />
            </div>
          </div>
          <div className={styles.tableSurface}>
            {loadError ? (
              <Alert
                action={
                  <AppButton onClick={() => void loadTools()} type="link">
                    {t("common.retry")}
                  </AppButton>
                }
                message={loadError}
                showIcon
                type="error"
              />
            ) : null}
            <AppTable
              columns={columns}
              dataSource={items}
              loading={loading}
              locale={{
                emptyText: (
                  <EmptyStatePanel
                    description={t("executionFactory.toolsEmpty")}
                    title={t("executionFactory.toolListEmpty")}
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
                total,
              }}
              rowKey="toolId"
            />
          </div>
        </section>
      </CrudFormPage>
      <ToolFormDrawer
        boxId={boxId}
        mode={formMode ?? "create"}
        onClose={() => {
          setFormMode(null);
          setEditingToolId(null);
        }}
        onSuccess={() => {
          void loadTools();
        }}
        open={formMode !== null}
        toolId={editingToolId ?? undefined}
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

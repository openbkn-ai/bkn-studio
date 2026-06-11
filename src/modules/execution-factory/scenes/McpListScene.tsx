import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { McpDetailDrawer } from "@/modules/execution-factory/components/McpDetailDrawer";
import {
  deleteMcp,
  listMcps,
  updateMcpStatus,
} from "@/modules/execution-factory/services/mcp.service";
import type { McpRecord, McpStatus } from "@/modules/execution-factory/types/mcp";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";

import styles from "./execution-factory-list.module.css";

const statusClassMap: Record<McpStatus, string> = {
  published: styles.statusTagPublished,
  editing: styles.statusTagEditing,
  offline: styles.statusTagOffline,
  unpublish: styles.statusTagDefault,
};

function formatTimestamp(value?: number) {
  return formatExecutionUnitTime(value);
}

/** @deprecated Use `ExecutionUnitListScene` with `activeTab="mcp"` instead. */
export function McpListScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState();
  const [selectedStatus, setSelectedStatus] = useState<McpStatus>();
  const [items, setItems] = useState<McpRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailMcpId, setDetailMcpId] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      ...query,
      status: selectedStatus,
    }),
    [query, selectedStatus],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listMcps(listQuery);
      setItems(listResult.items);
      setTotal(listResult.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStatusChange = (record: McpRecord, status: McpStatus) => {
    void modal.confirm({
      title: t("executionFactory.mcpStatusChangeConfirmTitle"),
      content: t("executionFactory.mcpStatusChangeConfirmDescription", {
        name: record.name,
        status: t(`executionFactory.mcpStatuses.${status}`),
      }),
      okText: t("common.save"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await updateMcpStatus(record.mcpId, status);
        void message.success(t("common.success"));
        await loadData();
      },
    });
  };

  const handleDelete = (record: McpRecord) => {
    void modal.confirm({
      title: t("executionFactory.mcpDeleteConfirmTitle"),
      content: t("executionFactory.mcpDeleteConfirmDescription", {
        name: record.name,
      }),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        await deleteMcp(record.mcpId);
        void message.success(t("common.success"));
        await loadData();
      },
    });
  };

  const columns: ColumnsType<McpRecord> = [
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
      dataIndex: "status",
      title: t("common.status"),
      render: (value: McpStatus) => (
        <Tag className={statusClassMap[value] ?? styles.statusTagDefault}>
          {t(`executionFactory.mcpStatuses.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "creationType",
      title: t("executionFactory.mcpCreationType"),
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
          <PermissionGate permissions="execution-factory:mcp:view">
            <AppButton onClick={() => setDetailMcpId(record.mcpId)} type="link">
              {t("common.detail")}
            </AppButton>
          </PermissionGate>
          {!record.isInternal && record.status !== "published" ? (
            <PermissionGate permissions="execution-factory:mcp:publish">
              <AppButton
                onClick={() => handleStatusChange(record, "published")}
                type="link"
              >
                {t("executionFactory.publish")}
              </AppButton>
            </PermissionGate>
          ) : null}
          {!record.isInternal && record.status === "published" ? (
            <PermissionGate permissions="execution-factory:mcp:publish">
              <AppButton
                onClick={() => handleStatusChange(record, "offline")}
                type="link"
              >
                {t("executionFactory.offline")}
              </AppButton>
            </PermissionGate>
          ) : null}
          {!record.isInternal ? (
            <PermissionGate permissions="execution-factory:mcp:delete">
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

  return (
    <>
    <section className={styles.contentSurface}>
      <div className={styles.pageIntro}>
        <h2 className={styles.pageIntroTitle}>{t("executionFactory.mcpListTitle")}</h2>
        <p className={styles.pageIntroDescription}>
          {t("executionFactory.mcpListDescription")}
        </p>
      </div>
      <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div className={styles.toolbarActions}>
            <PermissionGate permissions="execution-factory:mcp:create">
              <AppButton
                onClick={() => {
                  void navigate("/execution-factory/mcp/new");
                }}
                type="primary"
              >
                {t("common.create")}
              </AppButton>
            </PermissionGate>
            <AppButton icon={<ReloadOutlined />} onClick={reset}>
              {t("common.refresh")}
            </AppButton>
          </div>
          <span className={styles.toolbarMeta}>{t("executionFactory.mcpToolbarHint")}</span>
        </div>
        <div className={styles.toolbarFilters}>
          <Input.Search
            allowClear
            className={styles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={setKeyword}
            placeholder={t("executionFactory.mcpSearchPlaceholder")}
            value={pageState.keyword}
          />
          <Select
            allowClear
            className={styles.filterSelect}
            onChange={(value) => setSelectedStatus(value)}
            options={(
              ["unpublish", "published", "offline", "editing"] as McpStatus[]
            ).map((status) => ({
              label: t(`executionFactory.mcpStatuses.${status}`),
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
              <AppButton onClick={() => void loadData()} type="link">
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
                description={t("executionFactory.mcpEmptyDescription")}
                title={t("executionFactory.mcpEmpty")}
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
          rowKey="mcpId"
        />
      </div>
    </section>
    <McpDetailDrawer
      mcpId={detailMcpId}
      onClose={() => setDetailMcpId(null)}
      onViewDetail={(id) => {
        setDetailMcpId(null);
        void navigate(`/execution-factory/mcp/${id}`);
      }}
      open={Boolean(detailMcpId)}
    />
    </>
  );
}

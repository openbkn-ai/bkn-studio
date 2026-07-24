/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, ExclamationCircleOutlined, FilterOutlined, ReloadOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Alert, Descriptions, Drawer, Popover, Select, Space, Tag } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import taskDetailStyles from "@/modules/data-catalog/components/BuildTaskDetailDrawer.module.css";
import sharedStyles from "@/modules/data-catalog/components/shared.module.css";
import {
  deleteDataConnectDiscoverTask,
  listDataConnectDiscoverTasks,
} from "@/modules/data-connect/services/discover.service";
import type {
  DataConnectDiscoverStrategy,
  DataConnectDiscoverTask,
  DataConnectDiscoverTaskSort,
  DataConnectDiscoverTaskStatus,
  DataConnectDiscoverTaskTriggerType,
} from "@/modules/data-connect/types/discover";
import { listCatalogResourcePage } from "@/modules/data-catalog/services/resource.service";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { listCatalogs } from "@/shared/catalog";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./TaskManagementTaskPanels.module.css";

type ListResponse<T> = { entries: T[]; total_count: number };
type SemanticTaskStatus = "pending" | "running" | "succeeded" | "failed";
type SemanticTask = {
  id: string;
  scope: "catalog" | "resource";
  catalogId: string;
  catalogName?: string;
  resourceId?: string;
  resourceName?: string;
  status: SemanticTaskStatus;
  applyMode: string;
  agentId: string;
  confidence: number;
  failureDetail?: string;
  applied: boolean;
  createTime: number;
};
type SemanticTaskFilters = {
  scope?: SemanticTask["scope"];
  catalogId?: string;
  resourceId?: string;
  status?: SemanticTaskStatus;
  applyMode?: string;
  applied?: boolean;
  direction?: "asc" | "desc";
  sort?: "create_time" | "default";
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

let mockSemanticTasks: SemanticTask[] = [
  {
    id: "semantic-task-001",
    scope: "resource",
    catalogId: "cat-001",
    resourceId: "res-001",
    status: "succeeded",
    applyMode: "fill_empty",
    agentId: "resource-semantic-understanding",
    confidence: 0.94,
    applied: true,
    createTime: Date.now() - 1000 * 60 * 45,
  },
  {
    id: "semantic-task-002",
    scope: "catalog",
    catalogId: "cat-002",
    status: "running",
    applyMode: "dry_run",
    agentId: "catalog-semantic-understanding",
    confidence: 0,
    applied: false,
    createTime: Date.now() - 1000 * 60 * 8,
  },
];

const wait = async <T,>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

function formatTime(value?: number) {
  if (!value) {
    return "-";
  }
  const timestamp = value < 100_000_000_000 ? value * 1000 : value;
  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(timestamp)
    .replace(/\//g, "-");
}

function TaskPanel({ children }: { children: React.ReactNode }) {
  return <section className={styles.contentSurface}>{children}</section>;
}

function TaskDetailDrawer({
  children,
  failureReason,
  onClose,
  status,
  statusClass,
  taskId,
}: {
  children: React.ReactNode;
  failureReason?: string;
  onClose: () => void;
  status: string;
  statusClass: string;
  taskId: string;
}) {
  const { t } = useTranslation();

  return (
    <Drawer
      className={taskDetailStyles.drawer}
      destroyOnClose
      onClose={onClose}
      open
      styles={{ body: { padding: 16 }, header: { padding: "12px 16px" } }}
      title={`${t("dataCatalog.task.detail")} · ${taskId}`}
      width={560}
    >
      <div className={taskDetailStyles.drawerContent}>
        <section className={taskDetailStyles.sectionCard}>
          <h3 className={taskDetailStyles.sectionTitle}>{t("common.status")}</h3>
          <div className={taskDetailStyles.statusRow}>
            <span className={[sharedStyles.tag, statusClass].join(" ")}>{status}</span>
          </div>
          {failureReason ? (
            <div className={sharedStyles.calloutWarn}>
              <ExclamationCircleOutlined />
              <span className={taskDetailStyles.failureContent}>
                <b>{t("dataCatalog.taskManagement.details.failureReason")}</b>
                <span>{failureReason}</span>
              </span>
            </div>
          ) : null}
        </section>
        <section className={taskDetailStyles.sectionCard}>
          <h3 className={taskDetailStyles.sectionTitle}>
            {t("dataCatalog.taskManagement.details.taskInformation")}
          </h3>
          <Descriptions
            bordered
            className={taskDetailStyles.descriptionBlock}
            column={1}
            size="small"
          >
            {children}
          </Descriptions>
        </section>
      </div>
    </Drawer>
  );
}

function DiscoverTaskProgress({ task }: { task: DataConnectDiscoverTask }) {
  const percent = Math.max(0, Math.min(100, task.progress));
  const fillClass =
    task.status === "completed"
      ? sharedStyles.progressFillDone
      : task.status === "failed"
        ? sharedStyles.progressFillFailed
        : sharedStyles.progressFillVector;

  return (
    <div className={sharedStyles.progressWrapCompact}>
      <div className={sharedStyles.progressTrack}>
        <span
          className={[sharedStyles.progressFill, fillClass].join(" ")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className={sharedStyles.progressMetaCompact}>
        <span>{`${percent}%`}</span>
      </div>
    </div>
  );
}

export function DiscoverTaskListPanel() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<DataConnectDiscoverTask[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([]);
  const [catalogKeyword, setCatalogKeyword] = useState("");
  const [catalogId, setCatalogId] = useState<string>();
  const [status, setStatus] = useState<DataConnectDiscoverTaskStatus>();
  const [strategy, setStrategy] = useState<DataConnectDiscoverStrategy>();
  const [triggerType, setTriggerType] = useState<DataConnectDiscoverTaskTriggerType>();
  const [sort, setSort] = useState<DataConnectDiscoverTaskSort>("default");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [detailTask, setDetailTask] = useState<DataConnectDiscoverTask | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const taskResult = await listDataConnectDiscoverTasks({
        catalogId,
        page,
        pageSize,
        status,
        strategy,
        triggerType,
        sort,
        direction,
      });
      setTasks(taskResult.items);
      setTotal(taskResult.total);
    } catch (loadError) {
      setError(extractRequestErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [catalogId, direction, page, pageSize, sort, status, strategy, triggerType]);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listCatalogs({ keyword: catalogKeyword, page: 1, pageSize: 50, type: "physical" }).then((result) => setCatalogs(result.items));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [catalogKeyword]);
  const active = tasks.some((item) => item.status === "pending" || item.status === "running");
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => !document.hidden && void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  const handleBatchDelete = () => {
    const targets = tasks.filter((task) => selectedKeys.includes(task.id));
    if (targets.length === 0) return;
    void modal.confirm({
      title: t("dataCatalog.task.batchDeleteConfirmTitle", { count: targets.length }),
      content: t("dataCatalog.task.batchDeleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        const results = await Promise.allSettled(targets.map((task) => deleteDataConnectDiscoverTask(task.id)));
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) message.error(t("dataCatalog.task.batchDeletePartial", { failed, total: targets.length }));
        else message.success(t("common.success"));
        setSelectedKeys([]);
        await load();
      },
    });
  };
  const sortOrderOf = (key: DataConnectDiscoverTaskSort) => sort === key ? (direction === "asc" ? "ascend" : "descend") : null;
  const handleTableChange: TableProps<DataConnectDiscoverTask>["onChange"] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== "sort") return;
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    setSort(single?.columnKey as DataConnectDiscoverTaskSort || "default");
    setDirection(single?.order === "ascend" ? "asc" : "desc");
    setPage(1);
  };

  const columns: ColumnsType<DataConnectDiscoverTask> = [
    { dataIndex: "id", title: t("dataCatalog.taskManagement.columns.task"), width: 160, ellipsis: true },
    {
      dataIndex: "catalogId",
      title: t("dataCatalog.resource.catalog"),
      width: 180,
      render: (value: string, record) => {
        const catalogName = record.catalogName;
        return catalogName ? (
          <button
            className={styles.textLink}
            onClick={() => void navigate(`/data-directory/catalog/${value}`)}
            type="button"
          >
            {catalogName}
          </button>
        ) : (
          value
        );
      },
    },
    { dataIndex: "strategy", title: t("dataCatalog.taskManagement.columns.strategy"), width: 130, render: (value) => t(`dataConnect.discoverStrategies.${value}`) },
    { dataIndex: "triggerType", title: t("dataCatalog.taskManagement.columns.trigger"), width: 120, render: (value) => t(`dataConnect.discoverTriggerTypes.${value}`) },
    { dataIndex: "status", title: t("common.status"), width: 120, render: (value) => t(`dataConnect.discoverTaskStatuses.${value}`) },
    {
      dataIndex: "progress",
      title: t("dataCatalog.task.progress"),
      width: 196,
      onCell: () => ({ className: styles.progressCell }),
      render: (_, record) => <DiscoverTaskProgress task={record} />,
    },
    { dataIndex: "createTime", key: "create_time", title: t("dataCatalog.task.createTime"), width: 180, sorter: true, sortOrder: sortOrderOf("create_time") },
    {
      key: "actions", title: t("common.actions"), width: 160, fixed: "right",
      render: (_, record) => <Space className={styles.actionGroup} size={4}><AppButton type="link" onClick={() => setDetailTask(record)}>{t("common.detail")}</AppButton><PermissionGate permissions="catalog:task_manage"><AppButton danger type="link" onClick={() => void modal.confirm({ title: t("dataConnect.discoverTaskDeleteConfirmTitle"), content: t("dataConnect.discoverTaskDeleteConfirmDescription", { id: record.id }), okButtonProps: { danger: true }, onOk: async () => { await deleteDataConnectDiscoverTask(record.id); message.success(t("common.success")); await load(); } })}>{t("common.delete")}</AppButton></PermissionGate></Space>,
    },
  ];

  return <TaskPanel>
    <div className={styles.operationBar}><Space className={styles.toolbarActions}><AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton><PermissionGate permissions="catalog:task_manage"><AppButton danger disabled={selectedKeys.length === 0} icon={<DeleteOutlined />} onClick={handleBatchDelete}>{selectedKeys.length > 0 ? `${t("dataCatalog.task.batchDelete")} (${selectedKeys.length})` : t("dataCatalog.task.batchDelete")}</AppButton></PermissionGate></Space><Space className={styles.toolbarFilters}>
      <Select allowClear className={styles.select} filterOption={false} onSearch={setCatalogKeyword} options={catalogs.map((item) => ({ label: item.name, value: item.id }))} placeholder={t("dataCatalog.resource.catalog")} showSearch value={catalogId} onChange={(value) => { setCatalogId(value); setPage(1); }} />
      <Select allowClear className={styles.select} options={["full_sync", "create_only", "cleanup_only"].map((value) => ({ label: t(`dataConnect.discoverStrategies.${value}`), value }))} placeholder={t("dataCatalog.taskManagement.columns.strategy")} value={strategy} onChange={(value) => { setStrategy(value); setPage(1); }} />
      <Select allowClear className={styles.select} options={["manual", "scheduled"].map((value) => ({ label: t(`dataConnect.discoverTriggerTypes.${value}`), value }))} placeholder={t("dataCatalog.taskManagement.columns.trigger")} value={triggerType} onChange={(value) => { setTriggerType(value); setPage(1); }} />
      <Select allowClear className={styles.select} options={["pending", "running", "completed", "failed"].map((value) => ({ label: t(`dataConnect.discoverTaskStatuses.${value}`), value }))} placeholder={t("common.status")} value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
    </Space></div>
    <TaskTable error={error} loading={loading} data={tasks} columns={columns} emptyTitle={t("dataCatalog.taskManagement.discover.empty")} onRetry={load} onTableChange={handleTableChange} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    <Pagination page={page} pageSize={pageSize} total={total} onChange={(nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }} />
    {detailTask ? <TaskDetailDrawer failureReason={detailTask.status === "failed" ? detailTask.message : undefined} onClose={() => setDetailTask(null)} status={t(`dataConnect.discoverTaskStatuses.${detailTask.status}`)} statusClass={detailTask.status === "failed" ? sharedStyles.taskFailed : detailTask.status === "completed" ? sharedStyles.taskSucceeded : sharedStyles.taskRunning} taskId={detailTask.id}>
      <Descriptions.Item label={t("dataCatalog.resource.catalog")}>{detailTask.catalogName ?? detailTask.catalogId}</Descriptions.Item>
      <Descriptions.Item label={t("dataCatalog.taskManagement.columns.strategy")}>{t(`dataConnect.discoverStrategies.${detailTask.strategy}`)}</Descriptions.Item>
      <Descriptions.Item label={t("dataCatalog.taskManagement.columns.trigger")}>{t(`dataConnect.discoverTriggerTypes.${detailTask.triggerType}`)}</Descriptions.Item>
      <Descriptions.Item label={t("common.status")}>{t(`dataConnect.discoverTaskStatuses.${detailTask.status}`)}</Descriptions.Item>
      <Descriptions.Item label={t("dataCatalog.task.progress")}>{`${detailTask.progress}%`}</Descriptions.Item>
      <Descriptions.Item label={t("dataCatalog.taskManagement.details.scheduleId")}>{detailTask.scheduleId || "-"}</Descriptions.Item>
      <Descriptions.Item label={t("dataCatalog.taskManagement.details.startTime")}>{detailTask.startTime || "-"}</Descriptions.Item>
      <Descriptions.Item label={t("dataCatalog.task.finishedAt")}>{detailTask.finishTime || "-"}</Descriptions.Item>
      <Descriptions.Item label={t("dataCatalog.task.createTime")}>{detailTask.createTime || "-"}</Descriptions.Item>
    </TaskDetailDrawer> : null}
  </TaskPanel>;
}

async function listSemanticTasks(page: number, pageSize: number, filters: SemanticTaskFilters) {
  if (useMock) {
    const filtered = mockSemanticTasks.filter(
      (item) =>
        (filters.scope === undefined || item.scope === filters.scope) &&
        (filters.catalogId === undefined || item.catalogId === filters.catalogId) &&
        (filters.resourceId === undefined || item.resourceId === filters.resourceId) &&
        (filters.status === undefined || item.status === filters.status) &&
        (filters.applyMode === undefined || item.applyMode === filters.applyMode) &&
        (filters.applied === undefined || item.applied === filters.applied),
    );
    const direction = filters.direction === "asc" ? 1 : -1;
    const sorted = filtered.sort((left, right) => {
      if (filters.sort === "default") {
        const rank = { running: 1, pending: 2, failed: 3, succeeded: 4 };
        return rank[left.status] - rank[right.status] || right.createTime - left.createTime;
      }
      const leftValue = left.createTime;
      const rightValue = right.createTime;
      return leftValue > rightValue ? direction : leftValue < rightValue ? -direction : 0;
    });
    const startIndex = (page - 1) * pageSize;
    return wait({
      items: sorted.slice(startIndex, startIndex + pageSize),
      total: sorted.length,
    });
  }

  const response = await http.get<ListResponse<{ id: string; scope: "catalog" | "resource"; catalog_id: string; catalog_name?: string; resource_id?: string; resource_name?: string; status: SemanticTaskStatus; apply_mode?: string; agent_id: string; confidence?: number; applied?: boolean; create_time?: number; failure_detail?: string }>>("/vega-backend/v1/semantic-understanding-tasks", {
    params: {
      direction: filters.direction ?? "desc",
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: filters.sort ?? "default",
      scope: filters.scope,
      catalog_id: filters.catalogId,
      resource_id: filters.resourceId,
      status: filters.status,
      apply_mode: filters.applyMode,
      applied: filters.applied,
    },
  });
  return { items: response.data.entries.map((item) => ({ id: item.id, scope: item.scope, catalogId: item.catalog_id, catalogName: item.catalog_name, resourceId: item.resource_id, resourceName: item.resource_name, status: item.status, applyMode: item.apply_mode ?? "fill_empty", agentId: item.agent_id, confidence: item.confidence ?? 0, applied: item.applied ?? false, createTime: item.create_time ?? 0, failureDetail: item.failure_detail })), total: response.data.total_count };
}

async function deleteSemanticTask(id: string) {
  if (useMock) {
    mockSemanticTasks = mockSemanticTasks.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }

  await http.delete(`/vega-backend/v1/semantic-understanding-tasks/${id}`);
}

export function SemanticUnderstandingTaskListPanel() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<SemanticTask[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([]);
  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [catalogKeyword, setCatalogKeyword] = useState("");
  const [resourceKeyword, setResourceKeyword] = useState("");
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [total, setTotal] = useState(0);
  const [scope, setScope] = useState<SemanticTask["scope"]>();
  const [catalogId, setCatalogId] = useState<string>();
  const [resourceId, setResourceId] = useState<string>();
  const [status, setStatus] = useState<SemanticTaskStatus>();
  const [applyMode, setApplyMode] = useState<string>();
  const [applied, setApplied] = useState<boolean>();
  const [sort, setSort] = useState<NonNullable<SemanticTaskFilters["sort"]>>("default");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [detailTask, setDetailTask] = useState<SemanticTask | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const taskResult = await listSemanticTasks(page, pageSize, { scope, catalogId, resourceId, status, applyMode, applied, sort, direction }); setTasks(taskResult.items); setTotal(taskResult.total); } catch (loadError) { setError(extractRequestErrorMessage(loadError)); } finally { setLoading(false); } }, [applied, applyMode, catalogId, direction, page, pageSize, resourceId, scope, sort, status]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listCatalogs({ keyword: catalogKeyword, page: 1, pageSize: 50, type: "all" }).then((result) => setCatalogs(result.items));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [catalogKeyword]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listCatalogResourcePage({ catalogId, keyword: resourceKeyword, limit: 50, offset: 0 }).then((result) => setResources(result.items));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [catalogId, resourceKeyword]);
  const resourceOptions = resources.map((item) => ({ label: item.name, value: item.id }));
  const active = tasks.some((item) => item.status === "pending" || item.status === "running");
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => !document.hidden && void load(), 10_000); return () => window.clearInterval(timer); }, [active, load]);
  const handleBatchDelete = () => {
    const targets = tasks.filter((task) => selectedKeys.includes(task.id));
    if (targets.length === 0) return;
    void modal.confirm({
      title: t("dataCatalog.task.batchDeleteConfirmTitle", { count: targets.length }),
      content: t("dataCatalog.task.batchDeleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        const results = await Promise.allSettled(targets.map((task) => deleteSemanticTask(task.id)));
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) message.error(t("dataCatalog.task.batchDeletePartial", { failed, total: targets.length }));
        else message.success(t("common.success"));
        setSelectedKeys([]);
        await load();
      },
    });
  };
  const sortOrderOf = (key: NonNullable<SemanticTaskFilters["sort"]>) => sort === key ? (direction === "asc" ? "ascend" : "descend") : null;
  const handleTableChange: TableProps<SemanticTask>["onChange"] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== "sort") return;
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    setSort(single?.columnKey as NonNullable<SemanticTaskFilters["sort"]> || "default");
    setDirection(single?.order === "ascend" ? "asc" : "desc");
    setPage(1);
  };
  const columns: ColumnsType<SemanticTask> = [
    { dataIndex: "id", title: t("dataCatalog.taskManagement.columns.task"), width: 160, ellipsis: true },
    { dataIndex: "scope", title: t("dataCatalog.taskManagement.columns.scope"), width: 100, render: (value) => t(`dataCatalog.taskManagement.scope.${value}`) },
    {
      dataIndex: "catalogId",
      title: t("dataCatalog.resource.catalog"),
      width: 180,
      ellipsis: true,
      render: (value: string, record) => (
        <button
          className={styles.textLink}
          onClick={() => void navigate(`/data-directory/catalog/${value}`)}
          type="button"
        >
          {record.catalogName ?? value}
        </button>
      ),
    },
    {
      dataIndex: "resourceId",
      title: t("dataCatalog.build.resource"),
      width: 200,
      ellipsis: true,
      render: (value: string | undefined, record) =>
        value ? (
          <button
            className={styles.textLink}
            onClick={() => void navigate(`/data-directory/resource/${value}`)}
            type="button"
          >
            {record.resourceName ?? value}
          </button>
        ) : (
          "-"
        ),
    },
    { dataIndex: "status", title: t("common.status"), width: 120, render: (value) => <Tag color={value === "succeeded" ? "success" : value === "failed" ? "error" : "processing"}>{t(`dataCatalog.taskManagement.semanticStatus.${value}`)}</Tag> },
    {
      dataIndex: "applyMode",
      title: t("dataCatalog.taskManagement.columns.applyMode"),
      width: 130,
      render: (value: string) =>
        value === "dry_run"
          ? t("dataCatalog.taskManagement.applyMode.dryRun")
          : value === "force"
            ? t("dataCatalog.taskManagement.applyMode.force")
            : value === "fill_empty"
              ? t("dataCatalog.taskManagement.applyMode.fillEmpty")
              : value,
    },
    { dataIndex: "confidence", title: t("dataCatalog.taskManagement.columns.confidence"), width: 100, render: (value) => `${Math.round(value * 100)}%` },
    {
      dataIndex: "applied",
      title: t("dataCatalog.taskManagement.columns.applied"),
      width: 100,
      render: (value: boolean) => (
        <Tag color={value ? "success" : "default"}>
          {t(
            value
              ? "dataCatalog.taskManagement.applied.applied"
              : "dataCatalog.taskManagement.applied.notApplied",
          )}
        </Tag>
      ),
    },
    { dataIndex: "createTime", key: "create_time", title: t("dataCatalog.task.createTime"), width: 180, sorter: true, sortOrder: sortOrderOf("create_time"), render: formatTime },
    { key: "actions", title: t("common.actions"), width: 160, fixed: "right", render: (_, record) => <Space className={styles.actionGroup} size={4}><AppButton type="link" onClick={() => setDetailTask(record)}>{t("common.detail")}</AppButton><PermissionGate permissions="catalog:task_manage"><AppButton danger disabled={record.status === "pending" || record.status === "running"} type="link" onClick={() => void modal.confirm({ title: t("dataCatalog.taskManagement.semantic.deleteTitle"), content: t("dataCatalog.taskManagement.semantic.deleteDescription", { id: record.id }), okButtonProps: { danger: true }, onOk: async () => { await deleteSemanticTask(record.id); message.success(t("common.success")); await load(); } })}>{t("common.delete")}</AppButton></PermissionGate></Space> },
  ];
  const advancedFilterCount = Number(scope !== undefined) + Number(applyMode !== undefined) + Number(applied !== undefined);
  const moreFiltersLabel = advancedFilterCount > 0
    ? t("dataCatalog.taskManagement.moreFiltersWithCount", { count: advancedFilterCount })
    : t("dataCatalog.taskManagement.moreFilters");
  const advancedFilters = <Space direction="vertical" size={12}><Select allowClear className={styles.select} options={["catalog", "resource"].map((value) => ({ label: t(`dataCatalog.taskManagement.scope.${value}`), value }))} placeholder={t("dataCatalog.taskManagement.columns.scope")} value={scope} onChange={(value) => { setScope(value); if (value === "catalog") setResourceId(undefined); setPage(1); }} /><Select allowClear className={styles.select} options={["dry_run", "fill_empty", "force"].map((value) => ({ label: t(`dataCatalog.taskManagement.applyMode.${value === "dry_run" ? "dryRun" : value === "fill_empty" ? "fillEmpty" : "force"}`), value }))} placeholder={t("dataCatalog.taskManagement.columns.applyMode")} value={applyMode} onChange={(value) => { setApplyMode(value); setPage(1); }} /><Select allowClear className={styles.select} options={[true, false].map((value) => ({ label: t(value ? "dataCatalog.taskManagement.applied.applied" : "dataCatalog.taskManagement.applied.notApplied"), value }))} placeholder={t("dataCatalog.taskManagement.columns.applied")} value={applied} onChange={(value) => { setApplied(value); setPage(1); }} /><AppButton disabled={advancedFilterCount === 0} type="link" onClick={() => { setScope(undefined); setApplyMode(undefined); setApplied(undefined); setPage(1); }}>{t("dataCatalog.taskManagement.clearAdvancedFilters")}</AppButton></Space>;
  return <TaskPanel><div className={styles.operationBar}><Space className={styles.toolbarActions}><AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton><PermissionGate permissions="catalog:task_manage"><AppButton danger disabled={selectedKeys.length === 0} icon={<DeleteOutlined />} onClick={handleBatchDelete}>{selectedKeys.length > 0 ? `${t("dataCatalog.task.batchDelete")} (${selectedKeys.length})` : t("dataCatalog.task.batchDelete")}</AppButton></PermissionGate></Space><Space className={styles.toolbarFilters}>
    <Select allowClear className={styles.select} filterOption={false} onSearch={setCatalogKeyword} options={catalogs.map((item) => ({ label: item.name, value: item.id }))} placeholder={t("dataCatalog.resource.catalog")} showSearch value={catalogId} onChange={(value) => { setCatalogId(value); setResourceId(undefined); setPage(1); }} />
    <Select allowClear className={styles.select} disabled={scope === "catalog"} filterOption={false} onSearch={setResourceKeyword} options={resourceOptions} placeholder={t("dataCatalog.build.resource")} showSearch value={resourceId} onChange={(value) => { setResourceId(value); setPage(1); }} />
    <Select allowClear className={styles.select} options={["pending", "running", "succeeded", "failed"].map((value) => ({ label: t(`dataCatalog.taskManagement.semanticStatus.${value}`), value }))} placeholder={t("common.status")} value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
    <Popover content={advancedFilters} trigger="click"><AppButton icon={<FilterOutlined />}>{moreFiltersLabel}</AppButton></Popover>
  </Space></div><TaskTable error={error} loading={loading} data={tasks} columns={columns} emptyTitle={t("dataCatalog.taskManagement.semantic.empty")} onRetry={load} onTableChange={handleTableChange} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} /><Pagination page={page} pageSize={pageSize} total={total} onChange={(nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }} />{detailTask ? <TaskDetailDrawer failureReason={detailTask.status === "failed" ? detailTask.failureDetail : undefined} onClose={() => setDetailTask(null)} status={t(`dataCatalog.taskManagement.semanticStatus.${detailTask.status}`)} statusClass={detailTask.status === "failed" ? sharedStyles.taskFailed : detailTask.status === "succeeded" ? sharedStyles.taskSucceeded : sharedStyles.taskRunning} taskId={detailTask.id}>
    <Descriptions.Item label={t("dataCatalog.taskManagement.columns.scope")}>{t(`dataCatalog.taskManagement.scope.${detailTask.scope}`)}</Descriptions.Item>
    <Descriptions.Item label={t("dataCatalog.resource.catalog")}>{detailTask.catalogName ?? detailTask.catalogId}</Descriptions.Item>
    <Descriptions.Item label={t("dataCatalog.build.resource")}>{detailTask.resourceId ? detailTask.resourceName ?? detailTask.resourceId : "-"}</Descriptions.Item>
    <Descriptions.Item label={t("common.status")}>{t(`dataCatalog.taskManagement.semanticStatus.${detailTask.status}`)}</Descriptions.Item>
    <Descriptions.Item label={t("dataCatalog.taskManagement.columns.applyMode")}>{detailTask.applyMode === "dry_run" ? t("dataCatalog.taskManagement.applyMode.dryRun") : detailTask.applyMode === "force" ? t("dataCatalog.taskManagement.applyMode.force") : t("dataCatalog.taskManagement.applyMode.fillEmpty")}</Descriptions.Item>
    <Descriptions.Item label={t("dataCatalog.taskManagement.columns.confidence")}>{`${Math.round(detailTask.confidence * 100)}%`}</Descriptions.Item>
    <Descriptions.Item label={t("dataCatalog.taskManagement.columns.applied")}>{t(detailTask.applied ? "dataCatalog.taskManagement.applied.applied" : "dataCatalog.taskManagement.applied.notApplied")}</Descriptions.Item>
    <Descriptions.Item label={t("dataCatalog.taskManagement.details.agentId")}>{detailTask.agentId || "-"}</Descriptions.Item>
    <Descriptions.Item label={t("dataCatalog.task.createTime")}>{formatTime(detailTask.createTime)}</Descriptions.Item>
  </TaskDetailDrawer> : null}</TaskPanel>;
}

function TaskTable<T extends { id: string }>({ error, loading, data, columns, emptyTitle, onRetry, onTableChange, selectedKeys, onSelectionChange }: { error: string | null; loading: boolean; data: T[]; columns: ColumnsType<T>; emptyTitle: string; onRetry: () => void | Promise<void>; onTableChange?: TableProps<T>["onChange"]; selectedKeys?: string[]; onSelectionChange?: (keys: string[]) => void }) {
  const { t } = useTranslation();
  return <TableSurface>{error ? <Alert action={<AppButton type="link" onClick={() => void onRetry()}>{t("common.retry")}</AppButton>} message={error} showIcon type="error" /> : !loading && data.length === 0 ? <EmptyStatePanel description={emptyTitle} icon={<UnorderedListOutlined />} title={emptyTitle} /> : <AppTable columns={columns} dataSource={data} loading={loading} onChange={onTableChange} pagination={false} rowKey="id" rowSelection={selectedKeys && onSelectionChange ? { selectedRowKeys: selectedKeys, onChange: (keys) => onSelectionChange(keys.map(String)) } : undefined} tableLayout="fixed" />}</TableSurface>;
}

function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number, pageSize: number) => void }) {
  const { t } = useTranslation();
  return total > 0 ? <TablePaginationBar current={page} pageSize={pageSize} total={total} showSizeChanger showTotal={(count) => t("common.total", { total: count })} onChange={onChange} /> : null;
}

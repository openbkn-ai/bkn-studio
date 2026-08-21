/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, EllipsisOutlined, FilterOutlined, ReloadOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Alert, Dropdown, Popover, Select, Space, Tag, type MenuProps } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { formatDateTime } from "@/framework/i18n/format";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { collectVisiblePage, pagerTotal } from "@/modules/data-catalog/lib/visible-page";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { SemanticUnderstandingTaskDetailDrawer } from "@/modules/data-catalog/components/SemanticUnderstandingTaskDetailDrawer";
import sharedStyles from "@/modules/data-catalog/components/shared.module.css";
import {
  deleteDataConnectDiscoverTask,
  listDataConnectDiscoverSchedules,
  listDataConnectDiscoverTasks,
} from "@/modules/data-connect/services/discover.service";
import { DataConnectDiscoverTaskDrawer } from "@/modules/data-connect/components/DataConnectDiscoverTaskDrawer";
import type {
  DataConnectDiscoverSchedule,
  DataConnectDiscoverStrategy,
  DataConnectDiscoverTaskSort,
  DataConnectDiscoverTaskStatus,
  DataConnectDiscoverTaskSummary,
  DataConnectDiscoverTaskTriggerType,
} from "@/modules/data-connect/types/discover";
import { listCatalogResourcePage } from "@/modules/data-catalog/services/resource.service";
import { buildSemanticUnderstandingTaskListParams, deleteSemanticUnderstandingTask, mapSemanticUnderstandingTaskSummary, type BackendSemanticUnderstandingTaskSummary, type SemanticUnderstandingTaskListFilters, type SemanticUnderstandingTaskSummary } from "@/modules/data-catalog/services/semantic-understanding-task.service";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { listCatalogs } from "@/shared/catalog";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./TaskManagementTaskPanels.module.css";

type SemanticTaskStatus = SemanticUnderstandingTaskSummary["status"];
type SemanticTask = SemanticUnderstandingTaskSummary;
type SemanticTaskFilters = SemanticUnderstandingTaskListFilters;

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
    confidenceThreshold: 0.75,
    confidence: 0.94,
    applied: true,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: Date.now() - 1000 * 60 * 45,
    startTime: Date.now() - 1000 * 60 * 44,
    finishTime: Date.now() - 1000 * 60 * 40,
  },
  {
    id: "semantic-task-002",
    scope: "catalog",
    catalogId: "cat-002",
    status: "running",
    applyMode: "dry_run",
    agentId: "catalog-semantic-understanding",
    confidenceThreshold: 0.75,
    confidence: 0,
    applied: false,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: Date.now() - 1000 * 60 * 8,
    startTime: Date.now() - 1000 * 60 * 7,
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
  return formatDateTime(timestamp, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    year: "numeric",
  }).replace(/\//g, "-");
}

function TaskPanel({ children }: { children: React.ReactNode }) {
  return <section className={styles.contentSurface}>{children}</section>;
}

function DiscoverTaskProgress({ task }: { task: DataConnectDiscoverTaskSummary }) {
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
  const [tasks, setTasks] = useState<DataConnectDiscoverTaskSummary[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([]);
  const [schedules, setSchedules] = useState<DataConnectDiscoverSchedule[]>([]);
  const [catalogKeyword, setCatalogKeyword] = useState("");
  const [catalogId, setCatalogId] = useState<string>();
  const [status, setStatus] = useState<DataConnectDiscoverTaskStatus>();
  const [strategy, setStrategy] = useState<DataConnectDiscoverStrategy>();
  const [triggerType, setTriggerType] = useState<DataConnectDiscoverTaskTriggerType>();
  const [sort, setSort] = useState<DataConnectDiscoverTaskSort>("create_time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Cursors into the raw space: the backend filters each page after reading it (#977).
  const [offsets, setOffsets] = useState<number[]>([0]);
  const [hasMore, setHasMore] = useState(false);
  const [rawTotal, setRawTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await collectVisiblePage(
        (offset, limit) =>
          listDataConnectDiscoverTasks({
            catalogId,
            direction,
            limit,
            offset,
            sort,
            status,
            strategy,
            triggerType,
          }),
        { pageSize, startOffset: offsets[page - 1] ?? 0 },
      );
      setTasks(result.items);
      setRawTotal(result.rawTotal);
      setHasMore(!result.exhausted);
      setOffsets((current) => {
        const next = [...current];
        next[page] = result.nextOffset;
        return next;
      });
    } catch (loadError) {
      setError(extractRequestErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [catalogId, direction, offsets, page, pageSize, sort, status, strategy, triggerType]);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listCatalogs({ keyword: catalogKeyword, page: 1, pageSize: 50, type: "physical" }).then((result) => setCatalogs(result.items));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [catalogKeyword]);
  useEffect(() => {
    void listDataConnectDiscoverSchedules({ keyword: "", page: 1, pageSize: 200 })
      .then((result) => setSchedules(result.items))
      .catch(() => setSchedules([]));
  }, []);
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
  const handleTableChange: TableProps<DataConnectDiscoverTaskSummary>["onChange"] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== "sort") return;
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    setSort(single?.columnKey as DataConnectDiscoverTaskSort || "create_time");
    setDirection(single?.order === "ascend" ? "asc" : "desc");
    setPage(1);
  };

  const columns: ColumnsType<DataConnectDiscoverTaskSummary> = [
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
    {
      dataIndex: "scheduleId",
      title: t("dataConnect.discoverScheduleName"),
      width: 160,
      render: (value: string) => value ? schedules.find((schedule) => schedule.id === value)?.name ?? value : t("dataConnect.discoverManualTask"),
    },
    { dataIndex: "strategy", title: t("dataCatalog.taskManagement.columns.strategy"), width: 130, render: (value) => t(`dataConnect.discoverStrategies.${value}`) },
    { dataIndex: "triggerType", title: t("dataCatalog.taskManagement.columns.trigger"), width: 120, render: (value) => t(`dataConnect.discoverTriggerTypes.${value}`) },
    { dataIndex: "status", title: t("common.status"), width: 120, render: (value) => <Tag color={value === "failed" ? "error" : value === "completed" ? "success" : value === "cancelled" ? "default" : "processing"}>{t(`dataConnect.discoverTaskStatuses.${value}`)}</Tag> },
    {
      dataIndex: "progress",
      title: t("dataCatalog.task.progress"),
      width: 196,
      onCell: () => ({ className: styles.progressCell }),
      render: (_, record) => <DiscoverTaskProgress task={record} />,
    },
    { dataIndex: "startTime", key: "start_time", title: t("dataCatalog.taskManagement.details.startTime"), width: 180, sorter: true, sortOrder: sortOrderOf("start_time"), render: formatTime },
    { dataIndex: "lastProgressTime", key: "last_progress_time", title: t("dataConnect.discoverLastProgressTime"), width: 180, sorter: true, sortOrder: sortOrderOf("last_progress_time"), render: formatTime },
    { dataIndex: "finishTime", key: "finish_time", title: t("dataCatalog.task.finishedAt"), width: 180, sorter: true, sortOrder: sortOrderOf("finish_time"), render: formatTime },
    { dataIndex: "createTime", key: "create_time", title: t("dataCatalog.task.createTime"), width: 180, sorter: true, sortOrder: sortOrderOf("create_time"), render: formatTime },
    {
      align: "center",
      fixed: "right",
      key: "actions",
      title: t("common.actions"),
      width: 84,
      render: (_, record) => {
        const menuItems: NonNullable<MenuProps["items"]> = [{ key: "detail", label: t("common.detail") }];
        menuItems.push({
          danger: true,
          disabled: record.status === "pending" || record.status === "running",
          key: "delete",
          label: t("common.delete"),
        });
        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === "detail") {
                  setDetailTaskId(record.id);
                  return;
                }
                if (key === "delete") {
                  void modal.confirm({ title: t("dataConnect.discoverTaskDeleteConfirmTitle"), content: t("dataConnect.discoverTaskDeleteConfirmDescription", { id: record.id }), okButtonProps: { danger: true }, onOk: async () => { await deleteDataConnectDiscoverTask(record.id); message.success(t("common.success")); await load(); } });
                }
              },
            }}
            trigger={["click"]}
          >
            <AppButton aria-label={t("dataConnect.moreActions")} className={styles.actionMore} icon={<EllipsisOutlined />} type="link" />
          </Dropdown>
        );
      },
    },
  ];

  return <TaskPanel>
    <div className={styles.operationBar}><Space className={styles.toolbarActions}><AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton><AppButton danger disabled={selectedKeys.length === 0} icon={<DeleteOutlined />} onClick={handleBatchDelete}>{selectedKeys.length > 0 ? `${t("dataCatalog.task.batchDelete")} (${selectedKeys.length})` : t("dataCatalog.task.batchDelete")}</AppButton></Space><Space className={styles.toolbarFilters}>
      <Select allowClear className={styles.select} filterOption={false} onSearch={setCatalogKeyword} options={catalogs.map((item) => ({ label: item.name, value: item.id }))} placeholder={t("dataCatalog.resource.catalog")} showSearch value={catalogId} onChange={(value) => { setCatalogId(value); setPage(1); }} />
      <Select allowClear className={styles.select} options={["full_sync", "create_only", "cleanup_only"].map((value) => ({ label: t(`dataConnect.discoverStrategies.${value}`), value }))} placeholder={t("dataCatalog.taskManagement.columns.strategy")} value={strategy} onChange={(value) => { setStrategy(value); setPage(1); }} />
      <Select allowClear className={styles.select} options={["manual", "scheduled"].map((value) => ({ label: t(`dataConnect.discoverTriggerTypes.${value}`), value }))} placeholder={t("dataCatalog.taskManagement.columns.trigger")} value={triggerType} onChange={(value) => { setTriggerType(value); setPage(1); }} />
      <Select allowClear className={styles.select} options={["pending", "running", "completed", "failed", "cancelled"].map((value) => ({ label: t(`dataConnect.discoverTaskStatuses.${value}`), value }))} placeholder={t("common.status")} value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
    </Space></div>
    <TaskTable error={error} loading={loading} data={tasks} columns={columns} emptyTitle={t("dataCatalog.taskManagement.discover.empty")} rawTotal={rawTotal} onRetry={load} onTableChange={handleTableChange} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    <Pagination page={page} pageSize={pageSize} loaded={tasks.length} hasMore={hasMore} onChange={(nextPage, nextSize) => { if (nextSize !== pageSize) { setOffsets([0]); setPage(1); setPageSize(nextSize); return; } setPage(Math.min(nextPage, offsets.length)); }} />
    {detailTaskId ? <DataConnectDiscoverTaskDrawer catalogs={catalogs} onClose={() => setDetailTaskId(null)} open schedules={schedules} taskId={detailTaskId} /> : null}
  </TaskPanel>;
}

async function listSemanticTasks(offset: number, limit: number, filters: SemanticTaskFilters) {
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
    const sortTime = (task: SemanticTask) => {
      if (filters.sort === "start_time") return task.startTime ?? 0;
      if (filters.sort === "finish_time") return task.finishTime ?? 0;
      return task.createTime;
    };
    const sorted = filtered.sort((left, right) => {
      const leftValue = sortTime(left);
      const rightValue = sortTime(right);
      return leftValue > rightValue ? direction : leftValue < rightValue ? -direction : 0;
    });
    return wait({
      items: sorted.slice(offset, offset + limit),
      total: sorted.length,
    });
  }

  const response = await http.get<{ entries: BackendSemanticUnderstandingTaskSummary[]; total_count: number }>("/vega-backend/v1/semantic-understanding-tasks", {
    params: buildSemanticUnderstandingTaskListParams(1, limit, filters, { limit, offset }),
  });
  return { items: response.data.entries.map(mapSemanticUnderstandingTaskSummary), total: response.data.total_count };
}

async function deleteSemanticTask(id: string) {
  if (useMock) {
    mockSemanticTasks = mockSemanticTasks.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }

  await deleteSemanticUnderstandingTask(id);
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
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  // Cursors into the raw space: the backend filters each page after reading it (#977).
  const [offsets, setOffsets] = useState<number[]>([0]); const [hasMore, setHasMore] = useState(false); const [rawTotal, setRawTotal] = useState(0);
  const [scope, setScope] = useState<SemanticTask["scope"]>();
  const [catalogId, setCatalogId] = useState<string>();
  const [resourceId, setResourceId] = useState<string>();
  const [status, setStatus] = useState<SemanticTaskStatus>();
  const [applyMode, setApplyMode] = useState<string>();
  const [applied, setApplied] = useState<boolean>();
  const [sort, setSort] = useState<NonNullable<SemanticTaskFilters["sort"]>>("create_time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await collectVisiblePage(
        (offset, limit) => listSemanticTasks(offset, limit, { scope, catalogId, resourceId, status, applyMode, applied, sort, direction }),
        { pageSize, startOffset: offsets[page - 1] ?? 0 },
      );
      setTasks(result.items); setRawTotal(result.rawTotal); setHasMore(!result.exhausted);
      setOffsets((current) => { const next = [...current]; next[page] = result.nextOffset; return next; });
    } catch (loadError) { setError(extractRequestErrorMessage(loadError)); } finally { setLoading(false); }
  }, [applied, applyMode, catalogId, direction, offsets, page, pageSize, resourceId, scope, sort, status]);
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
    setSort(single?.columnKey as NonNullable<SemanticTaskFilters["sort"]> || "create_time");
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
    { dataIndex: "status", title: t("common.status"), width: 120, render: (value) => <Tag color={value === "succeeded" ? "success" : value === "failed" ? "error" : value === "cancelled" ? "default" : "processing"}>{t(`dataCatalog.taskManagement.semanticStatus.${value}`)}</Tag> },
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
    { dataIndex: "startTime", key: "start_time", title: t("dataCatalog.taskManagement.details.startTime"), width: 180, sorter: true, sortOrder: sortOrderOf("start_time"), render: formatTime },
    { dataIndex: "finishTime", key: "finish_time", title: t("dataCatalog.task.finishedAt"), width: 180, sorter: true, sortOrder: sortOrderOf("finish_time"), render: formatTime },
    { dataIndex: "createTime", key: "create_time", title: t("dataCatalog.task.createTime"), width: 180, sorter: true, sortOrder: sortOrderOf("create_time"), render: formatTime },
    {
      align: "center",
      fixed: "right",
      key: "actions",
      title: t("common.actions"),
      width: 84,
      render: (_, record) => {
        const menuItems: NonNullable<MenuProps["items"]> = [{ key: "detail", label: t("common.detail") }];
        menuItems.push({
          danger: true,
          disabled: record.status === "pending" || record.status === "running",
          key: "delete",
          label: t("common.delete"),
        });
        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === "detail") {
                  setDetailTaskId(record.id);
                  return;
                }
                if (key === "delete") {
                  void modal.confirm({ title: t("dataCatalog.taskManagement.semantic.deleteTitle"), content: t("dataCatalog.taskManagement.semantic.deleteDescription", { id: record.id }), okButtonProps: { danger: true }, onOk: async () => { await deleteSemanticTask(record.id); message.success(t("common.success")); await load(); } });
                }
              },
            }}
            trigger={["click"]}
          >
            <AppButton aria-label={t("dataConnect.moreActions")} className={styles.actionMore} icon={<EllipsisOutlined />} type="link" />
          </Dropdown>
        );
      },
    },
  ];
  const advancedFilterCount = Number(scope !== undefined) + Number(applyMode !== undefined) + Number(applied !== undefined);
  const moreFiltersLabel = advancedFilterCount > 0
    ? t("dataCatalog.taskManagement.moreFiltersWithCount", { count: advancedFilterCount })
    : t("dataCatalog.taskManagement.moreFilters");
  const advancedFilters = <Space direction="vertical" size={12}><Select allowClear className={styles.select} options={["catalog", "resource"].map((value) => ({ label: t(`dataCatalog.taskManagement.scope.${value}`), value }))} placeholder={t("dataCatalog.taskManagement.columns.scope")} value={scope} onChange={(value) => { setScope(value); if (value === "catalog") setResourceId(undefined); setPage(1); }} /><Select allowClear className={styles.select} options={["dry_run", "fill_empty", "force"].map((value) => ({ label: t(`dataCatalog.taskManagement.applyMode.${value === "dry_run" ? "dryRun" : value === "fill_empty" ? "fillEmpty" : "force"}`), value }))} placeholder={t("dataCatalog.taskManagement.columns.applyMode")} value={applyMode} onChange={(value) => { setApplyMode(value); setPage(1); }} /><Select allowClear className={styles.select} options={[true, false].map((value) => ({ label: t(value ? "dataCatalog.taskManagement.applied.applied" : "dataCatalog.taskManagement.applied.notApplied"), value }))} placeholder={t("dataCatalog.taskManagement.columns.applied")} value={applied} onChange={(value) => { setApplied(value); setPage(1); }} /><AppButton disabled={advancedFilterCount === 0} type="link" onClick={() => { setScope(undefined); setApplyMode(undefined); setApplied(undefined); setPage(1); }}>{t("dataCatalog.taskManagement.clearAdvancedFilters")}</AppButton></Space>;
  return <TaskPanel><div className={styles.operationBar}><Space className={styles.toolbarActions}><AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton><AppButton danger disabled={selectedKeys.length === 0} icon={<DeleteOutlined />} onClick={handleBatchDelete}>{selectedKeys.length > 0 ? `${t("dataCatalog.task.batchDelete")} (${selectedKeys.length})` : t("dataCatalog.task.batchDelete")}</AppButton></Space><Space className={styles.toolbarFilters}>
    <Select allowClear className={styles.select} filterOption={false} onSearch={setCatalogKeyword} options={catalogs.map((item) => ({ label: item.name, value: item.id }))} placeholder={t("dataCatalog.resource.catalog")} showSearch value={catalogId} onChange={(value) => { setCatalogId(value); setResourceId(undefined); setPage(1); }} />
    <Select allowClear className={styles.select} disabled={scope === "catalog"} filterOption={false} onSearch={setResourceKeyword} options={resourceOptions} placeholder={t("dataCatalog.build.resource")} showSearch value={resourceId} onChange={(value) => { setResourceId(value); setPage(1); }} />
    <Select allowClear className={styles.select} options={["pending", "running", "succeeded", "failed", "cancelled"].map((value) => ({ label: t(`dataCatalog.taskManagement.semanticStatus.${value}`), value }))} placeholder={t("common.status")} value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
    <Popover content={advancedFilters} trigger="click"><AppButton icon={<FilterOutlined />}>{moreFiltersLabel}</AppButton></Popover>
  </Space></div><TaskTable error={error} loading={loading} data={tasks} columns={columns} emptyTitle={t("dataCatalog.taskManagement.semantic.empty")} rawTotal={rawTotal} onRetry={load} onTableChange={handleTableChange} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} /><Pagination page={page} pageSize={pageSize} loaded={tasks.length} hasMore={hasMore} onChange={(nextPage, nextSize) => { if (nextSize !== pageSize) { setOffsets([0]); setPage(1); setPageSize(nextSize); return; } setPage(Math.min(nextPage, offsets.length)); }} />{detailTaskId ? <SemanticUnderstandingTaskDetailDrawer onClose={() => setDetailTaskId(null)} open taskId={detailTaskId} /> : null}</TaskPanel>;
}

function TaskTable<T extends { id: string }>({ error, loading, data, columns, emptyTitle, rawTotal = 0, onRetry, onTableChange, selectedKeys, onSelectionChange }: { error: string | null; loading: boolean; data: T[]; columns: ColumnsType<T>; emptyTitle: string; rawTotal?: number; onRetry: () => void | Promise<void>; onTableChange?: TableProps<T>["onChange"]; selectedKeys?: string[]; onSelectionChange?: (keys: string[]) => void }) {
  const { t } = useTranslation();
  // Tasks exist but none of them are visible: that is an authorization boundary, not an empty
  // platform, and the two read identically unless the copy says so (#977).
  const hidden = rawTotal > 0;
  const title = hidden ? t("dataCatalog.task.emptyVisible") : emptyTitle;
  const description = hidden ? t("dataCatalog.task.emptyUnauthorizedDescription") : emptyTitle;
  return <TableSurface className={styles.tableSurface}>{error ? <Alert action={<AppButton type="link" onClick={() => void onRetry()}>{t("common.retry")}</AppButton>} message={error} showIcon type="error" /> : !loading && data.length === 0 ? <EmptyStatePanel description={description} icon={<UnorderedListOutlined />} title={title} /> : <AppTable columns={columns} dataSource={data} loading={loading} onChange={onTableChange} pagination={false} rowKey="id" rowSelection={selectedKeys && onSelectionChange ? { selectedRowKeys: selectedKeys, onChange: (keys) => onSelectionChange(keys.map(String)) } : undefined} tableLayout="fixed" />}</TableSurface>;
}

function Pagination({ page, pageSize, loaded, hasMore, onChange }: { page: number; pageSize: number; loaded: number; hasMore: boolean; onChange: (page: number, pageSize: number) => void }) {
  const { t } = useTranslation();
  // The backend's count includes tasks this account cannot see, so it is never shown as a total.
  return loaded > 0 || page > 1 ? <TablePaginationBar current={page} pageSize={pageSize} total={pagerTotal({ hasMore, loaded, page, pageSize })} showSizeChanger showTotal={() => t("dataCatalog.task.visibleCount", { count: loaded })} onChange={onChange} /> : null;
}

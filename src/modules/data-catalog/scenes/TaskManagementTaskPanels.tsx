/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, EllipsisOutlined, ReloadOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Alert, Dropdown, Space, Tag, type MenuProps } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { collectVisiblePage, pagerTotal } from "@/modules/data-catalog/lib/visible-page";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { SemanticUnderstandingTaskDetailDrawer } from "@/modules/data-catalog/components/SemanticUnderstandingTaskDetailDrawer";
import { SemanticTaskAppliedTag, SemanticTaskStatusTag } from "@/modules/data-catalog/components/SemanticTaskPresentation";
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
import { deleteSemanticUnderstandingTask, listSemanticUnderstandingTasks, type SemanticUnderstandingTaskListFilters, type SemanticUnderstandingTaskSummary } from "@/modules/data-catalog/services/semantic-understanding-task.service";
import { listCatalogs } from "@/shared/catalog";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./TaskManagementTaskPanels.module.css";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type SemanticTaskStatus = SemanticUnderstandingTaskSummary["status"];
type SemanticTask = SemanticUnderstandingTaskSummary;
type SemanticTaskFilters = SemanticUnderstandingTaskListFilters;

function formatTime(value?: number) {
  if (!value) {
    return "-";
  }
  const timestamp = value < 100_000_000_000 ? value * 1000 : value;
  return formatDateTimeYmdHms(timestamp);
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
        : task.status === "cancelled" || task.status === "pending"
          ? sharedStyles.progressFillMuted
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

function DiscoverTaskPriority({ priority }: { priority: number }) {
  const { t } = useTranslation();
  const level = priority <= 10 ? "low" : priority >= 30 ? "high" : "normal";
  return <Tag color={level === "high" ? "error" : level === "low" ? "default" : "processing"}>{t(`dataConnect.discoverTaskPriorities.${level}`, { priority })}</Tag>;
}

function DiscoverTaskStatusTag({ status }: { status: DataConnectDiscoverTaskStatus }) {
  const { t } = useTranslation();
  const style = status === "completed" ? { background: "var(--color-success-bg)", borderColor: "var(--color-success-border)", color: "var(--color-success-text)" }
    : status === "failed" ? { background: "var(--color-error-bg)", borderColor: "var(--color-error-border)", color: "var(--color-error-text)" }
      : status === "cancelled" || status === "pending" ? { background: "var(--color-interface-panel-bg)", borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }
        : { background: "var(--color-info-bg)", borderColor: "var(--color-info-border)", color: "var(--color-text-link)" };
  return <Tag style={style}>{t(`dataConnect.discoverTaskStatuses.${status}`)}</Tag>;
}

export function DiscoverTaskListPanel() {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<DataConnectDiscoverTaskSummary[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([]);
  const [schedules, setSchedules] = useState<DataConnectDiscoverSchedule[]>([]);
  const [statuses, setStatuses] = useState<DataConnectDiscoverTaskStatus[]>([]);
  const [strategy, setStrategy] = useState<DataConnectDiscoverStrategy>();
  const [triggerType, setTriggerType] = useState<DataConnectDiscoverTaskTriggerType>();
  const [sort, setSort] = useState<DataConnectDiscoverTaskSort>("create_time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Cursors into the raw space: the backend filters each page after reading it (#977). Held in a
  // ref, not state — loading a page writes the next cursor, so as state it would re-create the
  // loader that produced it and the effect below would load forever.
  const offsetsRef = useRef<number[]>([0]);
  const [hasMore, setHasMore] = useState(false);
  const [rawTotal, setRawTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const canManageCatalogTasks = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "catalog:task_manage",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await collectVisiblePage(
        (offset, limit) =>
          listDataConnectDiscoverTasks({
            direction,
            limit,
            offset,
            sort,
            statuses: statuses.length === 0 ? undefined : statuses,
            strategy,
            triggerType,
          }),
        { pageSize, startOffset: offsetsRef.current[page - 1] ?? 0 },
      );
      setTasks(result.items);
      setRawTotal(result.rawTotal);
      // A spent request budget is not the end of the list: the next page stays reachable.
      setHasMore(!result.exhausted);
      offsetsRef.current[page] = result.nextOffset;
    } catch (loadError) {
      setError(extractRequestErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [direction, page, pageSize, sort, statuses, strategy, triggerType]);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    void listCatalogs({ keyword: "", page: 1, pageSize: 50, type: "physical" })
      .then((result) => setCatalogs(result.items))
      .catch(() => setCatalogs([]));
  }, []);
  useEffect(() => {
    void listDataConnectDiscoverSchedules({ keyword: "", page: 1, pageSize: 200 })
      .then((result) => setSchedules(result.items))
      .catch(() => setSchedules([]));
  }, []);
  const active = tasks.some((item) => item.status === "pending" || item.status === "running");
  useEffect(() => {
    if (useMock || !active) return;
    const timer = window.setInterval(() => !document.hidden && void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  const batchDeleteTargets = tasks.filter(
    (task) =>
      selectedKeys.includes(task.id) &&
      task.status !== "pending" &&
      task.status !== "running",
  );
  const handleBatchDelete = () => {
    if (batchDeleteTargets.length === 0) return;
    void modal.confirm({
      title: t("dataCatalog.task.batchDeleteConfirmTitle", { count: batchDeleteTargets.length }),
      content: t("dataCatalog.task.batchDeleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        const results = await Promise.allSettled(batchDeleteTargets.map((task) => deleteDataConnectDiscoverTask(task.id)));
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) message.error(t("dataCatalog.task.batchDeletePartial", { failed, total: batchDeleteTargets.length }));
        else message.success(t("common.success"));
        setSelectedKeys([]);
        await load();
      },
    });
  };
  const sortOrderOf = (key: DataConnectDiscoverTaskSort) => sort === key ? (direction === "asc" ? "ascend" : "descend") : null;
  const handleTableChange: TableProps<DataConnectDiscoverTaskSummary>["onChange"] = (_pagination, filters, sorter, extra) => {
    if (extra.action === "filter") {
      setStrategy(filters.strategy?.[0] as DataConnectDiscoverStrategy | undefined);
      setTriggerType(filters.triggerType?.[0] as DataConnectDiscoverTaskTriggerType | undefined);
      setStatuses((filters.status ?? []).map(String) as DataConnectDiscoverTaskStatus[]);
      setSelectedKeys([]);
      setPage(1);
      return;
    }
    if (extra.action !== "sort") return;
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!single?.columnKey || !single.order) {
      setSort("create_time");
      setDirection("desc");
    } else {
      setSort(single.columnKey as DataConnectDiscoverTaskSort);
      setDirection(single.order === "ascend" ? "asc" : "desc");
    }
    setSelectedKeys([]);
    setPage(1);
  };

  const columns: ColumnsType<DataConnectDiscoverTaskSummary> = [
    {
      dataIndex: "id",
      title: t("dataCatalog.taskManagement.columns.task"),
      width: 160,
      ellipsis: true,
      render: (value: string) => (
        <button className={styles.textLink} onClick={() => setDetailTaskId(value)} type="button">
          {value}
        </button>
      ),
    },
    {
      dataIndex: "catalogId",
      title: t("dataCatalog.taskManagement.columns.catalog"),
      width: 160,
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
      title: t("dataCatalog.taskManagement.columns.resource"),
      width: 160,
      ellipsis: true,
      render: (value: string | undefined, record: DataConnectDiscoverTaskSummary) =>
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
    { dataIndex: "strategy", title: t("dataCatalog.taskManagement.columns.strategy"), width: 110, filters: ["full_sync", "create_only", "cleanup_only"].map((value) => ({ text: t(`dataConnect.discoverStrategies.${value}`), value })), filterMultiple: false, filteredValue: strategy ? [strategy] : null, render: (value) => t(`dataConnect.discoverStrategies.${value}`) },
    { dataIndex: "triggerType", title: t("dataCatalog.taskManagement.columns.trigger"), width: 100, filters: ["manual", "scheduled"].map((value) => ({ text: t(`dataConnect.discoverTriggerTypes.${value}`), value })), filterMultiple: false, filteredValue: triggerType ? [triggerType] : null, render: (value) => t(`dataConnect.discoverTriggerTypes.${value}`) },
    { dataIndex: "queuePriority", title: t("dataConnect.discoverQueuePriority"), width: 100, render: (value: number) => <DiscoverTaskPriority priority={value} /> },
    { dataIndex: "status", title: t("dataCatalog.task.detailSections.status"), width: 120, filters: ["pending", "running", "completed", "failed", "cancelled"].map((value) => ({ text: t(`dataConnect.discoverTaskStatuses.${value}`), value })), filteredValue: statuses.length ? statuses : null, render: (value: DataConnectDiscoverTaskStatus) => <DiscoverTaskStatusTag status={value} /> },
    {
      dataIndex: "progress",
      title: t("dataCatalog.task.progress"),
      width: 200,
      onCell: () => ({ className: styles.progressCell }),
      render: (_, record) => <DiscoverTaskProgress task={record} />,
    },
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
        if (canManageCatalogTasks && record.status !== "pending" && record.status !== "running") {
          menuItems.push({
            danger: true,
            key: "delete",
            label: t("common.delete"),
          });
        }
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
    <div className={styles.operationBar}><Space className={styles.toolbarActions}><AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton><PermissionGate permissions="catalog:task_manage"><AppButton danger disabled={batchDeleteTargets.length === 0} icon={<DeleteOutlined />} onClick={handleBatchDelete}>{batchDeleteTargets.length > 0 ? `${t("dataCatalog.task.batchDelete")} (${batchDeleteTargets.length})` : t("dataCatalog.task.batchDelete")}</AppButton></PermissionGate></Space></div>
    <TaskTable canSelect={canManageCatalogTasks} error={error} loading={loading} data={tasks} columns={columns} emptyTitle={t("dataCatalog.taskManagement.discover.empty")} isSelectionDisabled={(task) => task.status === "pending" || task.status === "running"} rawTotal={rawTotal} onRetry={load} onTableChange={handleTableChange} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    <Pagination page={page} pageSize={pageSize} loaded={tasks.length} hasMore={hasMore} onChange={(nextPage, nextSize) => { setSelectedKeys([]); if (nextSize !== pageSize) { offsetsRef.current = [0]; setPage(1); setPageSize(nextSize); return; } setPage(Math.min(nextPage, page + 1)); }} />
    {detailTaskId ? <DataConnectDiscoverTaskDrawer catalogs={catalogs} onClose={() => setDetailTaskId(null)} open schedules={schedules} taskId={detailTaskId} /> : null}
  </TaskPanel>;
}

async function listSemanticTasks(offset: number, limit: number, filters: SemanticTaskFilters) {
  return listSemanticUnderstandingTasks(filters, { limit, offset });
}

async function deleteSemanticTask(id: string) {
  return deleteSemanticUnderstandingTask(id);
}

export function SemanticUnderstandingTaskListPanel() {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<SemanticTask[]>([]);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  // Cursors into the raw space: the backend filters each page after reading it (#977).
  const offsetsRef = useRef<number[]>([0]); const [hasMore, setHasMore] = useState(false); const [rawTotal, setRawTotal] = useState(0);
  const [scope, setScope] = useState<SemanticTask["scope"]>();
  const [statuses, setStatuses] = useState<SemanticTaskStatus[]>([]);
  const [applyMode, setApplyMode] = useState<string>();
  const [applied, setApplied] = useState<boolean>();
  const [sort, setSort] = useState<NonNullable<SemanticTaskFilters["sort"]>>("create_time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const canManageCatalogTasks = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "catalog:task_manage",
  });
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await collectVisiblePage(
        (offset, limit) => listSemanticTasks(offset, limit, { scope, statuses: statuses.length === 0 ? undefined : statuses, applyMode, applied, sort, direction }),
        { pageSize, startOffset: offsetsRef.current[page - 1] ?? 0 },
      );
      setTasks(result.items); setRawTotal(result.rawTotal); setHasMore(!result.exhausted);
      offsetsRef.current[page] = result.nextOffset;
    } catch (loadError) { setError(extractRequestErrorMessage(loadError)); } finally { setLoading(false); }
  }, [applied, applyMode, direction, page, pageSize, scope, sort, statuses]);
  useEffect(() => void load(), [load]);
  const active = tasks.some((item) => item.status === "pending" || item.status === "running");
  useEffect(() => { if (useMock || !active) return; const timer = window.setInterval(() => !document.hidden && void load(), 10_000); return () => window.clearInterval(timer); }, [active, load]);
  const batchDeleteTargets = tasks.filter(
    (task) =>
      selectedKeys.includes(task.id) &&
      task.status !== "pending" &&
      task.status !== "running",
  );
  const handleBatchDelete = () => {
    if (batchDeleteTargets.length === 0) return;
    void modal.confirm({
      title: t("dataCatalog.task.batchDeleteConfirmTitle", { count: batchDeleteTargets.length }),
      content: t("dataCatalog.task.batchDeleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        const results = await Promise.allSettled(batchDeleteTargets.map((task) => deleteSemanticTask(task.id)));
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) message.error(t("dataCatalog.task.batchDeletePartial", { failed, total: batchDeleteTargets.length }));
        else message.success(t("common.success"));
        setSelectedKeys([]);
        await load();
      },
    });
  };
  const sortOrderOf = (key: NonNullable<SemanticTaskFilters["sort"]>) => sort === key ? (direction === "asc" ? "ascend" : "descend") : null;
  const handleTableChange: TableProps<SemanticTask>["onChange"] = (_pagination, filters, sorter, extra) => {
    if (extra.action === "filter") {
      setScope(filters.scope?.[0] as SemanticTask["scope"] | undefined); setApplyMode(filters.applyMode?.[0] as string | undefined); setStatuses((filters.status ?? []).map(String) as SemanticTaskStatus[]); setApplied(filters.applied?.[0] === undefined ? undefined : filters.applied[0] === "true"); setSelectedKeys([]); setPage(1); return;
    }
    if (extra.action !== "sort") return;
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!single?.columnKey || !single.order) {
      setSort("create_time");
      setDirection("desc");
    } else {
      setSort(single.columnKey as NonNullable<SemanticTaskFilters["sort"]>);
      setDirection(single.order === "ascend" ? "asc" : "desc");
    }
    setSelectedKeys([]);
    setPage(1);
  };
  const columns: ColumnsType<SemanticTask> = [
    { dataIndex: "id", title: t("dataCatalog.taskManagement.columns.task"), width: 160, ellipsis: true, render: (value: string) => <button className={styles.textLink} onClick={() => setDetailTaskId(value)} type="button">{value}</button> },
    {
      dataIndex: "catalogId",
      title: t("dataCatalog.taskManagement.columns.catalog"),
      width: 160,
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
      title: t("dataCatalog.taskManagement.columns.resource"),
      width: 160,
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
    { dataIndex: "scope", title: t("dataCatalog.taskManagement.columns.scope"), width: 100, filters: ["catalog", "resource"].map((value) => ({ text: t(`dataCatalog.taskManagement.scope.${value}`), value })), filterMultiple: false, filteredValue: scope ? [scope] : null, render: (value) => t(`dataCatalog.taskManagement.scope.${value}`) },
    {
      dataIndex: "applyMode",
      title: t("dataCatalog.taskManagement.columns.applyMode"),
      width: 100,
      filters: ["dry_run", "fill_empty", "force"].map((value) => ({ text: t(`dataCatalog.taskManagement.applyMode.${value === "dry_run" ? "dryRun" : value === "fill_empty" ? "fillEmpty" : "force"}`), value })), filterMultiple: false, filteredValue: applyMode ? [applyMode] : null,
      render: (value: string) =>
        value === "dry_run"
          ? t("dataCatalog.taskManagement.applyMode.dryRun")
          : value === "force"
            ? t("dataCatalog.taskManagement.applyMode.force")
            : value === "fill_empty"
              ? t("dataCatalog.taskManagement.applyMode.fillEmpty")
              : value,
    },
    { dataIndex: "status", title: t("dataCatalog.task.detailSections.status"), width: 120, filters: ["pending", "running", "completed", "failed", "cancelled"].map((value) => ({ text: t(`dataCatalog.taskManagement.semanticStatus.${value}`), value })), filteredValue: statuses.length ? statuses : null, render: (value: SemanticTaskStatus) => <SemanticTaskStatusTag status={value} /> },
    {
      dataIndex: "applied",
      title: t("dataCatalog.taskManagement.columns.applied"),
      width: 100,
      filters: [true, false].map((value) => ({ text: t(value ? "dataCatalog.taskManagement.applied.applied" : "dataCatalog.taskManagement.applied.notApplied"), value: String(value) })), filterMultiple: false, filteredValue: applied === undefined ? null : [String(applied)],
      render: (value: boolean) => <SemanticTaskAppliedTag applied={value} />,
    },
    { dataIndex: "confidence", title: t("dataCatalog.taskManagement.columns.confidence"), width: 100, render: (value) => `${Math.round(value * 100)}%` },
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
        if (canManageCatalogTasks && record.status !== "pending" && record.status !== "running") {
          menuItems.push({
            danger: true,
            key: "delete",
            label: t("common.delete"),
          });
        }
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
  return <TaskPanel><div className={styles.operationBar}><Space className={styles.toolbarActions}><AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton><PermissionGate permissions="catalog:task_manage"><AppButton danger disabled={batchDeleteTargets.length === 0} icon={<DeleteOutlined />} onClick={handleBatchDelete}>{batchDeleteTargets.length > 0 ? `${t("dataCatalog.task.batchDelete")} (${batchDeleteTargets.length})` : t("dataCatalog.task.batchDelete")}</AppButton></PermissionGate></Space></div><TaskTable canSelect={canManageCatalogTasks} error={error} loading={loading} data={tasks} columns={columns} emptyTitle={t("dataCatalog.taskManagement.semantic.empty")} isSelectionDisabled={(task) => task.status === "pending" || task.status === "running"} rawTotal={rawTotal} onRetry={load} onTableChange={handleTableChange} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} /><Pagination page={page} pageSize={pageSize} loaded={tasks.length} hasMore={hasMore} onChange={(nextPage, nextSize) => { setSelectedKeys([]); if (nextSize !== pageSize) { offsetsRef.current = [0]; setPage(1); setPageSize(nextSize); return; } setPage(Math.min(nextPage, page + 1)); }} />{detailTaskId ? <SemanticUnderstandingTaskDetailDrawer onClose={() => setDetailTaskId(null)} open taskId={detailTaskId} /> : null}</TaskPanel>;
}

function TaskTable<T extends { id: string; status: string }>({ canSelect, error, loading, data, columns, emptyTitle, isSelectionDisabled, rawTotal = 0, onRetry, onTableChange, selectedKeys, onSelectionChange }: { canSelect: boolean; error: string | null; loading: boolean; data: T[]; columns: ColumnsType<T>; emptyTitle: string; isSelectionDisabled: (task: T) => boolean; rawTotal?: number; onRetry: () => void | Promise<void>; onTableChange?: TableProps<T>["onChange"]; selectedKeys?: string[]; onSelectionChange?: (keys: string[]) => void }) {
  const { t } = useTranslation();
  // Tasks exist but none of them are visible: that is an authorization boundary, not an empty
  // platform, and the two read identically unless the copy says so (#977).
  const hidden = rawTotal > 0;
  const title = hidden ? t("dataCatalog.task.emptyVisible") : emptyTitle;
  const description = hidden ? t("dataCatalog.task.emptyUnauthorizedDescription") : emptyTitle;
  return <TableSurface className={styles.tableSurface}>{error ? <Alert action={<AppButton type="link" onClick={() => void onRetry()}>{t("common.retry")}</AppButton>} message={error} showIcon type="error" /> : <AppTable columns={columns} dataSource={data} locale={{ emptyText: <EmptyStatePanel description={description} icon={<UnorderedListOutlined />} title={title} /> }} loading={loading} onChange={onTableChange} pagination={false} rowKey="id" rowSelection={canSelect && selectedKeys && onSelectionChange ? { selectedRowKeys: selectedKeys, onChange: (keys) => onSelectionChange(keys.map(String)), getCheckboxProps: (task) => ({ disabled: isSelectionDisabled(task) }) } : undefined} tableLayout="fixed" />}</TableSurface>;
}

function Pagination({ page, pageSize, loaded, hasMore, onChange }: { page: number; pageSize: number; loaded: number; hasMore: boolean; onChange: (page: number, pageSize: number) => void }) {
  const { t } = useTranslation();
  // The backend's count includes tasks this account cannot see, so it is never shown as a total.
  return loaded > 0 || page > 1 || hasMore ? <TablePaginationBar current={page} pageSize={pageSize} total={pagerTotal({ hasMore, loaded, page, pageSize })} showSizeChanger showTotal={() => t("dataCatalog.task.visibleCount", { count: loaded })} onChange={onChange} /> : null;
}

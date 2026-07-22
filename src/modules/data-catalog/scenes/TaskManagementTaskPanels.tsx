/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Alert, Select, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import {
  deleteDataConnectScanTask,
  listDataConnectScanTasks,
} from "@/modules/data-connect/services/scan.service";
import type { DataConnectScanTask, DataConnectScanTaskStatus } from "@/modules/data-connect/types/scan";
import { catalogListPhysicalQuery, listCatalogs } from "@/shared/catalog";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./TaskManagementTaskPanels.module.css";

type ListResponse<T> = { entries: T[]; total_count: number };
type SemanticTaskStatus = "pending" | "running" | "succeeded" | "failed";
type SemanticTask = {
  id: string;
  scope: "catalog" | "resource";
  catalogId: string;
  resourceId?: string;
  status: SemanticTaskStatus;
  agentId: string;
  confidence: number;
  applied: boolean;
  createTime: number;
};

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}

function TaskPanel({ children }: { children: React.ReactNode }) {
  return <section className={styles.contentSurface}>{children}</section>;
}

export function DiscoverTaskListPanel() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [tasks, setTasks] = useState<DataConnectScanTask[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([]);
  const [catalogId, setCatalogId] = useState<string>();
  const [status, setStatus] = useState<DataConnectScanTaskStatus>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [taskResult, catalogResult] = await Promise.all([
        listDataConnectScanTasks({ catalogId, page, pageSize, status }),
        listCatalogs(catalogListPhysicalQuery()),
      ]);
      setTasks(taskResult.items);
      setTotal(taskResult.total);
      setCatalogs(catalogResult.items);
    } catch (loadError) {
      setError(extractRequestErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [catalogId, page, pageSize, status]);

  useEffect(() => void load(), [load]);
  const catalogNameMap = useMemo(() => new Map(catalogs.map((item) => [item.id, item.name])), [catalogs]);
  const active = tasks.some((item) => item.status === "pending" || item.status === "running");
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => !document.hidden && void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  const columns: ColumnsType<DataConnectScanTask> = [
    { dataIndex: "id", title: t("dataCatalog.taskManagement.columns.task"), ellipsis: true },
    { dataIndex: "catalogId", title: t("dataCatalog.resource.catalog"), render: (value) => catalogNameMap.get(value) ?? value },
    { dataIndex: "strategy", title: t("dataCatalog.taskManagement.columns.strategy"), render: (value) => t(`dataConnect.scanStrategies.${value}`) },
    { dataIndex: "triggerType", title: t("dataCatalog.taskManagement.columns.trigger"), render: (value) => t(`dataConnect.scanTriggerTypes.${value}`) },
    { dataIndex: "status", title: t("common.status"), render: (value) => t(`dataConnect.scanTaskStatuses.${value}`) },
    { dataIndex: "progress", title: t("dataCatalog.task.progress"), render: (value) => `${value}%` },
    { dataIndex: "createTime", title: t("dataCatalog.task.createTime") },
    {
      key: "actions", title: t("common.actions"), width: 80,
      render: (_, record) => <PermissionGate permissions="catalog:task_manage"><AppButton danger type="link" onClick={() => void modal.confirm({ title: t("dataConnect.scanTaskDeleteConfirmTitle"), content: t("dataConnect.scanTaskDeleteConfirmDescription", { id: record.id }), okButtonProps: { danger: true }, onOk: async () => { await deleteDataConnectScanTask(record.id); message.success(t("common.success")); await load(); } })}>{t("common.delete")}</AppButton></PermissionGate>,
    },
  ];

  return <TaskPanel>
    <div className={styles.operationBar}><Space><AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton></Space><Space wrap>
      <Select allowClear className={styles.select} options={catalogs.map((item) => ({ label: item.name, value: item.id }))} placeholder={t("dataCatalog.resource.catalog")} value={catalogId} onChange={(value) => { setCatalogId(value); setPage(1); }} />
      <Select allowClear className={styles.select} options={["pending", "running", "completed", "failed"].map((value) => ({ label: t(`dataConnect.scanTaskStatuses.${value}`), value }))} placeholder={t("common.status")} value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
    </Space></div>
    <TaskTable error={error} loading={loading} data={tasks} columns={columns} emptyTitle={t("dataCatalog.taskManagement.discover.empty")} onRetry={load} />
    <Pagination page={page} pageSize={pageSize} total={total} onChange={(nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }} />
  </TaskPanel>;
}

async function listSemanticTasks(page: number, pageSize: number, status?: SemanticTaskStatus) {
  const response = await http.get<ListResponse<{ id: string; scope: "catalog" | "resource"; catalog_id: string; resource_id?: string; status: SemanticTaskStatus; agent_id: string; confidence?: number; applied?: boolean; create_time?: number }>>("/vega-backend/v1/semantic-understanding-tasks", { params: { direction: "desc", limit: pageSize, offset: (page - 1) * pageSize, sort: "create_time", status } });
  return { items: response.data.entries.map((item) => ({ id: item.id, scope: item.scope, catalogId: item.catalog_id, resourceId: item.resource_id, status: item.status, agentId: item.agent_id, confidence: item.confidence ?? 0, applied: item.applied ?? false, createTime: item.create_time ?? 0 })), total: response.data.total_count };
}

export function SemanticUnderstandingTaskListPanel() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [tasks, setTasks] = useState<SemanticTask[]>([]);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<SemanticTaskStatus>(); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const result = await listSemanticTasks(page, pageSize, status); setTasks(result.items); setTotal(result.total); } catch (loadError) { setError(extractRequestErrorMessage(loadError)); } finally { setLoading(false); } }, [page, pageSize, status]);
  useEffect(() => void load(), [load]);
  const active = tasks.some((item) => item.status === "pending" || item.status === "running");
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => !document.hidden && void load(), 10_000); return () => window.clearInterval(timer); }, [active, load]);
  const columns: ColumnsType<SemanticTask> = [
    { dataIndex: "id", title: t("dataCatalog.taskManagement.columns.task"), ellipsis: true },
    { dataIndex: "scope", title: t("dataCatalog.taskManagement.columns.scope"), render: (value) => t(`dataCatalog.taskManagement.scope.${value}`) },
    { dataIndex: "catalogId", title: t("dataCatalog.resource.catalog"), ellipsis: true },
    { dataIndex: "resourceId", title: t("dataCatalog.build.resource"), render: (value) => value || "-", ellipsis: true },
    { dataIndex: "status", title: t("common.status"), render: (value) => <Tag color={value === "succeeded" ? "success" : value === "failed" ? "error" : "processing"}>{t(`dataCatalog.taskManagement.semanticStatus.${value}`)}</Tag> },
    { dataIndex: "confidence", title: t("dataCatalog.taskManagement.columns.confidence"), render: (value) => `${Math.round(value * 100)}%` },
    { dataIndex: "applied", title: t("dataCatalog.taskManagement.columns.applied"), render: (value) => value ? t("common.yes") : t("common.no") },
    { dataIndex: "createTime", title: t("dataCatalog.task.createTime"), render: formatTime },
    { key: "actions", title: t("common.actions"), width: 80, render: (_, record) => <PermissionGate permissions="catalog:task_manage"><AppButton danger disabled={record.status === "pending" || record.status === "running"} type="link" onClick={() => void modal.confirm({ title: t("dataCatalog.taskManagement.semantic.deleteTitle"), content: t("dataCatalog.taskManagement.semantic.deleteDescription", { id: record.id }), okButtonProps: { danger: true }, onOk: async () => { await http.delete(`/vega-backend/v1/semantic-understanding-tasks/${record.id}`); message.success(t("common.success")); await load(); } })}>{t("common.delete")}</AppButton></PermissionGate> },
  ];
  return <TaskPanel><div className={styles.operationBar}><AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton><Select allowClear className={styles.select} options={["pending", "running", "succeeded", "failed"].map((value) => ({ label: t(`dataCatalog.taskManagement.semanticStatus.${value}`), value }))} placeholder={t("common.status")} value={status} onChange={(value) => { setStatus(value); setPage(1); }} /></div><TaskTable error={error} loading={loading} data={tasks} columns={columns} emptyTitle={t("dataCatalog.taskManagement.semantic.empty")} onRetry={load} /><Pagination page={page} pageSize={pageSize} total={total} onChange={(nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }} /></TaskPanel>;
}

function TaskTable<T extends { id: string }>({ error, loading, data, columns, emptyTitle, onRetry }: { error: string | null; loading: boolean; data: T[]; columns: ColumnsType<T>; emptyTitle: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return <TableSurface>{error ? <Alert action={<AppButton type="link" onClick={onRetry}>{t("common.retry")}</AppButton>} message={error} showIcon type="error" /> : !loading && data.length === 0 ? <EmptyStatePanel description={emptyTitle} icon={<UnorderedListOutlined />} title={emptyTitle} /> : <AppTable columns={columns} dataSource={data} loading={loading} pagination={false} rowKey="id" tableLayout="fixed" />}</TableSurface>;
}

function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number, pageSize: number) => void }) {
  const { t } = useTranslation();
  return total > 0 ? <TablePaginationBar current={page} pageSize={pageSize} total={total} showSizeChanger showTotal={(count) => t("common.total", { total: count })} onChange={onChange} /> : null;
}

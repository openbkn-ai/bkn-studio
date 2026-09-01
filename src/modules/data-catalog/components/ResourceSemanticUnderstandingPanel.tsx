/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Alert, Checkbox, Dropdown, Form, InputNumber, Modal, Select, Space, type MenuProps } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { SemanticUnderstandingTaskDetailDrawer } from "@/modules/data-catalog/components/SemanticUnderstandingTaskDetailDrawer";
import { SemanticTaskAppliedTag, SemanticTaskStatusTag } from "@/modules/data-catalog/components/SemanticTaskPresentation";
import { createResourceSemanticUnderstandingTask, deleteSemanticUnderstandingTask, listResourceSemanticUnderstandingTasks, type CreateSemanticUnderstandingTaskPayload, type SemanticUnderstandingTaskSummary } from "@/modules/data-catalog/services/semantic-understanding-task.service";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import styles from "./ResourceSemanticUnderstandingPanel.module.css";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

function formatTime(value: number) {
  if (!value) return "-";
  return formatDateTimeYmdHms(value < 100_000_000_000 ? value * 1000 : value);
}

export function ResourceSemanticUnderstandingPanel({ active, resource }: { active: boolean; resource: CatalogResource }) {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const [form] = Form.useForm<CreateSemanticUnderstandingTaskPayload>();
  const [tasks, setTasks] = useState<SemanticUnderstandingTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [applyModeFilter, setApplyModeFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<SemanticUnderstandingTaskSummary["status"][]>([]);
  const [appliedFilter, setAppliedFilter] = useState<boolean>();
  const [sort, setSort] = useState<"create_time" | "finish_time">("create_time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const canManageTasks = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "catalog:task_manage",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTasks(await listResourceSemanticUnderstandingTasks(resource.id));
    } catch (e) {
      setError(extractRequestErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [resource.id]);

  useEffect(() => {
    setTasks([]);
    setSelectedKeys([]);
    setApplyModeFilter(undefined);
    setStatusFilter([]);
    setAppliedFilter(undefined);
    setSort("create_time");
    setDirection("desc");
    setPage(1);
    setDetailTaskId(null);
  }, [resource.id]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  useEffect(() => {
    if (useMock || !active || !tasks.some((task) => task.status === "pending" || task.status === "running")) return;
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [active, load, tasks]);

  const summary = useMemo(() => tasks.find((task) => task.status === "completed" && task.applied) ?? tasks[0], [tasks]);
  const summaryPresentation =
    !summary
      ? { className: styles.summaryValueMuted, label: t("dataCatalog.semanticWorkspace.noResult") }
      : summary.status === "completed" && summary.applied
        ? { className: styles.summaryValueSuccess, label: t("dataCatalog.semanticWorkspace.applied") }
        : summary.status === "completed"
          ? { className: styles.summaryValueMuted, label: t("dataCatalog.semanticWorkspace.generatedNotApplied") }
          : summary.status === "pending"
            ? { className: styles.summaryValueMuted, label: t("dataCatalog.semanticWorkspace.pending") }
            : summary.status === "running"
              ? { className: styles.summaryValueProcessing, label: t("dataCatalog.semanticWorkspace.running") }
              : summary.status === "failed"
                ? { className: styles.summaryValueError, label: t("dataCatalog.semanticWorkspace.failed") }
                : { className: styles.summaryValueMuted, label: t("dataCatalog.semanticWorkspace.cancelled") };

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      applyMode: "fill_empty",
      confidenceThreshold: 0.75,
      includeSampleRows: false,
    });
  }, [form, open]);

  const start = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      await createResourceSemanticUnderstandingTask({ ...values, resourceId: resource.id });
      message.success(t("dataCatalog.semanticWorkspace.started"));
      setOpen(false);
      form.resetFields();
      await load();
    } finally {
      setCreating(false);
    }
  };

  const filteredTasks = useMemo(() => tasks
    .filter((task) =>
      (!applyModeFilter || task.applyMode === applyModeFilter) &&
      (statusFilter.length === 0 || statusFilter.includes(task.status)) &&
      (appliedFilter === undefined || task.applied === appliedFilter),
    )
    .sort((left, right) => {
      const leftTime = sort === "finish_time" ? left.finishTime ?? 0 : left.createTime;
      const rightTime = sort === "finish_time" ? right.finishTime ?? 0 : right.createTime;
      return (leftTime - rightTime) * (direction === "asc" ? 1 : -1);
    }), [appliedFilter, applyModeFilter, direction, sort, statusFilter, tasks]);

  const batchDeleteTargets = filteredTasks.filter(
    (task) =>
      selectedKeys.includes(task.id) &&
      task.status !== "pending" &&
      task.status !== "running",
  );
  const pagedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page, pageSize]);

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [filteredTasks.length, page, pageSize]);

  const handleBatchDelete = () => {
    if (!batchDeleteTargets.length) return;
    void modal.confirm({
      title: t("dataCatalog.task.batchDeleteConfirmTitle", { count: batchDeleteTargets.length }),
      content: t("dataCatalog.task.batchDeleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        const results = await Promise.allSettled(
          batchDeleteTargets.map((task) => deleteSemanticUnderstandingTask(task.id)),
        );
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) {
          message.error(
            t("dataCatalog.task.batchDeletePartial", {
              failed,
              total: batchDeleteTargets.length,
            }),
          );
        } else {
          message.success(t("common.success"));
        }
        setSelectedKeys([]);
        await load();
      },
    });
  };

  const sortOrderOf = (key: "create_time" | "finish_time") =>
    sort === key ? (direction === "asc" ? "ascend" : "descend") : null;
  const handleTableChange: TableProps<SemanticUnderstandingTaskSummary>["onChange"] = (_pagination, filters, sorter, extra) => {
    if (extra.action === "filter") {
      setApplyModeFilter(filters.applyMode?.[0] as string | undefined);
      setStatusFilter((filters.status ?? []).map(String) as SemanticUnderstandingTaskSummary["status"][]);
      setAppliedFilter(filters.applied?.[0] === undefined ? undefined : filters.applied[0] === "true");
      setPage(1);
      return;
    }
    if (extra.action !== "sort") return;
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!single?.columnKey || !single.order) {
      setSort("create_time");
      setDirection("desc");
    } else {
      setSort(single.columnKey as "create_time" | "finish_time");
      setDirection(single.order === "ascend" ? "asc" : "desc");
    }
    setPage(1);
  };

  const columns: ColumnsType<SemanticUnderstandingTaskSummary> = [
    { dataIndex: "id", title: t("dataCatalog.taskManagement.columns.task"), width: 160, ellipsis: true, render: (value: string) => <button className={styles.textLink} onClick={() => setDetailTaskId(value)} type="button">{value}</button> },
    { dataIndex: "applyMode", title: t("dataCatalog.taskManagement.columns.applyMode"), width: 100, filters: ["dry_run", "fill_empty", "force"].map((value) => ({ text: t(`dataCatalog.taskManagement.applyMode.${value === "dry_run" ? "dryRun" : value === "fill_empty" ? "fillEmpty" : "force"}`), value })), filterMultiple: false, filteredValue: applyModeFilter ? [applyModeFilter] : null, render: (value: string) => t(`dataCatalog.taskManagement.applyMode.${value === "dry_run" ? "dryRun" : value === "fill_empty" ? "fillEmpty" : "force"}`) },
    { dataIndex: "status", title: t("dataCatalog.task.detailSections.status"), width: 120, filters: ["pending", "running", "completed", "failed", "cancelled"].map((value) => ({ text: t(`dataCatalog.taskManagement.semanticStatus.${value}`), value })), filteredValue: statusFilter.length ? statusFilter : null, render: (value: SemanticUnderstandingTaskSummary["status"]) => <SemanticTaskStatusTag status={value} /> },
    { dataIndex: "applied", title: t("dataCatalog.taskManagement.columns.applied"), width: 100, filters: [true, false].map((value) => ({ text: t(value ? "dataCatalog.taskManagement.applied.applied" : "dataCatalog.taskManagement.applied.notApplied"), value: String(value) })), filterMultiple: false, filteredValue: appliedFilter === undefined ? null : [String(appliedFilter)], render: (value: boolean) => <SemanticTaskAppliedTag applied={value} /> },
    { dataIndex: "confidence", title: t("dataCatalog.taskManagement.columns.confidence"), width: 100, render: (value: number) => `${Math.round(value * 100)}%` },
    { dataIndex: "finishTime", key: "finish_time", title: t("dataCatalog.task.finishedAt"), width: 180, sorter: true, sortOrder: sortOrderOf("finish_time"), render: formatTime },
    { dataIndex: "createTime", key: "create_time", title: t("dataCatalog.task.createTime"), width: 180, sorter: true, sortOrder: sortOrderOf("create_time"), render: formatTime },
    {
      align: "center" as const, key: "actions", title: t("common.actions"), width: 84, fixed: "right" as const,
      render: (_: unknown, task: SemanticUnderstandingTaskSummary) => {
        const menuItems: NonNullable<MenuProps["items"]> = [{ key: "detail", label: t("common.detail") }];
        if (canManageTasks && task.status !== "pending" && task.status !== "running") {
          menuItems.push({ danger: true, key: "delete", label: t("common.delete") });
        }
        return <Dropdown menu={{
          items: menuItems, onClick: ({ key, domEvent }) => {
            domEvent.stopPropagation();
            if (key === "detail") setDetailTaskId(task.id);
            if (key === "delete") void modal.confirm({
              title: t("dataCatalog.taskManagement.semantic.deleteTitle"), content: t("dataCatalog.taskManagement.semantic.deleteDescription", { id: task.id }), okButtonProps: { danger: true },
              onOk: async () => { await deleteSemanticUnderstandingTask(task.id); message.success(t("common.success")); await load(); },
            });
          }
        }} trigger={["click"]}><AppButton aria-label={t("dataConnect.moreActions")} icon={<EllipsisOutlined />} type="link" /></Dropdown>;
      },
    },
  ];

  return <div className={styles.root}>
    <section className={styles.summaryCard}>
      <div className={styles.summaryContent}>
        <span className={styles.summaryLabel}>{t("dataCatalog.semanticWorkspace.summary")}</span>
        <strong className={`${styles.summaryValue} ${summaryPresentation.className}`}>
          {summaryPresentation.label}
        </strong>
      </div>
      <Space>
        <PermissionGate permissions="catalog:task_manage">
          {/*
            语义理解任务是专业档能力,拦在页面层(ResourceWorkspaceScene 的 RequireEdition):
            能走到这颗按钮,说明那一层已经放行。这里只标不挡——再挡一道,上面解开了这里
            还锁着,客户没有任何办法发起任务。徽标留着,因为档位够不够与镜像换没换是两件
            事,标记该跟着能力走。
          */}
          <AppButton icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)}>
            {t("dataCatalog.semanticWorkspace.create")}
            <EditionBadge capability={CAPABILITIES.SEMANTIC_TASK} edition="professional" />
          </AppButton>
        </PermissionGate>
        <AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton>
        <PermissionGate permissions="catalog:task_manage">
          <AppButton danger disabled={batchDeleteTargets.length === 0} icon={<DeleteOutlined />} onClick={handleBatchDelete}>
            {batchDeleteTargets.length > 0 ? `${t("dataCatalog.task.batchDelete")} (${batchDeleteTargets.length})` : t("dataCatalog.task.batchDelete")}
          </AppButton>
        </PermissionGate>
      </Space>
    </section>
    {error ? <Alert message={error} showIcon type="error" /> : <TableSurface>
      {!loading && filteredTasks.length === 0 ? <EmptyStatePanel description={t("dataCatalog.semanticWorkspace.empty")} title={t("dataCatalog.semanticWorkspace.empty")} /> : <AppTable columns={columns} dataSource={pagedTasks} loading={loading} onChange={handleTableChange} pagination={false} rowKey="id" rowSelection={canManageTasks ? { selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys.map(String)), getCheckboxProps: (task) => ({ disabled: task.status === "pending" || task.status === "running" }) } : undefined} />}
    </TableSurface>}
    {filteredTasks.length > 0 ? <TablePaginationBar current={page} onChange={(nextPage, nextPageSize) => { setPage(nextPageSize === pageSize ? nextPage : 1); setPageSize(nextPageSize); }} pageSize={pageSize} showSizeChanger showTotal={(count) => t("common.total", { total: count })} total={filteredTasks.length} /> : null}
    <Modal cancelText={t("common.cancel")} confirmLoading={creating} okText={t("dataCatalog.semanticWorkspace.start")} onCancel={() => setOpen(false)} onOk={() => void start()} open={open} title={t("dataCatalog.semanticWorkspace.createTitle")}>
      <Form form={form} layout="vertical">
        <Form.Item label={t("dataCatalog.taskManagement.columns.applyMode")} name="applyMode" rules={[{ required: true }]}>
          <Select options={["dry_run", "fill_empty", "force"].map((value) => ({ value, label: t(`dataCatalog.taskManagement.applyMode.${value === "dry_run" ? "dryRun" : value === "fill_empty" ? "fillEmpty" : "force"}`) }))} />
        </Form.Item>
        <Form.Item label={t("dataCatalog.semanticWorkspace.confidenceThreshold")} name="confidenceThreshold" rules={[{ required: true }]}>
          <InputNumber max={1} min={0} precision={2} style={{ width: "100%" }} step={0.05} />
        </Form.Item>
        <Form.Item extra={t("dataCatalog.semanticWorkspace.includeSamplesHint")} name="includeSampleRows" valuePropName="checked">
          <Checkbox>{t("dataCatalog.semanticWorkspace.includeSamples")}</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
    {detailTaskId ? <SemanticUnderstandingTaskDetailDrawer onClose={() => setDetailTaskId(null)} open taskId={detailTaskId} /> : null}
  </div>;
}

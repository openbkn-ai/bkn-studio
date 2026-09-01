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
import { Alert, Checkbox, Dropdown, Form, InputNumber, Modal, Select, Space, Tag, type MenuProps } from "antd";
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
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { SemanticUnderstandingTaskDetailDrawer } from "@/modules/data-catalog/components/SemanticUnderstandingTaskDetailDrawer";
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

  const batchDeleteTargets = tasks.filter(
    (task) =>
      selectedKeys.includes(task.id) &&
      task.status !== "pending" &&
      task.status !== "running",
  );

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

  const columns = [
    { dataIndex: "id", title: t("dataCatalog.taskManagement.columns.task"), ellipsis: true },
    { dataIndex: "applyMode", title: t("dataCatalog.taskManagement.columns.applyMode"), render: (value: string) => t(`dataCatalog.taskManagement.applyMode.${value === "dry_run" ? "dryRun" : value === "fill_empty" ? "fillEmpty" : "force"}`) },
    { dataIndex: "status", title: t("common.status"), render: (value: string) => <Tag color={value === "failed" ? "error" : value === "completed" ? "success" : value === "cancelled" || value === "pending" ? "default" : "processing"}>{t(`dataCatalog.taskManagement.semanticStatus.${value}`)}</Tag> },
    { dataIndex: "applied", title: t("dataCatalog.taskManagement.columns.applied"), render: (value: boolean) => <Tag color={value ? "success" : "default"}>{t(value ? "dataCatalog.taskManagement.applied.applied" : "dataCatalog.taskManagement.applied.notApplied")}</Tag> },
    { dataIndex: "confidence", title: t("dataCatalog.taskManagement.columns.confidence"), render: (value: number) => `${Math.round(value * 100)}%` },
    { dataIndex: "createTime", title: t("dataCatalog.task.createTime"), render: formatTime },
    { dataIndex: "finishTime", title: t("dataCatalog.task.finishedAt"), render: formatTime },
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
        <AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton>
        <PermissionGate permissions="catalog:task_manage">
          <AppButton danger disabled={batchDeleteTargets.length === 0} icon={<DeleteOutlined />} onClick={handleBatchDelete}>
            {batchDeleteTargets.length > 0 ? `${t("dataCatalog.task.batchDelete")} (${batchDeleteTargets.length})` : t("dataCatalog.task.batchDelete")}
          </AppButton>
        </PermissionGate>
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
      </Space>
    </section>
    {error ? <Alert message={error} showIcon type="error" /> : <TableSurface>
      {!loading && tasks.length === 0 ? <EmptyStatePanel description={t("dataCatalog.semanticWorkspace.empty")} title={t("dataCatalog.semanticWorkspace.empty")} /> : <AppTable columns={columns} dataSource={tasks} loading={loading} pagination={false} rowKey="id" rowSelection={{ selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys.map(String)) }} />}
    </TableSurface>}
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

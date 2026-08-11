/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Checkbox, Form, InputNumber, Modal, Select, Space, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
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

function formatTime(value: number) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium", hour12: false }).format(value < 100_000_000_000 ? value * 1000 : value);
}

export function ResourceSemanticUnderstandingPanel({ active, resource }: { active: boolean; resource: CatalogResource }) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [form] = Form.useForm<CreateSemanticUnderstandingTaskPayload>();
  const [tasks, setTasks] = useState<SemanticUnderstandingTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

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
    if (!active || !tasks.some((task) => task.status === "pending" || task.status === "running")) return;
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [active, load, tasks]);

  const summary = useMemo(() => tasks.find((task) => task.status === "succeeded" && task.applied) ?? tasks[0], [tasks]);

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

  const columns = [
    { dataIndex: "id", title: t("dataCatalog.taskManagement.columns.task"), ellipsis: true },
    { dataIndex: "status", title: t("common.status"), render: (value: string) => <Tag color={value === "failed" ? "error" : value === "succeeded" ? "success" : "processing"}>{t(`dataCatalog.taskManagement.semanticStatus.${value}`)}</Tag> },
    { dataIndex: "applyMode", title: t("dataCatalog.taskManagement.columns.applyMode"), render: (value: string) => t(`dataCatalog.taskManagement.applyMode.${value === "dry_run" ? "dryRun" : value === "fill_empty" ? "fillEmpty" : "force"}`) },
    { dataIndex: "confidence", title: t("dataCatalog.taskManagement.columns.confidence"), render: (value: number) => `${Math.round(value * 100)}%` },
    { dataIndex: "applied", title: t("dataCatalog.taskManagement.columns.applied"), render: (value: boolean) => <Tag color={value ? "success" : "default"}>{t(value ? "dataCatalog.taskManagement.applied.applied" : "dataCatalog.taskManagement.applied.notApplied")}</Tag> },
    { dataIndex: "createTime", title: t("dataCatalog.task.createTime"), render: formatTime },
    {
      key: "actions", title: t("common.actions"), width: 160, fixed: "right" as const,
      render: (_: unknown, task: SemanticUnderstandingTaskSummary) => <Space className={styles.actionGroup} size={4}>
        <AppButton type="link" onClick={() => setDetailTaskId(task.id)}>{t("common.detail")}</AppButton>
        <PermissionGate permissions="resource:task_manage">
          <AppButton danger disabled={task.status === "pending" || task.status === "running"} type="link" onClick={() => void modal.confirm({
            title: t("dataCatalog.taskManagement.semantic.deleteTitle"),
            content: t("dataCatalog.taskManagement.semantic.deleteDescription", { id: task.id }),
            okButtonProps: { danger: true },
            onOk: async () => { await deleteSemanticUnderstandingTask(task.id); message.success(t("common.success")); await load(); },
          })}>{t("common.delete")}</AppButton>
        </PermissionGate>
      </Space>,
    },
  ];

  return <div className={styles.root}>
    <section className={styles.summaryCard}>
      <div className={styles.summaryContent}>
        <span className={styles.summaryLabel}>{t("dataCatalog.semanticWorkspace.summary")}</span>
        <strong>{summary?.status === "succeeded" && summary.applied ? t("dataCatalog.semanticWorkspace.applied") : summary?.status === "pending" || summary?.status === "running" ? t("dataCatalog.semanticWorkspace.processing") : t("dataCatalog.semanticWorkspace.notApplied")}</strong>
      </div>
      <Space>
        <AppButton icon={<ReloadOutlined />} onClick={() => void load()}>{t("common.refresh")}</AppButton>
        <PermissionGate permissions="resource:task_manage">
          {/*
            语义理解任务是专业档能力,拦在页面层(ResourceWorkspaceScene 的 RequireEdition):
            能走到这颗按钮,说明那一层已经放行。这里只标不挡——再挡一道,上面解开了这里
            还锁着,客户没有任何办法发起任务。徽标留着,因为档位够不够与镜像换没换是两件
            事,标记该跟着能力走。
          */}
          <AppButton icon={<PlusOutlined />} type="primary" onClick={() => {
            form.setFieldsValue({
              applyMode: "fill_empty",
              confidenceThreshold: 0.75,
              includeSampleRows: false,
            });
            setOpen(true);
          }}>
            {t("dataCatalog.semanticWorkspace.create")}
            <EditionBadge capability={CAPABILITIES.SEMANTIC_TASK} edition="professional" />
          </AppButton>
        </PermissionGate>
      </Space>
    </section>
    {error ? <Alert message={error} showIcon type="error" /> : <TableSurface>
      {!loading && tasks.length === 0 ? <EmptyStatePanel description={t("dataCatalog.semanticWorkspace.empty")} title={t("dataCatalog.semanticWorkspace.empty")} /> : <AppTable columns={columns} dataSource={tasks} loading={loading} pagination={false} rowKey="id" />}
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

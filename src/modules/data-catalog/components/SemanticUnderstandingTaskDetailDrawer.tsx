/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Alert, Descriptions, Drawer, Empty } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getSemanticUnderstandingTask, type SemanticUnderstandingTask } from "@/modules/data-catalog/services/semantic-understanding-task.service";
import { extractRequestErrorMessage } from "@/framework/request/error-message";

import styles from "./BuildTaskDetailDrawer.module.css";
import sharedStyles from "./shared.module.css";

type Props = {
  onClose: () => void;
  open: boolean;
  taskId: string;
};

function formatTime(value?: number) {
  if (!value) return "-";
  const timestamp = value < 100_000_000_000 ? value * 1000 : value;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium", hour12: false }).format(timestamp);
}

function jsonDetail(value?: string) {
  if (!value) return "-";
  let content = value;
  try {
    content = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    // 服务端兼容返回非 JSON 的历史数据。
  }
  return <details className={styles.rawDetail}><summary>JSON</summary><pre>{content}</pre></details>;
}

export function SemanticUnderstandingTaskDetailDrawer({ onClose, open, taskId }: Props) {
  const { t } = useTranslation();
  const [task, setTask] = useState<SemanticUnderstandingTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      setTask(null);
      try {
        const nextTask = await getSemanticUnderstandingTask(taskId);
        if (active) setTask(nextTask);
      } catch (error) {
        if (active) setLoadError(extractRequestErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, taskId]);

  if (!task) return <Drawer className={styles.drawer} destroyOnClose loading={loading} onClose={onClose} open={open} styles={{ body: { padding: 16 }, header: { padding: "12px 16px" } }} title={`${t("dataCatalog.task.detail")} · ${taskId}`} width={640}>{!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}{!loading && !loadError ? <Empty description={t("common.notFound")} /> : null}</Drawer>;
  const applyModeKey = task.applyMode === "dry_run" ? "dryRun" : task.applyMode === "force" ? "force" : "fillEmpty";
  const statusClass = task.status === "failed" ? sharedStyles.taskFailed : task.status === "succeeded" ? sharedStyles.taskSucceeded : sharedStyles.taskRunning;
  const creator = task.creator ? task.creator.name || task.creator.id : "-";

  return <Drawer className={styles.drawer} destroyOnClose onClose={onClose} open={open} styles={{ body: { padding: 16 }, header: { padding: "12px 16px" } }} title={`${t("dataCatalog.task.detail")} · ${task.id}`} width={640}>
    <div className={styles.drawerContent}>
      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>{t("common.status")}</h3>
        <div className={styles.statusRow}><span className={[sharedStyles.tag, statusClass].join(" ")}>{t(`dataCatalog.taskManagement.semanticStatus.${task.status}`)}</span></div>
        {task.failureDetail ? <div className={sharedStyles.calloutWarn}><ExclamationCircleOutlined /><span className={styles.failureContent}><b>{t("dataCatalog.taskManagement.details.failureReason")}</b><span>{task.failureDetail}</span></span></div> : null}
      </section>
      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>{t("dataCatalog.taskManagement.semantic.detailSections.task")}</h3>
        <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
          <Descriptions.Item label={t("dataCatalog.taskManagement.columns.scope")}>{t(`dataCatalog.taskManagement.scope.${task.scope}`)}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.resource.catalog")}>{task.catalogName || task.catalogId || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.catalogId")}>{task.catalogId || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.build.resource")}>{task.resourceName || task.resourceId || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.resourceId")}>{task.resourceId || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.details.agentId")}>{task.agentId || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.agentTaskId")}>{task.agentTaskId || "-"}</Descriptions.Item>
        </Descriptions>
      </section>
      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>{t("dataCatalog.taskManagement.semantic.detailSections.execution")}</h3>
        <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
          <Descriptions.Item label={t("dataCatalog.taskManagement.columns.applyMode")}>{t(`dataCatalog.taskManagement.applyMode.${applyModeKey}`)}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.confidenceThreshold")}>{`${Math.round(task.confidenceThreshold * 100)}%`}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.columns.confidence")}>{`${Math.round(task.confidence * 100)}%`}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.confidenceDetail")}>{jsonDetail(task.confidenceDetailJson)}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.columns.applied")}>{t(task.applied ? "dataCatalog.taskManagement.applied.applied" : "dataCatalog.taskManagement.applied.notApplied")}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.appliedTime")}>{formatTime(task.appliedTime)}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.applyDetail")}>{jsonDetail(task.applyDetailJson)}</Descriptions.Item>
        </Descriptions>
      </section>
      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>{t("dataCatalog.taskManagement.semantic.detailSections.payload")}</h3>
        <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.inputHash")}>{task.inputHash || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.input")}>{jsonDetail(task.input)}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.result")}>{jsonDetail(task.resultJson)}</Descriptions.Item>
        </Descriptions>
      </section>
      <section className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>{t("dataCatalog.taskManagement.semantic.detailSections.audit")}</h3>
        <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
          <Descriptions.Item label={t("dataCatalog.task.fields.creator")}>{creator}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.task.createTime")}>{formatTime(task.createTime)}</Descriptions.Item>
          <Descriptions.Item label={t("dataCatalog.task.fields.updateTime")}>{formatTime(task.updateTime)}</Descriptions.Item>
        </Descriptions>
      </section>
    </div>
  </Drawer>;
}

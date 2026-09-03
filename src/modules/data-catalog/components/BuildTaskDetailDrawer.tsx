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

import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { summarizeBuildTaskError } from "@/modules/data-catalog/lib/build-task-error";
import { formatCount, formatTaskDateTime } from "@/modules/data-catalog/lib/format";
import { buildTaskStatusLabelKey } from "@/modules/data-catalog/services/build-task.service";
import { getBuildTask } from "@/modules/data-catalog/services/build-task.service";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import styles from "./BuildTaskDetailDrawer.module.css";
import sharedStyles from "./shared.module.css";

const EMPTY_VALUE = "-";

type BuildTaskDetailDrawerProps = {
  onClose: () => void;
  open: boolean;
  resource: CatalogResource | null;
  taskId: string;
};

function renderFieldList(fields: string[]) {
  if (fields.length === 0) {
    return EMPTY_VALUE;
  }
  return (
    <span className={sharedStyles.chipRow}>
      {fields.map((field) => (
        <span className={sharedStyles.slugChip} key={field}>
          {field}
        </span>
      ))}
    </span>
  );
}

function renderFieldTags(fields: string[]) {
  if (fields.length === 0) {
    return EMPTY_VALUE;
  }
  return (
    <span className={sharedStyles.chipRow}>
      {fields.map((field) => (
        <span className={sharedStyles.slugChip} key={field}>
          {field}
        </span>
      ))}
    </span>
  );
}

function renderFulltextAnalyzers(analyzers: Record<string, string>) {
  const entries = Object.entries(analyzers);
  if (entries.length === 0) {
    return EMPTY_VALUE;
  }
  return (
    <span className={sharedStyles.chipRow}>
      {entries.map(([field, analyzer]) => (
        <span className={sharedStyles.slugChip} key={field}>
          {field}: {analyzer || EMPTY_VALUE}
        </span>
      ))}
    </span>
  );
}

function renderEmbeddingConfigs(task: BuildTask) {
  const entries = Object.entries(task.embeddingConfigs ?? {});
  if (entries.length === 0) {
    return EMPTY_VALUE;
  }
  return (
    <span className={sharedStyles.chipRow}>
      {entries.map(([field, config]) => (
        <span className={sharedStyles.slugChip} key={field}>
          {field}: {config.modelId || EMPTY_VALUE}
          {config.modelName ? ` (${config.modelName})` : ""}
          {config.dimensions > 0 ? ` · ${config.dimensions}d` : ""}
        </span>
      ))}
    </span>
  );
}

function formatSyncedMarkValue(value: unknown) {
  if (typeof value === "string") {
    return value || EMPTY_VALUE;
  }
  if (value === null) {
    return EMPTY_VALUE;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "symbol") {
    return value.description ?? "symbol";
  }
  return EMPTY_VALUE;
}

function renderSyncedMark(mark?: string) {
  if (!mark?.trim()) {
    return EMPTY_VALUE;
  }

  try {
    const parsed: unknown = JSON.parse(mark);
    if (Array.isArray(parsed)) {
      const entries = parsed.flatMap((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return [];
        }
        const { key, value } = item as { key?: unknown; value?: unknown };
        return typeof key === "string" ? [[`${key}:${index}`, key, value] as const] : [];
      });
      if (entries.length > 0) {
        return (
          <span className={sharedStyles.chipRow}>
            {entries.map(([entryKey, key, value]) => (
              <span className={sharedStyles.slugChip} key={entryKey}>
                {key}: {formatSyncedMarkValue(value)}
              </span>
            ))}
          </span>
        );
      }
    } else if (parsed && typeof parsed === "object") {
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        return (
          <span className={sharedStyles.chipRow}>
            {entries.map(([key, value]) => (
              <span className={sharedStyles.slugChip} key={key}>
                {key}: {formatSyncedMarkValue(value)}
              </span>
            ))}
          </span>
        );
      }
    }
  } catch {
    // Support legacy task checkpoints that are not JSON.
  }

  return <span className={sharedStyles.slugChip}>{mark}</span>;
}

export function BuildTaskDetailDrawer({
  onClose,
  open,
  resource,
  taskId,
}: BuildTaskDetailDrawerProps) {
  const { i18n, t } = useTranslation();
  const [task, setTask] = useState<BuildTask | null>(null);
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
        const nextTask = await getBuildTask(taskId);
        if (active) setTask(nextTask);
      } catch (error) {
        if (active) setLoadError(extractRequestErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, taskId]);

  if (!task) {
    return <Drawer className={styles.drawer} destroyOnClose loading={loading} onClose={onClose} open={open} styles={{ body: { padding: 16 }, header: { padding: "12px 16px" } }} title={`${t("dataCatalog.task.buildDetail")} · ${taskId}`} width={560}>{!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}{!loading && !loadError ? <Empty description={t("common.notFound")} /> : null}</Drawer>;
  }

  const statusLabel = t(`dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status)}`);
  const executeTypeLabel =
    task.mode === "batch"
      ? task.executeType === "incremental"
        ? t("dataCatalog.build.executeIncremental")
        : task.executeType === "full"
          ? t("dataCatalog.build.executeFull")
          : null
      : null;
  const failureSummary = summarizeBuildTaskError(task.error, i18n.language);

  return (
    <Drawer
      className={styles.drawer}
      destroyOnClose
      onClose={onClose}
      open={open}
      styles={{
        body: { padding: 16 },
        header: { padding: "12px 16px" },
      }}
      title={`${t("dataCatalog.task.buildDetail")} · ${task.id}`}
      width={560}
    >
      <div className={styles.drawerContent}>
        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.status")}</h3>
          <div className={styles.statusRow}>
            <span
              className={[
                sharedStyles.tag,
                sharedStyles.taskRunning,
              ].join(" ")}
            >
              {t(`dataCatalog.modes.${task.mode}`)}
            </span>
            {executeTypeLabel ? (
              <span
                className={[
                  sharedStyles.tag,
                  sharedStyles.taskRunning,
                ].join(" ")}
              >
                {executeTypeLabel}
              </span>
            ) : null}
            <span
              className={[
                sharedStyles.tag,
                task.status === "failed"
                  ? sharedStyles.taskFailed
                  : task.status === "completed"
                    ? sharedStyles.taskSucceeded
                    : task.status === "running"
                      ? sharedStyles.modeStreaming
                      : task.status === "cancelled"
                        ? sharedStyles.taskPending
                        : sharedStyles.taskRunning,
              ].join(" ")}
            >
              {statusLabel}
            </span>
          </div>

          {failureSummary ? (
            <div className={sharedStyles.calloutWarn} style={{ marginBottom: 12 }}>
              <ExclamationCircleOutlined />
              <span className={styles.failureContent}>
                <b>{failureSummary.title}</b>
                <span>{failureSummary.message}</span>
                {failureSummary.suggestion ? (
                  <span className={styles.failureSuggestion}>
                    {failureSummary.suggestion}
                  </span>
                ) : null}
                <details className={styles.failureRaw}>
                  <summary>{t("dataCatalog.task.rawError")}</summary>
                  <code>{failureSummary.raw}</code>
                </details>
              </span>
            </div>
          ) : null}

          <BuildProgress task={task} />
          {task.mode === "batch" ? (
            <div className={styles.metaLine}>
              {t("dataCatalog.task.fields.totalCount")} {formatCount(task.totalCount)}
            </div>
          ) : null}
        </section>

        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.task")}</h3>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label="ID">{task.id || EMPTY_VALUE}</Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.columns.catalog")}>
              {task.catalogName || task.catalogId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.catalogId")}>
              {task.catalogId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.columns.resource")}>
              {resource?.name || task.resourceName || task.resourceId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.resourceId")}>
              {task.resourceId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.build.mode")}>
              {t(`dataCatalog.modes.${task.mode}`)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.build.executeType")}>
              {executeTypeLabel ?? EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.primaryKeyFields")}>
              {renderFieldTags(task.primaryKeyFields)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.incrementalFields")}>
              {renderFieldTags(task.incrementalFields)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.fulltextFields")}>
              {renderFieldList(task.fulltextFields)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.fulltextAnalyzer")}>
              {renderFulltextAnalyzers(
                task.fulltextAnalyzers ??
                  Object.fromEntries(
                    task.fulltextFields.map((field) => [field, task.fulltextAnalyzer || "standard"]),
                  ),
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.embeddingFields")}>
              {renderFieldList(task.embeddingFields)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.embeddingConfig")}>
              {renderEmbeddingConfigs({
                ...task,
                embeddingConfigs:
                  task.embeddingConfigs ??
                  Object.fromEntries(
                    task.embeddingFields.map((field) => [
                      field,
                      { dimensions: task.modelDimensions, modelId: task.embeddingModel },
                    ]),
                  ),
              })}
            </Descriptions.Item>
          </Descriptions>
        </section>

        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.execution")}</h3>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label={t("dataCatalog.task.fields.syncedMark")}>
              {renderSyncedMark(task.syncedMark)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.startTime")}>
              {formatDateTimeYmdHms(task.startTime)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.lastProgressTime")}>
              {formatDateTimeYmdHms(task.lastProgressTime)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.finishedAt")}>
              {formatDateTimeYmdHms(task.finishTime)}
            </Descriptions.Item>
          </Descriptions>
        </section>

        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.audit")}</h3>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label={t("dataCatalog.task.fields.creator")}>
              {task.creator?.name || task.creator?.id || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataConnect.createTime")}>
              {formatTaskDateTime(task.createTime)}
            </Descriptions.Item>
          </Descriptions>
        </section>
      </div>
    </Drawer>
  );
}

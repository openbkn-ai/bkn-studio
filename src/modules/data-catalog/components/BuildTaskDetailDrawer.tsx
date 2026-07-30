/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Alert, Descriptions, Drawer, Empty } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { BuildStatusTag } from "@/modules/data-catalog/components/BuildStatusTag";
import { formatCount } from "@/modules/data-catalog/lib/format";
import { summarizeBuildTaskError } from "@/modules/data-catalog/lib/build-task-error";
import { buildTaskStatusLabelKey } from "@/modules/data-catalog/services/build-task.service";
import { getBuildTask } from "@/modules/data-catalog/services/build-task.service";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";
import type { SmallModel } from "@/modules/model-resources/types/small-model";

import styles from "./BuildTaskDetailDrawer.module.css";
import sharedStyles from "./shared.module.css";

type BuildTaskDetailDrawerProps = {
  onClose: () => void;
  open: boolean;
  resource: CatalogResource | null;
  taskId: string;
};

function renderFieldList(fields: string[]) {
  if (fields.length === 0) {
    return "—";
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
    return "—";
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
    return "—";
  }
  return (
    <span className={sharedStyles.chipRow}>
      {entries.map(([field, analyzer]) => (
        <span className={sharedStyles.slugChip} key={field}>
          {field}: {analyzer}
        </span>
      ))}
    </span>
  );
}

function renderEmbeddingConfigs(task: BuildTask) {
  const entries = Object.entries(task.embeddingConfigs ?? {});
  if (entries.length === 0) {
    return "—";
  }
  return (
    <span className={styles.fieldList}>
      {entries.map(([field, config]) => (
        <span className={styles.fieldText} key={field}>
          {field}: {config.modelId || "—"}
          {config.dimensions > 0 ? ` · ${config.dimensions}d` : ""}
        </span>
      ))}
    </span>
  );
}

function renderIndexHealth(task: BuildTask, t: (key: string) => string) {
  const health = task.indexHealth;
  if (!health) {
    return "—";
  }
  return (
    <span className={styles.healthList}>
      <span>
        {t("dataCatalog.task.fields.embeddingIndex")}: {t(`dataCatalog.task.health.${health.embedding}`)}
      </span>
      <span>
        {t("dataCatalog.task.fields.fulltextIndex")}: {t(`dataCatalog.task.health.${health.fulltext}`)}
      </span>
      <span>
        {t("dataCatalog.task.fields.indexUsable")}: {t(
          health.usable
            ? "dataCatalog.task.health.usable"
            : "dataCatalog.task.health.unusable",
        )}
      </span>
    </span>
  );
}

function formatSyncedMarkValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value === null) {
    return "null";
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
  return "undefined";
}

function renderSyncedMark(mark?: string) {
  if (!mark) {
    return "—";
  }

  try {
    const parsed: unknown = JSON.parse(mark);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
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
    // 兼容旧任务中非 JSON 格式的断点值。
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
  const [models, setModels] = useState<SmallModel[]>([]);
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

  useEffect(() => {
    if (!open || !task?.embeddingModel) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await listSmallModels({
          modelType: "embedding",
          page: 1,
          size: 200,
        });
        if (active) {
          setModels(result.items);
        }
      } catch {
        // 解析失败保留原始值
      }
    })();
    return () => {
      active = false;
    };
  }, [open, task?.embeddingModel]);

  const modelInfo = useMemo(() => {
    const match = models.find(
      (item) =>
        item.modelId === task?.embeddingModel || item.modelName === task?.embeddingModel,
    );
    return {
      name: match?.modelName || task?.embeddingModel || "",
      dimensions: match?.embeddingDim ?? task?.modelDimensions ?? 0,
    };
  }, [models, task?.embeddingModel, task?.modelDimensions]);

  if (!task) {
    return <Drawer className={styles.drawer} destroyOnClose loading={loading} onClose={onClose} open={open} styles={{ body: { padding: 16 }, header: { padding: "12px 16px" } }} title={`${t("dataCatalog.task.detail")} · ${taskId}`} width={560}>{!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}{!loading && !loadError ? <Empty description={t("common.notFound")} /> : null}</Drawer>;
  }

  const succeededWithWarning = task.status === "succeeded" && Boolean(task.error);
  const statusLabel = succeededWithWarning
    ? t("dataCatalog.task.statuses.succeededWithWarning")
    : t(`dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status, task.mode)}`);
  const failureSummary = summarizeBuildTaskError(
    task.error || task.failureDetail,
    i18n.language,
  );

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
      title={`${t("dataCatalog.task.detail")} · ${task.id}`}
      width={560}
    >
      <div className={styles.drawerContent}>
        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("common.status")}</h3>
          <div className={styles.statusRow}>
            <span
              className={[
                sharedStyles.tag,
                task.mode === "batch" ? sharedStyles.modeBatch : sharedStyles.modeStreaming,
              ].join(" ")}
            >
              {t(`dataCatalog.modes.${task.mode}`)}
            </span>
            {task.embeddingDegraded ? (
              <BuildStatusTag task={task} />
            ) : (
              <span
                className={[
                  sharedStyles.tag,
                  task.status === "failed"
                    ? sharedStyles.taskFailed
                    : task.status === "succeeded"
                      ? sharedStyles.taskSucceeded
                      : task.status === "listening"
                        ? sharedStyles.modeStreaming
                        : sharedStyles.taskRunning,
                ].join(" ")}
              >
                {statusLabel}
              </span>
            )}
          </div>

          {failureSummary ? (
            <div
              className={
                succeededWithWarning ? sharedStyles.calloutNote : sharedStyles.calloutWarn
              }
              style={{ marginBottom: 12 }}
            >
              {succeededWithWarning ? <InfoCircleOutlined /> : <ExclamationCircleOutlined />}
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
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.modalTitle")}</h3>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label={t("dataCatalog.build.resource")}>
              {resource?.name ?? task.resourceName ?? task.resourceId}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.resourceId")}>
              {task.resourceId}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.resource.catalog")}>
              {task.catalogName ?? task.catalogId ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.creator")}>
              {task.creator?.name || task.creator?.id || "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.buildKeyFields")}>
              {renderFieldTags(task.buildKeyFields)}
            </Descriptions.Item>
            {task.executeType ? (
              <Descriptions.Item label={t("dataCatalog.build.executeType")}>
                {task.executeType === "incremental"
                  ? t("dataCatalog.build.executeIncremental")
                  : t("dataCatalog.build.executeFull")}
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label={t("dataCatalog.task.fields.fulltextFields")}>
              {renderFieldList(task.fulltextFields)}
            </Descriptions.Item>
            {task.fulltextFields.length > 0 ? (
              <Descriptions.Item label={t("dataCatalog.task.fields.fulltextAnalyzer")}>
                {renderFulltextAnalyzers(
                  task.fulltextAnalyzers ??
                    Object.fromEntries(
                      task.fulltextFields.map((field) => [field, task.fulltextAnalyzer || "standard"]),
                    ),
                )}
              </Descriptions.Item>
            ) : null}
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
                      { dimensions: modelInfo.dimensions, modelId: modelInfo.name },
                    ]),
                  ),
              })}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.indexHealth")}>
              {renderIndexHealth(task, t)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.syncedMark")}>
              {renderSyncedMark(task.syncedMark)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataConnect.createTime")}>
              {task.createTime}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.updateTime")}>
              {task.updateTime ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.finishedAt")}>
              {task.finishTime ?? "—"}
            </Descriptions.Item>
          </Descriptions>
        </section>
      </div>
    </Drawer>
  );
}

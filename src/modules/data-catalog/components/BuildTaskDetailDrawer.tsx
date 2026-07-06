/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Descriptions, Drawer } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { BuildStatusTag } from "@/modules/data-catalog/components/BuildStatusTag";
import { formatCount } from "@/modules/data-catalog/lib/format";
import { buildTaskStatusLabelKey } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";
import type { SmallModel } from "@/modules/model-resources/types/small-model";

import styles from "./BuildTaskDetailDrawer.module.css";
import sharedStyles from "./shared.module.css";

type BuildTaskDetailDrawerProps = {
  onClose: () => void;
  open: boolean;
  resource: CatalogResource | null;
  task: BuildTask;
};

function renderFieldList(fields: string[]) {
  if (fields.length === 0) {
    return "—";
  }
  return (
    <span className={styles.fieldList}>
      {fields.map((field) => (
        <span className={styles.fieldText} key={field}>
          {field}
        </span>
      ))}
    </span>
  );
}

export function BuildTaskDetailDrawer({
  onClose,
  open,
  resource,
  task,
}: BuildTaskDetailDrawerProps) {
  const { t } = useTranslation();
  const [models, setModels] = useState<SmallModel[]>([]);

  useEffect(() => {
    if (!open || !task.embeddingModel) {
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
  }, [open, task.embeddingModel]);

  const modelInfo = useMemo(() => {
    const match = models.find(
      (item) =>
        item.modelId === task.embeddingModel || item.modelName === task.embeddingModel,
    );
    return {
      name: match?.modelName || task.embeddingModel,
      dimensions: match?.embeddingDim ?? task.modelDimensions,
    };
  }, [models, task.embeddingModel, task.modelDimensions]);

  const succeededWithWarning = task.status === "succeeded" && Boolean(task.error);
  const statusLabel = succeededWithWarning
    ? t("dataCatalog.task.statuses.succeededWithWarning")
    : t(`dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status, task.mode)}`);

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

          {task.error ? (
            <div
              className={
                succeededWithWarning ? sharedStyles.calloutNote : sharedStyles.calloutWarn
              }
              style={{ marginBottom: 12 }}
            >
              {succeededWithWarning ? <InfoCircleOutlined /> : <ExclamationCircleOutlined />}
              <span>{task.error}</span>
            </div>
          ) : null}

          <BuildProgress task={task} />
          {task.mode === "batch" ? (
            <div className={styles.metaLine}>
              total_count {formatCount(task.totalCount)}
            </div>
          ) : null}
        </section>

        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.modalTitle")}</h3>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label={t("dataCatalog.build.resource")}>
              {resource?.name ?? task.resourceId}
            </Descriptions.Item>
            <Descriptions.Item label="resource_id">{task.resourceId}</Descriptions.Item>
            <Descriptions.Item label="embedding_fields">
              {renderFieldList(task.embeddingFields)}
            </Descriptions.Item>
            <Descriptions.Item label="build_key_fields">
              {renderFieldList(task.buildKeyFields)}
            </Descriptions.Item>
            <Descriptions.Item label="fulltext_fields">
              {renderFieldList(task.fulltextFields)}
            </Descriptions.Item>
            {task.fulltextFields.length > 0 ? (
              <Descriptions.Item label="fulltext_analyzer">
                {task.fulltextAnalyzer || "standard"}
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="embedding_model">
              {modelInfo.name || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="model_dimensions">{modelInfo.dimensions}</Descriptions.Item>
            <Descriptions.Item label={t("dataConnect.createTime")}>
              {task.createTime}
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

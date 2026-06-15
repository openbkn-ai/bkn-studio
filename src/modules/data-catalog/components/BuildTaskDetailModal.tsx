import { ExclamationCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { formatCount } from "@/modules/data-catalog/lib/format";
import { buildTaskStatusLabelKey } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";
import type { SmallModel } from "@/modules/model-resources/types/small-model";

import styles from "./shared.module.css";

type BuildTaskDetailModalProps = {
  onClose: () => void;
  open: boolean;
  resource: CatalogResource | null;
  task: BuildTask;
};

export function BuildTaskDetailModal({
  onClose,
  open,
  resource,
  task,
}: BuildTaskDetailModalProps) {
  const { t } = useTranslation();
  const [models, setModels] = useState<SmallModel[]>([]);

  // embedding_model 可能是模型名(studio 建)或数字 model_id(后端建),拉模型表解析成可读名称
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

  // completed 任务可能仍带非致命 error_msg(如 version_conflict 幂等跳过);
  // 此时状态标注“有警告”、提示降级为中性说明,避免“已完成”却显示报错的矛盾
  const succeededWithWarning = task.status === "succeeded" && Boolean(task.error);
  const statusLabel = succeededWithWarning
    ? t("dataCatalog.task.statuses.succeededWithWarning")
    : t(`dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status, task.mode)}`);

  return (
    <Modal
      footer={
        <span style={{ color: "#8b98ac", fontSize: 12 }}>
          GET /vega-backend/v1/build-tasks/{task.id}
        </span>
      }
      onCancel={onClose}
      open={open}
      title={`${t("dataCatalog.task.modalTitle")} · ${task.id}`}
      width={680}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div className={styles.chipRow}>
          <span
            className={[
              styles.tag,
              task.mode === "batch" ? styles.modeBatch : styles.modeStreaming,
            ].join(" ")}
          >
            {t(`dataCatalog.modes.${task.mode}`)}
          </span>
          <span
            className={[
              styles.tag,
              task.status === "failed"
                ? styles.taskFailed
                : task.status === "succeeded"
                  ? styles.taskSucceeded
                  : task.status === "listening"
                    ? styles.modeStreaming
                    : styles.taskRunning,
            ].join(" ")}
          >
            {statusLabel}
          </span>
        </div>

        {task.error ? (
          <div
            className={succeededWithWarning ? styles.calloutNote : styles.calloutWarn}
            style={{ marginBottom: 0 }}
          >
            {succeededWithWarning ? (
              <InfoCircleOutlined />
            ) : (
              <ExclamationCircleOutlined />
            )}
            <span>{task.error}</span>
          </div>
        ) : null}

        <BuildProgress task={task} />
        {task.mode === "batch" ? (
          <div className={styles.scanItemMeta}>
            total_count {formatCount(task.totalCount)}
          </div>
        ) : null}

        <div className={styles.descGrid}>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>{t("dataCatalog.build.resource")}</span>
            <span className={styles.descValue}>{resource?.name ?? task.resourceId}</span>
          </div>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>resource_id</span>
            <span className={styles.slugChip}>{task.resourceId}</span>
          </div>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>embedding_fields</span>
            <span className={styles.chipRow}>
              {task.embeddingFields.map((field) => (
                <span className={styles.fieldChip} key={field}>
                  {field}
                </span>
              ))}
            </span>
          </div>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>build_key_fields</span>
            <span className={styles.chipRow}>
              {task.buildKeyFields.length > 0
                ? task.buildKeyFields.map((field) => (
                    <span className={styles.fieldChip} key={field}>
                      {field}
                    </span>
                  ))
                : "—"}
            </span>
          </div>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>fulltext_fields</span>
            <span className={styles.chipRow}>
              {task.fulltextFields.length > 0
                ? task.fulltextFields.map((field) => (
                    <span className={styles.fieldChip} key={field}>
                      {field}
                    </span>
                  ))
                : "—"}
            </span>
          </div>
          {task.fulltextFields.length > 0 ? (
            <div className={styles.descItem}>
              <span className={styles.descLabel}>fulltext_analyzer</span>
              <span className={styles.descValue}>{task.fulltextAnalyzer || "standard"}</span>
            </div>
          ) : null}
          <div className={styles.descItem}>
            <span className={styles.descLabel}>embedding_model</span>
            <span className={styles.descValue}>{modelInfo.name || "—"}</span>
          </div>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>model_dimensions</span>
            <span className={styles.descValue}>{modelInfo.dimensions}</span>
          </div>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>{t("dataConnect.createTime")}</span>
            <span className={styles.descValue}>{task.createTime}</span>
          </div>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>{t("dataCatalog.task.finishedAt")}</span>
            <span className={styles.descValue}>{task.finishTime ?? "—"}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

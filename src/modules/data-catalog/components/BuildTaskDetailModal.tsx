import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { formatCount } from "@/modules/data-catalog/lib/format";
import { buildTaskStatusLabelKey } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";

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
            {t(
              `dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status, task.mode)}`,
            )}
          </span>
        </div>

        {task.error ? (
          <div className={styles.calloutWarn} style={{ marginBottom: 0 }}>
            <ExclamationCircleOutlined />
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
            <span className={styles.descValue}>{task.embeddingModel || "—"}</span>
          </div>
          <div className={styles.descItem}>
            <span className={styles.descLabel}>model_dimensions</span>
            <span className={styles.descValue}>{task.modelDimensions}</span>
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

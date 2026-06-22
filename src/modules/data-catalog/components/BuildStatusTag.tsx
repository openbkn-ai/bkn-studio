import { WarningOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { buildTaskStatusLabelKey } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

import styles from "./shared.module.css";

type BuildStatusTagProps = {
  task: BuildTask;
};

/**
 * 构建任务状态标。已完成但向量化没建满时，用琥珀色「已完成·向量化失败/部分失败」
 * 替代绿色「已完成」，并在 tooltip 里展开 failureDetail。
 */
export function BuildStatusTag({ task }: BuildStatusTagProps) {
  const { t } = useTranslation();

  if (task.embeddingDegraded) {
    const labelKey =
      task.vectorizedCount === 0
        ? "dataCatalog.task.statuses.embeddingFailed"
        : "dataCatalog.task.statuses.embeddingPartial";
    return (
      <Tooltip title={task.failureDetail || t("dataCatalog.task.embeddingDegradedHint")}>
        <span className={[styles.tag, styles.taskDegraded].join(" ")}>
          <WarningOutlined />
          {t(labelKey)}
        </span>
      </Tooltip>
    );
  }

  const statusClass =
    task.status === "failed"
      ? styles.taskFailed
      : task.status === "succeeded"
        ? styles.taskSucceeded
        : task.status === "listening"
          ? styles.modeStreaming
          : task.status === "running"
            ? styles.taskRunning
            : styles.taskPending;

  return (
    <span className={[styles.tag, statusClass].join(" ")}>
      {t(`dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status, task.mode)}`)}
    </span>
  );
}

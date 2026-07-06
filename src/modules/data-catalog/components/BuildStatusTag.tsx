/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { WarningOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import {
  buildTaskStatusLabelKey,
  embeddingStateOf,
} from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

import styles from "./shared.module.css";

type BuildStatusTagProps = {
  plain?: boolean;
  task: BuildTask;
};

/**
 * 构建任务状态标。已完成但向量化没建满时，用琥珀色「已完成·向量化失败/部分失败」
 * 替代绿色「已完成」，并在 tooltip 里展开 failureDetail。
 */
export function BuildStatusTag({ plain = false, task }: BuildStatusTagProps) {
  const { t } = useTranslation();

  const renderPlain = (label: string, tooltip?: string) => {
    const content = <span className={styles.plainText}>{label}</span>;
    if (!tooltip) {
      return content;
    }
    return <Tooltip title={tooltip}>{content}</Tooltip>;
  };

  // 已完成但向量化失败/部分失败:红/橙告警标 + tooltip 展开 failure_detail。
  const embeddingState = embeddingStateOf(task);
  if (embeddingState === "failed" || embeddingState === "partial") {
    const failed = embeddingState === "failed";
    const label = t(
      failed
        ? "dataCatalog.task.statuses.embeddingFailed"
        : "dataCatalog.task.statuses.embeddingPartial",
    );
    const tooltip = task.failureDetail || t("dataCatalog.task.embeddingDegradedHint");
    if (plain) {
      return renderPlain(label, tooltip);
    }
    return (
      <Tooltip title={tooltip}>
        <span
          className={[styles.tag, failed ? styles.taskFailed : styles.taskDegraded].join(" ")}
        >
          <WarningOutlined />
          {label}
        </span>
      </Tooltip>
    );
  }

  const label = t(`dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status, task.mode)}`);

  if (plain) {
    return renderPlain(label);
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
      {label}
    </span>
  );
}

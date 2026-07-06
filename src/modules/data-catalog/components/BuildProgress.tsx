/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { WarningOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { formatCount, timeAgo } from "@/modules/data-catalog/lib/format";
import { embeddingStateOf } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

import styles from "./shared.module.css";

type BuildProgressProps = {
  compact?: boolean;
  task: BuildTask;
};

function renderVectorMeta(
  task: BuildTask,
  embeddingState: ReturnType<typeof embeddingStateOf>,
  vectorPercent: number,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (task.embeddingFields.length === 0) {
    return (
      <span className={styles.progressMuted}>{t("dataCatalog.progress.noVectorize")}</span>
    );
  }
  if (embeddingState === "failed" || embeddingState === "partial") {
    return (
      <Tooltip title={task.failureDetail || undefined}>
        <span className={styles.progressWarn}>
          <WarningOutlined />
          {embeddingState === "failed"
            ? t("dataCatalog.progress.vectorizeFailed")
            : t("dataCatalog.progress.vectorizePartial", {
                percent: Math.round(vectorPercent) as never,
              })}
        </span>
      </Tooltip>
    );
  }
  return (
    <span>
      {t("dataCatalog.progress.vectorized", {
        percent: Math.round(vectorPercent) as never,
      })}
    </span>
  );
}

function vectorSummary(
  task: BuildTask,
  embeddingState: ReturnType<typeof embeddingStateOf>,
  vectorPercent: number,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (task.embeddingFields.length === 0) {
    return t("dataCatalog.progress.noVectorize");
  }
  if (embeddingState === "failed") {
    return t("dataCatalog.progress.vectorizeFailed");
  }
  if (embeddingState === "partial") {
    return t("dataCatalog.progress.vectorizePartial", {
      percent: Math.round(vectorPercent) as never,
    });
  }
  return t("dataCatalog.progress.vectorized", {
    percent: Math.round(vectorPercent) as never,
  });
}

/**
 * batch:双层进度条(浅色=已同步,深色=已向量化,SDK 返回真实计数,百分比诚实)。
 * streaming:常驻监听没有分母,只显示已同步行数 + 最近事件时间。
 */
export function BuildProgress({ compact = false, task }: BuildProgressProps) {
  const { i18n, t } = useTranslation();
  const embeddingState = embeddingStateOf(task);
  const wrapClass = compact ? styles.progressWrapCompact : styles.progressWrap;
  const metaClass = compact ? styles.progressMetaCompact : styles.progressMeta;

  if (task.mode === "streaming") {
    const syncedLabel = t("dataCatalog.progress.syncedRows", {
      count: formatCount(task.syncedCount) as never,
    });
    const eventLabel =
      task.status === "paused"
        ? t("dataCatalog.indexState.paused")
        : t("dataCatalog.progress.lastEvent", {
            time: timeAgo(task.lastEventAt ?? task.createdAt, i18n.language),
          });
    const content = (
      <div className={wrapClass}>
        <div className={metaClass}>
          <span>{syncedLabel}</span>
          <span>{eventLabel}</span>
        </div>
      </div>
    );

    if (!compact) {
      return content;
    }

    return (
      <Tooltip title={`${syncedLabel} · ${eventLabel}`}>
        <div className={styles.progressTooltipTrigger}>{content}</div>
      </Tooltip>
    );
  }

  // 后端 total_count 可能只是首批行数(连接器未做 COUNT(*)),
  // 用 max(total, synced) 兜底,避免向量化百分比虚高
  const total = Math.max(1, task.totalCount, task.syncedCount);
  const syncedPercent = Math.min(100, (task.syncedCount / total) * 100);
  const vectorPercent = Math.min(100, (task.vectorizedCount / total) * 100);
  const fillClass =
    task.status === "succeeded"
      ? styles.progressFillDone
      : task.status === "failed"
        ? styles.progressFillFailed
        : styles.progressFillVector;

  const syncedLabel = t("dataCatalog.progress.synced", {
    synced: formatCount(task.syncedCount) as never,
    total: formatCount(task.totalCount) as never,
  });
  const vectorLabel = vectorSummary(task, embeddingState, vectorPercent, t);
  const vectorMeta = renderVectorMeta(task, embeddingState, vectorPercent, t);

  const content = (
    <div className={wrapClass}>
      <div className={styles.progressTrack}>
        <span className={styles.progressFill} style={{ width: `${syncedPercent}%` }} />
        <span
          className={[styles.progressFill, fillClass].join(" ")}
          style={{ width: `${vectorPercent}%` }}
        />
      </div>
      <div className={metaClass}>
        <span>{syncedLabel}</span>
        {vectorMeta}
      </div>
    </div>
  );

  if (!compact) {
    return content;
  }

  return (
    <Tooltip title={`${syncedLabel} · ${vectorLabel}`}>
      <div className={styles.progressTooltipTrigger}>{content}</div>
    </Tooltip>
  );
}

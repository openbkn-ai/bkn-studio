/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { formatCount, timeAgo } from "@/modules/data-catalog/lib/format";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

import styles from "./shared.module.css";

type BuildProgressProps = {
  compact?: boolean;
  task: BuildTask;
};

/** Batch progress follows document synchronization; vector enrichment is part of that same operation. */
export function BuildProgress({ compact = false, task }: BuildProgressProps) {
  const { i18n, t } = useTranslation();
  const wrapClass = compact ? styles.progressWrapCompact : styles.progressWrap;
  const metaClass = compact ? styles.progressMetaCompact : styles.progressMeta;

  if (task.mode === "streaming") {
    const syncedLabel = t("dataCatalog.progress.syncedRows", {
      count: formatCount(task.syncedCount) as never,
    });
    const eventLabel =
      task.status === "stopped"
        ? t("dataCatalog.indexState.paused")
        : t("dataCatalog.progress.lastEvent", {
          time: timeAgo(task.lastProgressTime ?? task.createTime, i18n.language),
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

  // Backend total_count may be only the first batch because connectors do not run COUNT(*).
  const total = Math.max(1, task.totalCount, task.syncedCount);
  const isEmptyCompletedTask =
    task.status === "completed" && task.totalCount === 0 && task.syncedCount === 0;
  const syncedPercent = isEmptyCompletedTask
    ? 100
    : Math.min(100, (task.syncedCount / total) * 100);
  const fillClass =
    task.status === "completed"
      ? styles.progressFillDone
      : task.status === "failed"
        ? styles.progressFillFailed
        : task.status === "cancelled" || task.status === "pending" || task.status === "stopped"
          ? styles.progressFillMuted
          : styles.progressFillVector;

  const syncedLabel = t("dataCatalog.progress.synced", {
    synced: formatCount(task.syncedCount) as never,
    total: formatCount(task.totalCount) as never,
  });

  const content = (
    <div className={wrapClass}>
      <div className={styles.progressTrack}>
        <span
          className={[styles.progressFill, fillClass].join(" ")}
          style={{ width: `${syncedPercent}%` }}
        />
      </div>
      <div className={metaClass}>
        <span>{syncedLabel}</span>
      </div>
    </div>
  );

  if (!compact) {
    return content;
  }

  return (
    <Tooltip title={syncedLabel}>
      <div className={styles.progressTooltipTrigger}>{content}</div>
    </Tooltip>
  );
}

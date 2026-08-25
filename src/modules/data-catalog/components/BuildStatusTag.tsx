/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import { buildTaskStatusLabelKey } from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

import styles from "./shared.module.css";

type BuildStatusTagProps = {
  plain?: boolean;
  task: BuildTask;
};

/** Build-task status tag. */
export function BuildStatusTag({ plain = false, task }: BuildStatusTagProps) {
  const { t } = useTranslation();
  const label = t(`dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status)}`);

  if (plain) {
    return <span className={styles.plainText}>{label}</span>;
  }

  const statusClass =
    task.status === "failed"
      ? styles.taskFailed
      : task.status === "completed"
        ? styles.taskSucceeded
        : task.status === "running" || task.status === "stopping"
            ? styles.taskRunning
            : styles.taskPending;

  return (
    <span className={[styles.tag, statusClass].join(" ")}>
      {label}
    </span>
  );
}

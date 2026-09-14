/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import type { SemanticUnderstandingTaskStatus } from "@/modules/data-catalog/services/semantic-understanding-task.service";

import styles from "./shared.module.css";

export function SemanticTaskStatusTag({ status }: { status: SemanticUnderstandingTaskStatus }) {
  const { t } = useTranslation();
  const statusClass =
    status === "completed"
      ? styles.taskSucceeded
      : status === "failed"
        ? styles.taskFailed
        : status === "cancelled" || status === "pending"
          ? styles.taskPending
          : styles.taskRunning;

  return (
    <span className={[styles.tag, statusClass].join(" ")}>
      {t(`dataCatalog.taskManagement.semanticStatus.${status}`)}
    </span>
  );
}

export function SemanticTaskAppliedTag({ applied }: { applied: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={[
        styles.tag,
        applied ? styles.taskSucceeded : styles.taskPending,
      ].join(" ")}
    >
      {t(
        applied
          ? "dataCatalog.taskManagement.applied.applied"
          : "dataCatalog.taskManagement.applied.notApplied",
      )}
    </span>
  );
}

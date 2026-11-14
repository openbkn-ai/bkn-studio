/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag } from "antd";
import { useTranslation } from "react-i18next";

import type { ScheduleLastStatus } from "./types";
import styles from "./ScheduleRunResultView.module.css";

type ScheduleRunResultViewProps = {
  status?: ScheduleLastStatus;
  message?: string;
  kind?: "task" | "health-check";
};

export function ScheduleRunResultView({
  status,
  message,
  kind = "task",
}: ScheduleRunResultViewProps) {
  const { t } = useTranslation();
  const safeStatus =
    status && ["never", "unknown", "triggering", "success", "skipped", "failed"].includes(status)
      ? status
      : "unknown";
  const label =
    safeStatus === "success"
      ? kind === "health-check"
        ? "common.schedule.healthCheckSucceeded"
        : "common.schedule.taskCreated"
      : `common.schedule.status.${safeStatus}`;
  const color =
    safeStatus === "failed"
      ? "error"
      : safeStatus === "success"
        ? "success"
        : safeStatus === "triggering"
          ? "processing"
          : undefined;

  return (
    <div className={styles.result}>
      <Tag color={color}>{t(label)}</Tag>
      {message ? <span className={styles.message}>{message}</span> : null}
    </div>
  );
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ScheduleLastStatus =
  "never" | "unknown" | "triggering" | "success" | "skipped" | "failed";

/** Older servers only expose last_run; an existing trigger never implies success. */
export function normalizeScheduleLastStatus(
  status: unknown,
  lastRun?: number | null,
): ScheduleLastStatus {
  switch (status) {
    case "never":
    case "unknown":
    case "triggering":
    case "success":
    case "skipped":
    case "failed":
      return status;
    default:
      return status ? "unknown" : lastRun ? "unknown" : "never";
  }
}

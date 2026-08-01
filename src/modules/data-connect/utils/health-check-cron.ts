/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The backend requires at least one hour between health checks. For a standard
 * five-field cron, a single numeric minute value guarantees that constraint;
 * multiple selected minutes would create sub-hour executions.
 */
export function isHourlyHealthCheckCron(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const fields = value.trim().split(/\s+/);
  if (fields.length !== 5) {
    return false;
  }

  const minute = fields[0];
  return minute !== undefined && /^(?:[0-9]|[1-5][0-9])$/.test(minute);
}

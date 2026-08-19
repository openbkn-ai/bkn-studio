/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function isValidDiscoverScheduleTimeRange(
  startTime?: number,
  endTime?: number,
): boolean {
  const start = startTime ?? 0;
  const end = endTime ?? 0;
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end >= 0 &&
    (end === 0 || start <= end)
  );
}

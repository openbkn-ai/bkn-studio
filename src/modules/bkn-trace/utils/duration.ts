/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type DurationLabels = {
  hour: string;
  millisecond: string;
  minute: string;
  second: string;
};

export function formatDuration(durationMs: number | undefined, labels: DurationLabels): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) return "-";
  if (durationMs < 1_000) return `${durationMs} ${labels.millisecond}`;
  if (durationMs < 60_000) return `${formatValue(durationMs / 1_000)} ${labels.second}`;
  if (durationMs < 3_600_000) return `${formatValue(durationMs / 60_000)} ${labels.minute}`;
  return `${formatValue(durationMs / 3_600_000)} ${labels.hour}`;
}

function formatValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function formatDuration(durationMs: number): string {
  if (durationMs >= 60_000) {
    const minutes = Math.floor(durationMs / 60_000);
    const seconds = ((durationMs % 60_000) / 1000).toFixed(1);
    return `${minutes}分${seconds}秒`;
  }
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(1)}秒`;
  return `${durationMs}毫秒`;
}

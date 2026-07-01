/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const UNIT_DIVISOR = {
  K: 1_000,
  M: 1_000_000,
} as const;

export type TokenUnit = keyof typeof UNIT_DIVISOR;

export function formatTokens(value: number | undefined, unit: TokenUnit = "K") {
  if (!value) {
    return 0;
  }

  const divisor = UNIT_DIVISOR[unit];
  const precision = unit === "K" ? 2 : 4;

  return Number((value / divisor).toFixed(precision));
}

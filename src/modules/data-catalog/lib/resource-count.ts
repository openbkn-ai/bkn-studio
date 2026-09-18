/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResourceRowCount } from "@/modules/data-catalog/types/data-catalog";

const MAX_SAFE_ROW_COUNT = BigInt(Number.MAX_SAFE_INTEGER);

export function resourceCountAsBigInt(value: ResourceRowCount | null | undefined): bigint {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return 0n;
    }
    return BigInt(Math.trunc(value));
  }

  const normalized = value?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) {
    return 0n;
  }
  return BigInt(normalized);
}

export function resourceCountForPagination(
  ...values: Array<ResourceRowCount | null | undefined>
): number {
  const maximum = values.reduce((current, value) => {
    const count = resourceCountAsBigInt(value);
    return count > current ? count : current;
  }, 0n);

  return Number(maximum > MAX_SAFE_ROW_COUNT ? MAX_SAFE_ROW_COUNT : maximum);
}

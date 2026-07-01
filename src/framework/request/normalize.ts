/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type SingleEntryResponse<T> = T | { entries?: T[] | null };

export function isSingleEntryResponseEnvelope<T>(
  value: unknown,
): value is { entries?: T[] | null } {
  return typeof value === "object" && value !== null && "entries" in value;
}

export function unwrapSingleEntryResponse<T>(
  value: SingleEntryResponse<T> | null | undefined,
): T | null {
  if (!value) {
    return null;
  }

  if (isSingleEntryResponseEnvelope<T>(value)) {
    const { entries } = value;
    return Array.isArray(entries) && entries.length > 0 ? entries[0] ?? null : null;
  }

  return value;
}

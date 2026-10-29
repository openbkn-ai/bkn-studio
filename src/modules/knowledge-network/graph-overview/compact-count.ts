/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** A count as the summary shows it: as is below a thousand, then 81.2k, then 1.2M. */
export function compactCount(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n < 1_000) return String(n);
  const [scaled, unit] = n < 999_950 ? [n / 1_000, "k"] : [n / 1_000_000, "M"];
  return `${scaled.toFixed(1).replace(/\.0$/, "")}${unit}`;
}

/**
 * A total summed from per-type counts. A count that could not be read leaves the total open: it is
 * shown as at least what is known, and never below what is already loaded.
 */
export function compactTotal(counts: readonly (number | null)[], loaded: number): string {
  const known = counts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const open = counts.some((value) => value === null) || loaded > known;
  const shown = compactCount(Math.max(known, loaded));
  return open ? `≥${shown}` : shown;
}

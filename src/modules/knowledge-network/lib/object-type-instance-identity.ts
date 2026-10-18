/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function buildSampleRowKey(
  row: Record<string, string | number>,
  primaryKeys: string[],
  fallbackIndex: number,
) {
  if (primaryKeys.length > 0) {
    return primaryKeys.map((key) => String(row[key] ?? "")).join("::");
  }

  return `row-${fallbackIndex}-${Object.values(row).join("-")}`;
}

export function parseMetricParticipantIdentity(
  raw: string,
  primaryKeys: string[],
): Record<string, string | number | boolean> | null {
  if (!raw || raw.length > 2048 || primaryKeys.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const values = parsed as Record<string, unknown>;
    if (
      Object.keys(values).length !== primaryKeys.length ||
      primaryKeys.some((key) => {
        const value = values[key];
        return (
          value === "" ||
          (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") ||
          (typeof value === "number" && !Number.isSafeInteger(value))
        );
      })
    ) {
      return null;
    }
    return values as Record<string, string | number | boolean>;
  } catch {
    return null;
  }
}

export function buildInstanceIdentityFromSampleRow(
  row: Record<string, string | number>,
  primaryKeys: string[],
): Record<string, string | number> | null {
  if (primaryKeys.length === 0) {
    return null;
  }

  const identity: Record<string, string | number> = {};

  for (const key of primaryKeys) {
    const value = row[key];
    if (value === undefined || value === null || value === "") {
      return null;
    }

    identity[key] = value;
  }

  return identity;
}

export function formatSampleRowLabel(
  row: Record<string, string | number>,
  primaryKeys: string[],
  displayKey?: string,
) {
  if (displayKey && row[displayKey] !== undefined && row[displayKey] !== "") {
    return String(row[displayKey]);
  }

  if (primaryKeys.length > 0) {
    return primaryKeys.map((key) => `${key}=${String(row[key] ?? "")}`).join(", ");
  }

  const firstValue = Object.values(row).find((value) => value !== "" && value != null);
  return firstValue == null ? "--" : String(firstValue);
}

export function matchesSampleRowKeyword(row: Record<string, string | number>, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return (
    !normalizedKeyword ||
    Object.values(row).some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedKeyword),
    )
  );
}

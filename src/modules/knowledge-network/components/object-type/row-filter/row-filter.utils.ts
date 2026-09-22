/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for details.
 */

import type {
  RowFilterAvailableField,
  RowFilterValueType,
} from "@/modules/knowledge-network/types/row-filter-authorization";

export function parseRowFilterValues(
  raw: string,
  type?: RowFilterValueType,
): Array<string | number | boolean> | null {
  const tokens = raw
    .split(/[,，\n]/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length || tokens.length > 100) return null;
  if (type === "integer") {
    const values = tokens.map(Number);
    return values.every(Number.isInteger) ? [...new Set(values)] : null;
  }
  if (type === "boolean") {
    const values = tokens.map((value) => value.toLowerCase());
    if (!values.every((value) => value === "true" || value === "false")) return null;
    return [...new Set(values)].map((value) => value === "true");
  }
  return [...new Set(tokens)];
}

export function rowFilterFieldBusinessLabel(field: RowFilterAvailableField) {
  const displayName = field.displayName?.trim();
  return displayName && displayName !== field.name ? `${displayName} (${field.name})` : field.name;
}

export function rowFilterFieldOptionLabel(field: RowFilterAvailableField) {
  return `${rowFilterFieldBusinessLabel(field)} · ${field.type}`;
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CypherResult } from "@/modules/knowledge-network/cypher/graph-values";

const NUMERIC_TYPES = new Set(["integer", "int", "long", "float", "double", "decimal", "number"]);

/** A sample value typed into a field, as the property type it stands for. */
export function coerceSampleValue(raw: string, propertyType?: string): unknown {
  const text = raw.trim();
  if (propertyType && NUMERIC_TYPES.has(propertyType.toLowerCase()) && text !== "") {
    const value = Number(text);
    return Number.isFinite(value) ? value : raw;
  }
  if (propertyType?.toLowerCase() === "boolean") {
    if (text === "true") return true;
    if (text === "false") return false;
  }
  return raw;
}

export type LogicStatementOutcome =
  { ok: true; value: unknown } | { ok: false; reason: "columns" | "rows" };

/**
 * What a logic property takes from a run: one column, at most one row, scalar; no row is null and
 * more than one row is refused, as the backend evaluates it.
 */
export function logicValueFrom(result: CypherResult): LogicStatementOutcome {
  if (result.columns.length !== 1) return { ok: false, reason: "columns" };
  if (result.entries.length > 1) return { ok: false, reason: "rows" };
  const row = result.entries[0];
  if (!row) return { ok: true, value: null };
  return { ok: true, value: row[result.columns[0].name] ?? null };
}

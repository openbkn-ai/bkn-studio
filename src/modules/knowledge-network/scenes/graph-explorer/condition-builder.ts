/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnCondition, PropertyMeta } from "@/modules/knowledge-network/services/graph-explorer.service";

export type ConditionRow = { field: string; operator: string; value: string };

export type PropertyKind = "string" | "number" | "bool" | "date" | "any";

export const OPERATORS_BY_KIND: Record<PropertyKind, string[]> = {
  string: ["==", "!=", "like", "in"],
  number: ["==", "!=", ">", ">=", "<", "<=", "in"],
  bool: ["==", "!="],
  date: ["==", "!=", ">", ">=", "<", "<="],
  any: ["==", "!=", ">", ">=", "<", "<=", "like", "in"],
};

export function propertyKind(type?: string): PropertyKind {
  const lower = (type ?? "").toLowerCase();
  if (!lower) return "any";
  if (/(int|long|float|double|decimal|number|numeric|real|bigint|short)/.test(lower)) return "number";
  if (/bool/.test(lower)) return "bool";
  if (/(date|time)/.test(lower)) return "date";
  if (/(string|text|char|varchar|keyword)/.test(lower)) return "string";
  return "any";
}

function coerceValue(raw: string, kind: PropertyKind, operator: string): unknown {
  const single = (text: string): unknown => {
    const trimmed = text.trim();
    if (kind === "number") {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) && trimmed !== "" ? numeric : trimmed;
    }
    if (kind === "bool") {
      if (/^(true|1|yes)$/i.test(trimmed)) return true;
      if (/^(false|0|no)$/i.test(trimmed)) return false;
      return trimmed;
    }
    return trimmed;
  };
  if (operator === "in") {
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "")
      .map(single);
  }
  return single(raw);
}

/** Builds the query_object_instance condition from the editor rows; empty rows are ignored. */
export function buildCondition(rows: ConditionRow[], properties: PropertyMeta[]): KnCondition | null {
  const kinds = new Map(properties.map((property) => [property.name, propertyKind(property.type)]));
  const leaves: KnCondition[] = rows
    .filter((row) => row.field && row.operator && row.value.trim() !== "")
    .map((row) => ({ field: row.field, operation: row.operator, value: coerceValue(row.value, kinds.get(row.field) ?? "any", row.operator) }));
  if (leaves.length === 0) return null;
  return leaves.length === 1 ? leaves[0] : { operation: "and", sub_conditions: leaves };
}


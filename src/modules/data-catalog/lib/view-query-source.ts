/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type SourceBlockReason = "indexRequired" | "unknownFilter";

// Keep these in sync with Vega's condition operations and derivedFilterNeedsIndex.
const INDEX_OPERATIONS = new Set(["match", "match_phrase", "multi_match", "knn_vector"]);
const SOURCE_OPERATIONS = new Set([
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "eq",
  "not_eq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "like",
  "not_like",
  "contain",
  "not_contain",
  "range",
  "out_range",
  "exist",
  "not_exist",
  "empty",
  "not_empty",
  "regex",
  "prefix",
  "not_prefix",
  "null",
  "not_null",
  "true",
  "false",
  "before",
  "current",
  "between",
]);

function conditionSourceBlockReason(raw: unknown): SourceBlockReason | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "unknownFilter";
  const condition = raw as Record<string, unknown>;
  const operation = condition.operation;
  if (typeof operation !== "string") return "unknownFilter";
  if (INDEX_OPERATIONS.has(operation)) return "indexRequired";
  if (operation === "and" || operation === "or") {
    if (
      Object.keys(condition).some((key) => key !== "operation" && key !== "sub_conditions") ||
      !Array.isArray(condition.sub_conditions) ||
      !condition.sub_conditions.length
    )
      return "unknownFilter";
    for (const child of condition.sub_conditions) {
      const reason = conditionSourceBlockReason(child);
      if (reason) return reason;
    }
    return null;
  }
  if (
    !SOURCE_OPERATIONS.has(operation) ||
    Object.keys(condition).some(
      (key) => !["operation", "field", "value", "value_from"].includes(key),
    ) ||
    (operation !== "true" && operation !== "false" && typeof condition.field !== "string")
  )
    return "unknownFilter";
  return null;
}

/** Check operations only; the backend validates field types against the complete source schema. */
export function fixedFilterSourceBlockReason(raw: unknown): SourceBlockReason | null {
  return raw === null || raw === undefined ? null : conditionSourceBlockReason(raw);
}

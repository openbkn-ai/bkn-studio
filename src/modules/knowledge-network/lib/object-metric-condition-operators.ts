/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricConditionV1 } from "@/modules/knowledge-network/types/object-metric";

type ComparisonOperator = Extract<
  ObjectMetricConditionV1,
  { node_type: "predicate" }
>["comparison_operator"];

const operatorsByType: Record<string, ComparisonOperator[]> = {
  boolean: ["eq", "neq", "is_true", "is_false", "is_null", "is_not_null"],
  date: [
    "eq",
    "neq",
    "before",
    "before_or_equal",
    "after",
    "after_or_equal",
    "between",
    "not_between",
    "in",
    "not_in",
    "is_null",
    "is_not_null",
  ],
  datetime: [
    "eq",
    "neq",
    "before",
    "before_or_equal",
    "after",
    "after_or_equal",
    "between",
    "not_between",
    "in",
    "not_in",
    "is_null",
    "is_not_null",
  ],
  decimal: [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
    "not_between",
    "in",
    "not_in",
    "is_null",
    "is_not_null",
  ],
  int64: [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
    "not_between",
    "in",
    "not_in",
    "is_null",
    "is_not_null",
  ],
  string: [
    "eq",
    "neq",
    "in",
    "not_in",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
    "is_null",
    "is_not_null",
  ],
};

export function normalizeObjectMetricConditionValueType(type?: string) {
  const value = type?.toLowerCase();
  if (["integer", "int", "int32", "int64", "long"].includes(value ?? "")) return "int64";
  if (["decimal", "double", "float", "float32", "float64", "number"].includes(value ?? "")) {
    return "decimal";
  }
  if (["bool", "boolean"].includes(value ?? "")) return "boolean";
  if (value === "date") return "date";
  if (["datetime", "timestamp"].includes(value ?? "")) return "datetime";
  return "string";
}

export function objectMetricComparisonOperatorsForType(type?: string, allowed?: string[]) {
  const valueType = normalizeObjectMetricConditionValueType(type);
  return (operatorsByType[valueType] ?? operatorsByType.string).filter(
    (value) => !allowed || allowed.includes(value),
  );
}

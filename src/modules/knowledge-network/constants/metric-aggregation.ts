/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { MetricAggregationAggr } from "@/modules/knowledge-network/types/knowledge-network";

/** Matches bkn-backend ValidMetricAggrs / Vega resource aggregation functions. */
export const METRIC_ALL_AGGR_OPTIONS: MetricAggregationAggr[] = [
  "sum",
  "avg",
  "max",
  "min",
  "count",
  "count_distinct",
];

export const METRIC_COUNT_ONLY_AGGR_OPTIONS: MetricAggregationAggr[] = ["count", "count_distinct"];

export const METRIC_TIME_AGGR_OPTIONS: MetricAggregationAggr[] = [
  "max",
  "min",
  "count",
  "count_distinct",
];

/**
 * BKN object-type numeric data property types that support sum/avg/max/min.
 * Use exact type match — do not substring-match (e.g. "string" contains "int").
 */
const METRIC_NUMERIC_PROPERTY_TYPES = new Set([
  "integer",
  "unsigned integer",
  "float",
  "decimal",
  "number",
  "int",
  "bigint",
  "smallint",
  "tinyint",
  "mediumint",
  "double",
  "numeric",
  "real",
]);

/** BKN temporal data property types (also align with metric time_dimension). */
const METRIC_TIME_PROPERTY_TYPES = new Set(["date", "datetime", "timestamp", "time"]);

function normalizePropertyType(type?: string) {
  return (type ?? "").trim().toLowerCase();
}

export function isMetricNumericPropertyType(type?: string) {
  return METRIC_NUMERIC_PROPERTY_TYPES.has(normalizePropertyType(type));
}

export function isMetricTimePropertyType(type?: string) {
  return METRIC_TIME_PROPERTY_TYPES.has(normalizePropertyType(type));
}

export function getAvailableAggrOptionsForPropertyType(
  type?: string,
): MetricAggregationAggr[] {
  const normalized = normalizePropertyType(type);
  if (!normalized) {
    return METRIC_ALL_AGGR_OPTIONS;
  }

  if (isMetricTimePropertyType(normalized)) {
    return METRIC_TIME_AGGR_OPTIONS;
  }

  if (isMetricNumericPropertyType(normalized)) {
    return METRIC_ALL_AGGR_OPTIONS;
  }

  return METRIC_COUNT_ONLY_AGGR_OPTIONS;
}

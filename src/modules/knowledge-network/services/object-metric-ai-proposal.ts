/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricAiIntent } from "./object-metric-ai.service";

export type ObjectMetricAiChange = {
  path: string;
  value: unknown;
};

export type ObjectMetricAiEditableSnapshot = {
  form: Record<string, unknown>;
  businessCondition?: unknown;
  compositeExpression: unknown;
  dependencies: unknown;
  measureExpression: unknown;
  relatedCondition?: unknown;
  relationSteps: unknown;
};

const formFields: Record<string, string> = {
  name: "name",
  code: "code",
  description: "description",
  calculation_scope: "calculationScope",
  "atomic.aggregation": "aggregation",
  "derived.base_metric_id": "baseMetric",
  "derived.base_metric_name": "baseMetric",
  "derived.base_metric_version": "baseMetric",
  "derived.event_time": "eventTime",
  "derived.time_window_mode": "timeWindowMode",
  "derived.time_window_length": "timeWindowLength",
  "derived.time_window_unit": "timeWindowUnit",
  "result.no_data_policy": "noDataPolicy",
  "result.physical_type": "physicalType",
  "result.semantic_type": "semanticType",
  "result.unit_code": "unitCode",
  "result.unit_system": "unitSystem",
  "result.quantity_kind": "quantityKind",
  "query.analysis_dimensions": "analysisDimensions",
  "query.group_by_dimensions": "groupByDimensions",
  "query.time_dimensions": "timeDimensions",
  "query.time_granularity": "timeGranularity",
  "logic_property.enabled": "logicPropertyEnabled",
  "logic_property.property_name": "logicPropertyName",
  "logic_property.display_name": "logicPropertyDisplayName",
  "logic_property.comment": "logicPropertyComment",
};

export function objectMetricAiPreviousValue(
  path: string,
  snapshot: ObjectMetricAiEditableSnapshot,
): unknown {
  const field = formFields[path];
  if (field) return snapshot.form[field];
  if (path === "atomic.expression") return snapshot.measureExpression;
  if (path === "atomic.property_name") {
    const expression = snapshot.measureExpression;
    if (expression && typeof expression === "object" && "property_ref" in expression) {
      const ref: unknown = expression.property_ref;
      if (ref && typeof ref === "object" && "property_name" in ref) return ref.property_name;
    }
  }
  if (path === "derived.filters") return snapshot.businessCondition;
  if (path === "composite.dependencies") return snapshot.dependencies;
  if (path === "composite.expression") return snapshot.compositeExpression;
  return undefined;
}

const editableSections = new Set([
  "atomic",
  "composite",
  "derived",
  "logic_property",
  "query",
  "result",
]);

export function objectMetricAiChanges(intent: ObjectMetricAiIntent): ObjectMetricAiChange[] {
  return Object.entries(intent).flatMap(([key, value]) => {
    if (value === undefined || key === "notes") return [];
    if (editableSections.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      return Object.entries(value as Record<string, unknown>).flatMap(([field, fieldValue]) =>
        fieldValue === undefined ? [] : [{ path: `${key}.${field}`, value: fieldValue }],
      );
    }
    if (editableSections.has(key)) return [];
    return [{ path: key, value }];
  });
}

export function selectedObjectMetricAiIntent(
  intent: ObjectMetricAiIntent,
  selectedPaths: readonly string[],
): ObjectMetricAiIntent {
  const selected = new Set(selectedPaths);
  const result: Record<string, unknown> = {};
  for (const change of objectMetricAiChanges(intent)) {
    if (!selected.has(change.path)) continue;
    const [section, field] = change.path.split(".");
    if (field) {
      const values = (result[section] ?? {}) as Record<string, unknown>;
      values[field] = change.value;
      result[section] = values;
    } else {
      result[section] = change.value;
    }
  }
  return result;
}

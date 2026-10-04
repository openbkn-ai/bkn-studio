/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ObjectMetricTypeV1 = "atomic" | "derived" | "composite";
export type ObjectMetricCalculationScopeV1 = "object_instance" | "object_set";
export type ObjectMetricOutputShapeV1 = "object_value" | "summary" | "grouped" | "time_series";
export type ObjectMetricTimeGranularityV1 =
  "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";

export type ObjectMetricPropertyRefV1 = {
  object_type_id: string;
  property_name: string;
  relation_path_alias?: string;
};

export type ObjectMetricRefV1 = {
  metric_id: string;
  version: number;
};

export type ObjectMetricRelationStepV1 = {
  relation_type_id: string;
  direction: "outgoing" | "incoming";
  target_object_type_id: string;
};

export type ObjectMetricTimeWindowV1 =
  | { mode: "unbounded" }
  | {
      mode: "rolling";
      length: number;
      unit: ObjectMetricTimeGranularityV1;
      timezone?: string;
    }
  | {
      mode: "calendar_period" | "period_to_date";
      period: Exclude<ObjectMetricTimeGranularityV1, "minute" | "hour">;
      timezone: string;
      week_start?: "monday" | "sunday";
    }
  | {
      mode: "fixed_range";
      start_at: number;
      end_at: number;
      timezone: string;
    };

export type ObjectMetricUnitSpecV1 = {
  system: "UCUM" | "ISO_4217" | "registered";
  quantity_kind:
    | "dimensionless"
    | "count"
    | "currency"
    | "duration"
    | "data_size"
    | "rate"
    | "weight"
    | "length"
    | "custom";
  code: string;
  display_symbol?: string;
  scale_factor: number;
  numerator?: ObjectMetricUnitSpecV1;
  denominator?: ObjectMetricUnitSpecV1;
};

export type ObjectMetricValueSemanticsV1 = {
  physical_type: "int64" | "decimal" | "boolean" | "string" | "date" | "datetime" | "duration";
  semantic_type:
    | "measure"
    | "count"
    | "amount"
    | "ratio"
    | "percentage"
    | "score"
    | "rank"
    | "timestamp"
    | "duration"
    | "date"
    | "category"
    | "boolean";
  precision?: number;
  scale?: number;
  rounding_mode?: "half_up" | "half_even" | "floor" | "ceiling" | "truncate";
  unit?: ObjectMetricUnitSpecV1;
  minimum?: number;
  maximum?: number;
};

export type ObjectMetricExpressionV1 =
  | { node_type: "property"; property_ref: ObjectMetricPropertyRefV1; value_type?: string }
  | { node_type: "dependency"; dependency_alias: string }
  | { node_type: "literal"; value_type: string; value: unknown }
  | { node_type: "call"; function: string; arguments: ObjectMetricExpressionV1[] }
  | {
      node_type: "unary";
      operator: "negate";
      left: ObjectMetricExpressionV1;
    }
  | {
      node_type: "binary";
      operator: "add" | "subtract" | "multiply" | "divide" | "modulo";
      left: ObjectMetricExpressionV1;
      right: ObjectMetricExpressionV1;
    };

export type ObjectMetricOperandV1 =
  | { source: "property"; property_ref: ObjectMetricPropertyRefV1 }
  | { source: "literal"; value_type: string; value: unknown };

export type ObjectMetricConditionV1 =
  | {
      node_type: "group";
      boolean_operator: "and" | "or" | "not";
      children: ObjectMetricConditionV1[];
    }
  | {
      node_type: "predicate";
      left: ObjectMetricOperandV1;
      comparison_operator:
        | "eq"
        | "neq"
        | "gt"
        | "gte"
        | "lt"
        | "lte"
        | "between"
        | "not_between"
        | "in"
        | "not_in"
        | "contains"
        | "not_contains"
        | "starts_with"
        | "ends_with"
        | "is_empty"
        | "is_not_empty"
        | "is_null"
        | "is_not_null"
        | "is_true"
        | "is_false"
        | "before"
        | "before_or_equal"
        | "after"
        | "after_or_equal";
      right?: ObjectMetricOperandV1[];
    };

export type ObjectMetricRelationPathV1 = {
  alias: string;
  steps: ObjectMetricRelationStepV1[];
  purpose: "qualify_root";
  quantifier?: "exists" | "not_exists" | "all" | "all_nonempty" | "count_compare";
  related_filters?: ObjectMetricConditionV1;
  cardinality_policy: "preserve_root" | "distinct_root" | "allow_multiplication";
  count_comparison?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  count_threshold?: number;
};

export type ObjectMetricAtomicSpecV1 = {
  kind: "atomic";
  measure: {
    expression?: ObjectMetricExpressionV1;
    aggregation:
      "identity" | "count_rows" | "count" | "count_distinct" | "sum" | "avg" | "min" | "max";
  };
};

export type ObjectMetricDerivedSpecV1 = {
  kind: "derived";
  base_metric: ObjectMetricRefV1;
  business_qualifiers: {
    filters?: ObjectMetricConditionV1;
    relation_path?: ObjectMetricRelationPathV1;
    event_time?: ObjectMetricPropertyRefV1;
    time_window?: ObjectMetricTimeWindowV1;
  };
};

export type ObjectMetricObjectAlignmentV1 = {
  relation_path?: ObjectMetricRelationStepV1[];
  mode: "same_object" | "related_object" | "related_object_set";
  relationship_cardinality?: "one_to_one" | "many_to_one" | "one_to_many" | "many_to_many";
  deduplication: "none" | "by_object_identity";
};

export type ObjectMetricEvaluationContextV1 = {
  time_shift?: {
    amount: number;
    unit: "day" | "week" | "month" | "quarter" | "year";
  };
  window: "inherited" | "rolling" | "calendar_to_date";
  window_spec?: ObjectMetricTimeWindowV1;
  filter_context:
    | { mode: "inherit" }
    | {
        mode: "remove_dimension_filter";
        dimension: ObjectMetricPropertyRefV1;
      };
};

export type ObjectMetricDependencyV1 = {
  alias: string;
  metric_ref: ObjectMetricRefV1;
  object_alignment: ObjectMetricObjectAlignmentV1;
  evaluation_context: ObjectMetricEvaluationContextV1;
  rollup_aggregation?: "sum" | "avg" | "min" | "max" | "count" | "count_distinct";
};

export type ObjectMetricCompositeSpecV1 = {
  kind: "composite";
  dependencies: ObjectMetricDependencyV1[];
  expression: ObjectMetricExpressionV1;
  alignment: {
    result_owner_object_type_id: string;
    group_by_dimensions: ObjectMetricPropertyRefV1[];
    grain_policy: "same_grain" | "rollup";
    result_set_policy: "intersection" | "preserve_primary_dependency";
    primary_dependency_alias?: string;
    time_alignment: "same_time_window" | "explicit_rollup";
    time_key?: ObjectMetricPropertyRefV1;
  };
  zero_division_policy: "unavailable" | "null" | "zero";
  null_policy: "propagate" | "coalesce_zero";
};

export type ObjectMetricDefinitionV1 = {
  id: string;
  version: number;
  code: string;
  name: string;
  description: string;
  owner_object_type_id: string;
  metric_type: ObjectMetricTypeV1;
  calculation_scope: ObjectMetricCalculationScopeV1;
  result_semantics: {
    statistical_grain: {
      group_by_dimensions: ObjectMetricPropertyRefV1[];
      time_granularity?: ObjectMetricTimeGranularityV1;
      timezone?: string;
      week_start?: "monday" | "sunday";
    };
    value: ObjectMetricValueSemanticsV1;
    no_data_policy: "zero" | "null" | "unavailable";
    partial_data_policy: "reject" | "allow_with_warning";
  };
  specification: ObjectMetricAtomicSpecV1 | ObjectMetricDerivedSpecV1 | ObjectMetricCompositeSpecV1;
  query_capabilities: {
    analysis_dimensions: ObjectMetricPropertyRefV1[];
    time_dimensions: ObjectMetricPropertyRefV1[];
  };
  logic_property?: {
    property_name: string;
    display_name: string;
    comment?: string;
  };
  lifecycle: {
    status: "draft" | "validated" | "published" | "deprecated";
    ontology_version: string;
    expression_language_version: string;
    function_registry_version: string;
    aggregation_registry_version: string;
    unit_registry_version: string;
    published_at?: string;
  };
};

export type ObjectMetricQueryRequestV1 = {
  instance_identities?: Record<string, unknown>[];
  filter?: ObjectMetricConditionV1;
  analysis_dimensions?: ObjectMetricPropertyRefV1[];
  time?: { start: number; end: number };
};

export type ObjectMetricDataEntryV1 = {
  instance_identity?: Record<string, unknown>;
  dimensions?: Record<string, unknown>;
  time?: number;
  value?: unknown;
  status: "ok" | "no_data" | "unavailable";
};

export type ObjectMetricDataV1 = {
  model: {
    metric_id: string;
    version: number;
    name: string;
    owner_object_type_id: string;
    output_shape: ObjectMetricOutputShapeV1;
    value: ObjectMetricValueSemanticsV1;
  };
  entries: ObjectMetricDataEntryV1[];
  status: "ok" | "no_data" | "unavailable" | "partial";
  warnings?: string[];
  overall_ms: number;
};

export type MetricPropertyBindingV1 = {
  object_type_id: string;
  property_name: string;
  display_name: string;
  comment?: string;
  metric_ref: ObjectMetricRefV1;
  execution: {
    mode: "realtime";
    refresh_policy?: string;
    freshness_slo?: string;
  };
  no_data_policy: "zero" | "null" | "unavailable";
  on_error: "fail_closed" | "unavailable";
  status: "draft" | "published" | "disabled";
};

export type ObjectMetricRecordV1 = {
  definition: ObjectMetricDefinitionV1;
  kn_id: string;
  branch: string;
  creator: { id: string; type: string };
  updater: { id: string; type: string };
  create_time: number;
  update_time: number;
};

export type ObjectMetricListV1 = {
  entries: ObjectMetricRecordV1[];
  total_count: number;
};

export type ObjectMetricValidationIssueV1 = {
  code: string;
  field: string;
  message: string;
};

export type ObjectMetricValidationResultV1 = {
  valid: boolean;
  issues: ObjectMetricValidationIssueV1[];
  output_shape: ObjectMetricOutputShapeV1;
};

export type ObjectMetricOutputSchemaV1 = {
  shape: ObjectMetricOutputShapeV1;
  dimensions: ObjectMetricPropertyRefV1[];
  value: ObjectMetricValueSemanticsV1;
  time_key?: ObjectMetricPropertyRefV1;
};

export type ObjectMetricPreviewV1 = {
  validation: ObjectMetricValidationResultV1;
  output_schema: ObjectMetricOutputSchemaV1;
};

export type ObjectMetricCapabilitiesV1 = {
  metric_types: ObjectMetricTypeV1[];
  calculation_scopes: ObjectMetricCalculationScopeV1[];
  aggregations: ObjectMetricAtomicSpecV1["measure"]["aggregation"][];
  expression_operators: string[];
  functions: string[];
  comparison_operators: string[];
  boolean_operators: Array<"and" | "or" | "not">;
  time_granularities: ObjectMetricTimeGranularityV1[];
  physical_types: ObjectMetricValueSemanticsV1["physical_type"][];
  semantic_types: ObjectMetricValueSemanticsV1["semantic_type"][];
  unit_systems: ObjectMetricUnitSpecV1["system"][];
  quantity_kinds: ObjectMetricUnitSpecV1["quantity_kind"][];
  lifecycle_statuses: ObjectMetricDefinitionV1["lifecycle"]["status"][];
  registry_versions: Record<string, string>;
};

/** Return shape is derived metadata and must never be authored as part of a metric definition. */
export function inferObjectMetricOutputShapeV1(
  definition: Pick<ObjectMetricDefinitionV1, "calculation_scope" | "result_semantics">,
): ObjectMetricOutputShapeV1 {
  if (definition.calculation_scope === "object_instance") {
    return "object_value";
  }
  if (definition.result_semantics.statistical_grain.time_granularity) {
    return "time_series";
  }
  if (definition.result_semantics.statistical_grain.group_by_dimensions.length > 0) {
    return "grouped";
  }
  return "summary";
}

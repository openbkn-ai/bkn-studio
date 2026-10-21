/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectMetricConditionV1,
  ObjectMetricExpressionV1,
  ObjectMetricOperandV1,
} from "@/modules/knowledge-network/types/object-metric";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";

export type ObjectMetricAiIntent = {
  name?: string;
  code?: string;
  description?: string;
  calculation_scope?: "object_instance" | "object_set";
  atomic?: {
    aggregation?:
      "identity" | "count_rows" | "count" | "count_distinct" | "sum" | "avg" | "min" | "max";
    property_name?: string;
    expression?: ObjectMetricExpressionV1;
  };
  derived?: {
    base_metric_id?: string;
    base_metric_name?: string;
    base_metric_version?: number;
    filters?: ObjectMetricConditionV1;
    event_time?: string;
    time_window_mode?:
      | "unbounded"
      | "rolling"
      | "current_week"
      | "current_month"
      | "current_quarter"
      | "current_year";
    time_window_length?: number;
    time_window_unit?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  };
  composite?: {
    dependencies?: Array<{
      alias: string;
      metric_id?: string;
      metric_name?: string;
      version?: number;
    }>;
    expression?: ObjectMetricExpressionV1;
  };
  result?: {
    no_data_policy?: "zero" | "null" | "unavailable";
    physical_type?: "int64" | "decimal" | "boolean" | "string" | "date" | "datetime" | "duration";
    semantic_type?:
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
    unit_code?: string;
    unit_system?: "UCUM" | "ISO_4217" | "registered";
    quantity_kind?:
      | "dimensionless"
      | "count"
      | "currency"
      | "duration"
      | "data_size"
      | "rate"
      | "weight"
      | "length"
      | "custom";
  };
  query?: {
    analysis_dimensions?: string[];
    group_by_dimensions?: string[];
    time_dimensions?: string[];
    time_granularity?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  };
  logic_property?: {
    enabled?: boolean;
    property_name?: string;
    display_name?: string;
    comment?: string;
  };
  notes?: string[];
};

function extractJsonObject(text: string): string {
  const withoutFence = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(objectMetricText("mbea600bbe742"));
  return withoutFence.slice(start, end + 1);
}

type ObjectMetricAiParseOptions = { allowedProperties?: Set<string> };

const comparisonOperators = new Set([
  "after",
  "after_or_equal",
  "before",
  "before_or_equal",
  "between",
  "contains",
  "ends_with",
  "eq",
  "gt",
  "gte",
  "in",
  "is_empty",
  "is_false",
  "is_not_empty",
  "is_not_null",
  "is_null",
  "is_true",
  "lt",
  "lte",
  "neq",
  "not_between",
  "not_contains",
  "not_in",
  "starts_with",
]);

const comparisonsWithoutRight = new Set([
  "is_empty",
  "is_false",
  "is_not_empty",
  "is_not_null",
  "is_null",
  "is_true",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  warnings: string[],
): T | undefined {
  const candidate = optionalString(value);
  if (!candidate) return undefined;
  if (allowed.some((item) => item === candidate)) return candidate as T;
  warnings.push(objectMetricText("aiUnsupportedFieldValue", { p0: field, p1: candidate }));
  return undefined;
}

function optionalAllowedProperty(
  value: unknown,
  options: ObjectMetricAiParseOptions,
  warnings: string[],
) {
  const propertyName = optionalString(value);
  if (!propertyName) return undefined;
  if (options.allowedProperties && !options.allowedProperties.has(propertyName)) {
    warnings.push(objectMetricText("aiUnsupportedProperty", { p0: propertyName }));
    return undefined;
  }
  return propertyName;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : undefined;
}

function literalValueType(value: unknown) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "int64" : "decimal";
  return "string";
}

function parseAiOperand(
  value: unknown,
  options: ObjectMetricAiParseOptions,
  warnings: string[],
): ObjectMetricOperandV1 | undefined {
  if (!isRecord(value)) return undefined;
  const source = value.source;
  if (source === "property" || value.property_ref || value.property_name) {
    const propertyRef = isRecord(value.property_ref) ? value.property_ref : undefined;
    const propertyName = optionalString(propertyRef?.property_name ?? value.property_name);
    if (!propertyName) return undefined;
    if (options.allowedProperties && !options.allowedProperties.has(propertyName)) {
      warnings.push(objectMetricText("mde719c1e6e9a", { p0: propertyName }));
      return undefined;
    }
    return {
      source: "property",
      property_ref: {
        object_type_id: optionalString(propertyRef?.object_type_id) ?? "",
        property_name: propertyName,
      },
    };
  }
  if ((source === "literal" || Object.hasOwn(value, "value")) && value.value !== undefined) {
    return {
      source: "literal",
      value: value.value,
      value_type: optionalString(value.value_type) ?? literalValueType(value.value),
    };
  }
  return undefined;
}

function parseAiCondition(
  value: unknown,
  options: ObjectMetricAiParseOptions,
  warnings: string[],
): ObjectMetricConditionV1 | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const children = value.flatMap((item) => {
      const child = parseAiCondition(item, options, warnings);
      return child ? [child] : [];
    });
    if (!children.length) return undefined;
    return children.length === 1
      ? children[0]
      : { boolean_operator: "and", children, node_type: "group" };
  }
  if (!isRecord(value)) {
    warnings.push(objectMetricText("m21df9ab9af30"));
    return undefined;
  }
  if (value.node_type === "group" || Array.isArray(value.children)) {
    const operator = ["and", "or", "not"].includes(String(value.boolean_operator))
      ? (value.boolean_operator as "and" | "or" | "not")
      : "and";
    const children = Array.isArray(value.children)
      ? value.children.flatMap((item) => {
          const child = parseAiCondition(item, options, warnings);
          return child ? [child] : [];
        })
      : [];
    if (!children.length) {
      warnings.push(objectMetricText("ma0e381e333b1"));
      return undefined;
    }
    return { boolean_operator: operator, children, node_type: "group" };
  }

  const comparison = optionalString(value.comparison_operator ?? value.operator);
  const warningCountBeforeLeft = warnings.length;
  const left = parseAiOperand(
    value.left ?? (value.property_name ? { property_name: value.property_name } : undefined),
    options,
    warnings,
  );
  if (!left || left.source !== "property" || !comparison || !comparisonOperators.has(comparison)) {
    if (warnings.length === warningCountBeforeLeft) {
      warnings.push(objectMetricText("ma4021f694175"));
    }
    return undefined;
  }
  const rightValue = value.right ?? (Object.hasOwn(value, "value") ? value.value : undefined);
  const rawRight: unknown[] = Array.isArray(rightValue) ? rightValue : [rightValue];
  const right = comparisonsWithoutRight.has(comparison)
    ? undefined
    : rawRight.flatMap((item) => {
        const operand = parseAiOperand(
          isRecord(item) ? item : { source: "literal", value: item },
          options,
          warnings,
        );
        return operand ? [operand] : [];
      });
  if (!comparisonsWithoutRight.has(comparison) && !right?.length) {
    warnings.push(objectMetricText("m1e5bff31ad22"));
    return undefined;
  }
  return {
    comparison_operator: comparison as Extract<
      ObjectMetricConditionV1,
      { node_type: "predicate" }
    >["comparison_operator"],
    left,
    node_type: "predicate",
    right,
  };
}

function parseAiExpression(
  value: unknown,
  options: ObjectMetricAiParseOptions,
  warnings: string[],
): ObjectMetricExpressionV1 | undefined {
  if (!isRecord(value)) return undefined;
  if (value.node_type === "property" || value.property_ref || value.property_name) {
    const operand = parseAiOperand(
      { property_name: value.property_name, property_ref: value.property_ref, source: "property" },
      options,
      warnings,
    );
    return operand?.source === "property"
      ? { node_type: "property", property_ref: operand.property_ref }
      : undefined;
  }
  if (value.node_type === "dependency") {
    const alias = optionalString(value.dependency_alias);
    return alias ? { dependency_alias: alias, node_type: "dependency" } : undefined;
  }
  if (value.node_type === "literal") {
    return {
      node_type: "literal",
      value: value.value,
      value_type: optionalString(value.value_type) ?? literalValueType(value.value),
    };
  }
  if (value.node_type === "unary" && value.operator === "negate") {
    const left = parseAiExpression(value.left, options, warnings);
    return left ? { left, node_type: "unary", operator: "negate" } : undefined;
  }
  if (
    value.node_type === "binary" &&
    ["add", "subtract", "multiply", "divide", "modulo"].includes(String(value.operator))
  ) {
    const left = parseAiExpression(value.left, options, warnings);
    const right = parseAiExpression(value.right, options, warnings);
    return left && right
      ? {
          left,
          node_type: "binary",
          operator: value.operator as "add" | "subtract" | "multiply" | "divide" | "modulo",
          right,
        }
      : undefined;
  }
  if (value.node_type === "call") {
    const functionName = optionalString(value.function);
    const arguments_ = Array.isArray(value.arguments)
      ? value.arguments.flatMap((item) => {
          const argument = parseAiExpression(item, options, warnings);
          return argument ? [argument] : [];
        })
      : [];
    return functionName && arguments_.length === (value.arguments as unknown[])?.length
      ? { arguments: arguments_, function: functionName, node_type: "call" }
      : undefined;
  }
  warnings.push(objectMetricText("m3d91e66cedb9"));
  return undefined;
}

export function parseObjectMetricAiIntent(
  text: string,
  options: ObjectMetricAiParseOptions = {},
): ObjectMetricAiIntent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(objectMetricText("m5f60adbd6366"));
    throw error;
  }
  if (!isRecord(parsed)) {
    throw new Error(objectMetricText("m426d9c7d04f4"));
  }
  const warnings = stringArray(parsed.notes) ?? [];
  const intent: ObjectMetricAiIntent = {};
  const name = optionalString(parsed.name);
  const code = optionalString(parsed.code);
  const description = optionalString(parsed.description);
  if (name) intent.name = name;
  if (code) intent.code = code;
  if (description) intent.description = description;
  if (["object_instance", "object_set"].includes(String(parsed.calculation_scope))) {
    intent.calculation_scope =
      parsed.calculation_scope as ObjectMetricAiIntent["calculation_scope"];
  }

  if (isRecord(parsed.atomic)) {
    const aggregation = optionalString(parsed.atomic.aggregation);
    intent.atomic = {
      aggregation: [
        "identity",
        "count_rows",
        "count",
        "count_distinct",
        "sum",
        "avg",
        "min",
        "max",
      ].includes(aggregation ?? "")
        ? (aggregation as NonNullable<ObjectMetricAiIntent["atomic"]>["aggregation"])
        : undefined,
      expression: parseAiExpression(parsed.atomic.expression, options, warnings),
      property_name: optionalAllowedProperty(parsed.atomic.property_name, options, warnings),
    };
  }
  if (isRecord(parsed.derived)) {
    intent.derived = {
      base_metric_id: optionalString(parsed.derived.base_metric_id),
      base_metric_name: optionalString(parsed.derived.base_metric_name),
      base_metric_version: optionalNumber(parsed.derived.base_metric_version),
      event_time: optionalAllowedProperty(parsed.derived.event_time, options, warnings),
      filters: parseAiCondition(parsed.derived.filters, options, warnings),
      time_window_length: optionalNumber(parsed.derived.time_window_length),
      time_window_mode: optionalEnum(
        parsed.derived.time_window_mode,
        [
          "unbounded",
          "rolling",
          "current_week",
          "current_month",
          "current_quarter",
          "current_year",
        ],
        "derived.time_window_mode",
        warnings,
      ),
      time_window_unit: optionalEnum(
        parsed.derived.time_window_unit,
        ["minute", "hour", "day", "week", "month", "quarter", "year"],
        "derived.time_window_unit",
        warnings,
      ),
    };
  }
  if (isRecord(parsed.composite)) {
    intent.composite = {
      dependencies: Array.isArray(parsed.composite.dependencies)
        ? parsed.composite.dependencies.flatMap((item) => {
            if (!isRecord(item)) return [];
            const alias = optionalString(item.alias);
            if (!alias) return [];
            return [
              {
                alias,
                metric_id: optionalString(item.metric_id),
                metric_name: optionalString(item.metric_name),
                version: optionalNumber(item.version),
              },
            ];
          })
        : undefined,
      expression: parseAiExpression(parsed.composite.expression, options, warnings),
    };
  }
  if (isRecord(parsed.result)) {
    intent.result = {
      no_data_policy: optionalEnum(
        parsed.result.no_data_policy,
        ["zero", "null", "unavailable"],
        "result.no_data_policy",
        warnings,
      ),
      physical_type: optionalEnum(
        parsed.result.physical_type,
        ["int64", "decimal", "boolean", "string", "date", "datetime", "duration"],
        "result.physical_type",
        warnings,
      ),
      quantity_kind: optionalEnum(
        parsed.result.quantity_kind,
        [
          "dimensionless",
          "count",
          "currency",
          "duration",
          "data_size",
          "rate",
          "weight",
          "length",
          "custom",
        ],
        "result.quantity_kind",
        warnings,
      ),
      semantic_type: optionalEnum(
        parsed.result.semantic_type,
        [
          "measure",
          "count",
          "amount",
          "ratio",
          "percentage",
          "score",
          "rank",
          "timestamp",
          "duration",
          "date",
          "category",
          "boolean",
        ],
        "result.semantic_type",
        warnings,
      ),
      unit_code: optionalString(parsed.result.unit_code),
      unit_system: optionalEnum(
        parsed.result.unit_system,
        ["UCUM", "ISO_4217", "registered"],
        "result.unit_system",
        warnings,
      ),
    };
  }
  if (isRecord(parsed.query)) {
    intent.query = {
      analysis_dimensions: stringArray(parsed.query.analysis_dimensions),
      group_by_dimensions: stringArray(parsed.query.group_by_dimensions),
      time_dimensions: stringArray(parsed.query.time_dimensions),
      time_granularity: optionalEnum(
        parsed.query.time_granularity,
        ["minute", "hour", "day", "week", "month", "quarter", "year"],
        "query.time_granularity",
        warnings,
      ),
    };
  }
  if (isRecord(parsed.logic_property)) {
    intent.logic_property = {
      comment: optionalString(parsed.logic_property.comment),
      display_name: optionalString(parsed.logic_property.display_name),
      enabled:
        typeof parsed.logic_property.enabled === "boolean"
          ? parsed.logic_property.enabled
          : undefined,
      property_name: optionalString(parsed.logic_property.property_name),
    };
  }
  if (warnings.length) intent.notes = [...new Set(warnings)];
  return intent;
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectMetricDefinitionV1,
  ObjectMetricExpressionV1,
  ObjectMetricTypeV1,
  ObjectMetricUnitSpecV1,
  ObjectMetricValueSemanticsV1,
} from "@/modules/knowledge-network/types/object-metric";
import { normalizeExpressionValueType } from "@/modules/knowledge-network/components/object-metric/object-metric-expression-registry";

export function objectMetricPropertyExpression(
  objectTypeId: string,
  propertyName: string,
  propertyType?: string,
): ObjectMetricExpressionV1 {
  return {
    node_type: "property",
    property_ref: { object_type_id: objectTypeId, property_name: propertyName },
    value_type: propertyType ? normalizeExpressionValueType(propertyType) : undefined,
  };
}

export type InferredCompositeValueV1 = {
  physicalType?: ObjectMetricValueSemanticsV1["physical_type"];
  unit?: ObjectMetricUnitSpecV1;
  unitKnown: boolean;
};

function sameUnit(left?: ObjectMetricUnitSpecV1, right?: ObjectMetricUnitSpecV1): boolean {
  if (!left || !right) return left === right;
  return (
    left.system === right.system &&
    left.quantity_kind === right.quantity_kind &&
    left.code === right.code &&
    left.scale_factor === right.scale_factor &&
    sameUnit(left.numerator, right.numerator) &&
    sameUnit(left.denominator, right.denominator)
  );
}

function promoteNumber(left?: string, right?: string, forceDecimal = false) {
  if (!left || !right) return undefined;
  if (forceDecimal || left === "decimal" || right === "decimal") return "decimal" as const;
  if (left === "duration" && right === "duration") return "duration" as const;
  return "int64" as const;
}

/**
 * Mirrors the backend's composite-expression inference closely enough for the
 * editor to keep the hidden physical result contract in sync with the formula.
 * Business semantics remain user-editable, while technical type/unit values
 * are derived from the selected immutable dependency versions.
 */
export function inferCompositeExpressionValueV1(
  expression: ObjectMetricExpressionV1,
  dependencies: Readonly<Record<string, ObjectMetricValueSemanticsV1>>,
): InferredCompositeValueV1 {
  switch (expression.node_type) {
    case "dependency": {
      const value = dependencies[expression.dependency_alias];
      return value
        ? { physicalType: value.physical_type, unit: value.unit, unitKnown: true }
        : { unitKnown: false };
    }
    case "literal":
      return {
        physicalType: expression.value_type as ObjectMetricValueSemanticsV1["physical_type"],
        unitKnown: true,
      };
    case "property":
      return { unitKnown: false };
    case "unary":
      return inferCompositeExpressionValueV1(expression.left, dependencies);
    case "binary": {
      const left = inferCompositeExpressionValueV1(expression.left, dependencies);
      const right = inferCompositeExpressionValueV1(expression.right, dependencies);
      const physicalType = promoteNumber(
        left.physicalType,
        right.physicalType,
        expression.operator === "divide",
      );
      if (["add", "subtract", "modulo"].includes(expression.operator)) {
        return {
          physicalType,
          unit: left.unit,
          unitKnown: left.unitKnown && right.unitKnown && sameUnit(left.unit, right.unit),
        };
      }
      if (expression.operator === "multiply") {
        if (left.unitKnown && !left.unit)
          return { physicalType, unit: right.unit, unitKnown: right.unitKnown };
        if (right.unitKnown && !right.unit)
          return { physicalType, unit: left.unit, unitKnown: left.unitKnown };
        return { physicalType, unitKnown: false };
      }
      if (right.unitKnown && !right.unit)
        return { physicalType, unit: left.unit, unitKnown: left.unitKnown };
      if (left.unitKnown && right.unitKnown && sameUnit(left.unit, right.unit)) {
        return { physicalType, unitKnown: true };
      }
      return { physicalType, unitKnown: false };
    }
    case "call": {
      const first = expression.arguments[0]
        ? inferCompositeExpressionValueV1(expression.arguments[0], dependencies)
        : { unitKnown: false };
      if (
        ["abs", "ceil", "floor", "round", "coalesce", "greatest", "least"].includes(
          expression.function,
        )
      ) {
        return first;
      }
      if (["duration_between", "date_diff"].includes(expression.function)) {
        return { physicalType: "duration", unitKnown: false };
      }
      if (["date_part", "length"].includes(expression.function)) {
        return { physicalType: "int64", unitKnown: true };
      }
      if (["lower", "upper"].includes(expression.function)) {
        return { physicalType: "string", unitKnown: true };
      }
      return { unitKnown: false };
    }
  }
}

export function createObjectMetricDefinitionV1(
  metricType: ObjectMetricTypeV1,
  ownerObjectTypeId: string,
): ObjectMetricDefinitionV1 {
  const common: Omit<ObjectMetricDefinitionV1, "specification"> = {
    calculation_scope: "object_set",
    code: "",
    description: "",
    id: "",
    lifecycle: {
      aggregation_registry_version: "1.0",
      expression_language_version: "1.0",
      function_registry_version: "1.0",
      ontology_version: "current",
      status: "draft",
      unit_registry_version: "1.0",
    },
    metric_type: metricType,
    name: "",
    owner_object_type_id: ownerObjectTypeId,
    query_capabilities: { analysis_dimensions: [], time_dimensions: [] },
    result_semantics: {
      no_data_policy: "zero",
      partial_data_policy: "reject",
      statistical_grain: { group_by_dimensions: [] },
      value: {
        physical_type: "decimal",
        precision: 18,
        rounding_mode: "half_up",
        scale: 2,
        semantic_type: "measure",
      },
    },
    version: 1,
  };

  if (metricType === "atomic") {
    return {
      ...common,
      specification: {
        kind: "atomic",
        measure: { aggregation: "count_rows" },
      },
    };
  }
  if (metricType === "derived") {
    return {
      ...common,
      specification: {
        base_metric: { metric_id: "", version: 1 },
        business_qualifiers: {},
        kind: "derived",
      },
    };
  }
  return {
    ...common,
    specification: {
      alignment: {
        grain_policy: "same_grain",
        group_by_dimensions: [],
        result_owner_object_type_id: ownerObjectTypeId,
        result_set_policy: "intersection",
        time_alignment: "same_time_window",
      },
      dependencies: [],
      expression: { node_type: "literal", value: 0, value_type: "decimal" },
      kind: "composite",
      null_policy: "propagate",
      zero_division_policy: "unavailable",
    },
  };
}

export function expressionLabel(expression: ObjectMetricExpressionV1): string {
  switch (expression.node_type) {
    case "property":
      return `${expression.property_ref.object_type_id}.${expression.property_ref.property_name}`;
    case "dependency":
      return expression.dependency_alias;
    case "literal":
      return typeof expression.value === "string" || typeof expression.value === "number"
        ? String(expression.value)
        : typeof expression.value === "boolean"
          ? expression.value
            ? "true"
            : "false"
          : "";
    case "call":
      return `${expression.function}(${expression.arguments.map(expressionLabel).join(", ")})`;
    case "unary":
      return `-${expressionLabel(expression.left)}`;
    case "binary": {
      const operators = { add: "+", divide: "÷", modulo: "%", multiply: "×", subtract: "−" };
      return `(${expressionLabel(expression.left)} ${operators[expression.operator]} ${expressionLabel(expression.right)})`;
    }
  }
}

/**
 * Replaces technical dependency aliases with metric names for business-facing
 * previews. The immutable alias remains unchanged in the stored expression.
 */
export function replaceObjectMetricDependencyAliases(
  expression: ObjectMetricExpressionV1,
  labels: Readonly<Record<string, string>>,
): ObjectMetricExpressionV1 {
  if (expression.node_type === "dependency") {
    return {
      ...expression,
      dependency_alias: labels[expression.dependency_alias] ?? expression.dependency_alias,
    };
  }
  if (expression.node_type === "binary") {
    return {
      ...expression,
      left: replaceObjectMetricDependencyAliases(expression.left, labels),
      right: replaceObjectMetricDependencyAliases(expression.right, labels),
    };
  }
  if (expression.node_type === "unary") {
    return {
      ...expression,
      left: replaceObjectMetricDependencyAliases(expression.left, labels),
    };
  }
  if (expression.node_type === "call") {
    return {
      ...expression,
      arguments: expression.arguments.map((item) =>
        replaceObjectMetricDependencyAliases(item, labels),
      ),
    };
  }
  return expression;
}

/**
 * An atomic metric represents a fact from source data, not a constant. Keep
 * this invariant available to the editor so it can guide users before server
 * validation.
 */
export function expressionReferencesProperty(expression: ObjectMetricExpressionV1): boolean {
  switch (expression.node_type) {
    case "property":
      return Boolean(
        expression.property_ref.object_type_id && expression.property_ref.property_name,
      );
    case "call":
      return expression.arguments.some(expressionReferencesProperty);
    case "unary":
      return expressionReferencesProperty(expression.left);
    case "binary":
      return (
        expressionReferencesProperty(expression.left) ||
        expressionReferencesProperty(expression.right)
      );
    case "dependency":
    case "literal":
      return false;
  }
}

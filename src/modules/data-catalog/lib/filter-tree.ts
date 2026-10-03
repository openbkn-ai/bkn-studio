/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";
import JSONBig from "json-bigint";

export type FilterOperation = "==" | "!=" | ">" | "<";
export type FilterRule = { kind: "rule"; field: string; operation: FilterOperation; value: string };
export type FilterGroup = { kind: "group"; operation: "and" | "or"; children: FilterNode[] };
export type FilterNode = FilterGroup | FilterRule;
export type FilterQueryPath = "source" | "local_index";

const FILTER_OPERATIONS = new Set<string>(["==", "!=", ">", "<"]);
const numericLiteral = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const preciseJSON = JSONBig();

export function emptyFilterGroup(): FilterGroup {
  return { kind: "group", operation: "and", children: [] };
}

export function parseFilterCondition(raw: unknown): FilterGroup | null {
  if (raw === null || raw === undefined) return emptyFilterGroup();
  const parse = (value: unknown): FilterNode | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const node = value as Record<string, unknown>;
    if (node.operation === "and" || node.operation === "or") {
      if (Object.keys(node).some((key) => !["operation", "sub_conditions"].includes(key)))
        return null;
      if (!Array.isArray(node.sub_conditions) || !node.sub_conditions.length) return null;
      const children = node.sub_conditions.map(parse);
      if (children.some((child) => child === null)) return null;
      return { kind: "group", operation: node.operation, children: children as FilterNode[] };
    }
    if (
      Object.keys(node).some(
        (key) => !["field", "operation", "value", "value_from"].includes(key),
      ) ||
      typeof node.field !== "string" ||
      typeof node.operation !== "string" ||
      !FILTER_OPERATIONS.has(node.operation) ||
      (node.value_from !== undefined && node.value_from !== "const") ||
      !["string", "number", "boolean"].includes(typeof node.value)
    )
      return null;
    return {
      kind: "rule",
      field: node.field,
      operation: node.operation as FilterOperation,
      value: String(node.value),
    };
  };
  const parsed = parse(raw);
  return parsed?.kind === "group"
    ? parsed
    : parsed
      ? { kind: "group", operation: "and", children: [parsed] }
      : null;
}

export function filterValidationError(
  group: FilterGroup,
  fields: ResourceSchemaField[],
  path: FilterQueryPath = "source",
): "emptyGroup" | "tooMany" | "invalidField" | "missingValue" | "invalidNumber" | null {
  const fieldMap = new Map(fields.map((field) => [field.name, field]));
  const validate = (node: FilterNode, root: boolean): ReturnType<typeof filterValidationError> => {
    if (node.kind === "group") {
      if (!node.children.length) return root ? null : "emptyGroup";
      if (node.children.length > 100) return "tooMany";
      for (const child of node.children) {
        const error = validate(child, false);
        if (error) return error;
      }
      return null;
    }
    const field = fieldMap.get(node.field);
    if (!field || !filterOperationsForField(field, path).includes(node.operation))
      return "invalidField";
    if (!node.value.trim()) return "missingValue";
    if (
      isNumericFilterType(field.type) &&
      (!numericLiteral.test(node.value.trim()) || !Number.isFinite(Number(node.value)))
    )
      return "invalidNumber";
    if (field.type.trim().toLowerCase() === "boolean" && !["true", "false"].includes(node.value))
      return "invalidField";
    return null;
  };
  return validate(group, true);
}

export function isNumericFilterType(type: string) {
  return /^(integer|unsigned integer|float|decimal|numeric|double|bigint|int)/i.test(type.trim());
}

export function isFilterableFieldType(type: string) {
  return (
    isNumericFilterType(type) || ["string", "text", "boolean"].includes(type.trim().toLowerCase())
  );
}

/** The editor exposes only operations supported by both the field and the selected query path. */
export function filterOperationsForField(
  field: ResourceSchemaField,
  path: FilterQueryPath = "source",
): FilterOperation[] {
  if (!isFilterableFieldType(field.type)) return [];
  if (isNumericFilterType(field.type)) return ["==", "!=", ">", "<"];
  const { features: propertyFeatures } = field;
  if (
    path === "local_index" &&
    field.type.trim().toLowerCase() === "text" &&
    !propertyFeatures?.some((feature) => feature.featureType === "keyword")
  )
    return [];
  return ["==", "!="];
}

export function filterToBackend(
  group: FilterGroup,
  fields: ResourceSchemaField[],
): Record<string, unknown> | null {
  if (!group.children.length) return null;
  const fieldMap = new Map(fields.map((field) => [field.name, field]));
  const serialize = (node: FilterNode): Record<string, unknown> => {
    if (node.kind === "group")
      return {
        operation: node.operation,
        sub_conditions: node.children.map(serialize),
      };
    const field = fieldMap.get(node.field);
    return {
      field: node.field,
      operation: node.operation,
      value_from: "const",
      value:
        field && isNumericFilterType(field.type)
          ? preciseJSON.parse(node.value.trim())
          : field?.type.trim().toLowerCase() === "boolean"
            ? node.value === "true"
            : node.value,
    };
  };
  return serialize(group);
}

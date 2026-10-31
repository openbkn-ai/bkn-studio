/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";
import BigNumber from "bignumber.js";
import {
  parsePrecisionPreservingJSON,
  precisionPreservingValueText,
} from "@/framework/request/precision-safe-json";
import { temporalFilterValue } from "./filter-temporal";

const COMPARISONS = ["==", "!=", ">", "<", ">=", "<="] as const;
const SETS = ["in", "not_in"] as const;
const RANGES = ["range", "out_range", "between"] as const;
const PRESENCE = ["null", "not_null", "exist", "not_exist"] as const;
const STRINGS = [
  "like",
  "not_like",
  "prefix",
  "not_prefix",
  "regex",
  "contain",
  "not_contain",
  "empty",
  "not_empty",
] as const;
const FULLTEXT = ["match", "match_phrase"] as const;
export const FILTER_TIME_UNITS = ["year", "month", "week", "day", "hour", "minute"] as const;
export type FilterOperation =
  | (typeof COMPARISONS)[number]
  | (typeof SETS)[number]
  | (typeof RANGES)[number]
  | (typeof PRESENCE)[number]
  | (typeof STRINGS)[number]
  | (typeof FULLTEXT)[number]
  | "before"
  | "current";
export type FilterRule = {
  kind: "rule";
  field: string;
  operation: FilterOperation;
  value: string | undefined | (string | undefined)[];
  valueFrom?: "const" | "field";
};
export type FilterGroup = { kind: "group"; operation: "and" | "or"; children: FilterNode[] };
export type FilterNode = FilterGroup | FilterRule;
export type FilterQueryPath = "source" | "local_index";
type FilterError =
  | "emptyGroup"
  | "tooMany"
  | "invalidField"
  | "missingValue"
  | "invalidNumber"
  | "invalidDate"
  | "invalidRange"
  | "incompatibleField"
  | "sameField"
  | "invalidRelativeTime"
  | "invalidSubstring";
const FILTER_OPERATIONS = new Set<string>([
  ...COMPARISONS,
  ...SETS,
  ...RANGES,
  ...PRESENCE,
  ...STRINGS,
  ...FULLTEXT,
  "before",
  "current",
]);
const unescapedLikePercent = /(^|[^\\])(?:\\\\)*%/;
const numericLiteral = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const fieldType = (type: string) => type.trim().toLowerCase();
const hasOperation = (operations: readonly string[], operation: string) =>
  operations.includes(operation);

export function emptyFilterGroup(): FilterGroup {
  return { kind: "group", operation: "and", children: [] };
}
export function filterValueKind(
  operation: FilterOperation,
): "none" | "scalar" | "set" | "range" | "before" | "current" {
  if (hasOperation([...PRESENCE, "empty", "not_empty"], operation)) return "none";
  if (hasOperation([...SETS, "contain", "not_contain"], operation)) return "set";
  if (hasOperation(RANGES, operation)) return "range";
  if (operation === "before" || operation === "current") return operation;
  return "scalar";
}
export function filterSupportsFieldValue(operation: FilterOperation) {
  return hasOperation(COMPARISONS, operation);
}

export function parseFilterCondition(
  raw: unknown,
  path: FilterQueryPath = "source",
): FilterGroup | null {
  if (raw === null || raw === undefined) return emptyFilterGroup();
  const scalar = (value: unknown) =>
    ["string", "number", "boolean"].includes(typeof value) || BigNumber.isBigNumber(value);
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
      (node.value_from !== undefined && node.value_from !== "const" && node.value_from !== "field")
    )
      return null;
    const operation = node.operation as FilterOperation;
    const kind = filterValueKind(operation);
    // Stored emptiness can change semantics when the query channel changes.
    // Keep their full original definitions rather than silently rewriting them.
    if (
      ["empty", "not_empty"].includes(operation) ||
      (path === "local_index" &&
        operation === "before" &&
        Array.isArray(node.value) &&
        !hasOperation(FILTER_TIME_UNITS, String(node.value[1])))
    )
      return null;

    // Legacy wildcard definitions cannot be edited under the current literal contract.
    if (
      ["like", "not_like"].includes(operation) &&
      typeof node.value === "string" &&
      unescapedLikePercent.test(node.value)
    )
      return null;
    if (
      node.value_from === "field" &&
      (!filterSupportsFieldValue(operation) || typeof node.value !== "string")
    )
      return null;
    if (kind !== "none") {
      if (["set", "range", "before"].includes(kind)) {
        if (!Array.isArray(node.value) || !node.value.every(scalar)) return null;
      } else if (!scalar(node.value)) return null;
    }
    return {
      kind: "rule",
      field: node.field,
      operation,
      value:
        kind === "none"
          ? ""
          : Array.isArray(node.value)
            ? node.value.map(precisionPreservingValueText)
            : precisionPreservingValueText(node.value),
      ...(node.value_from === "field" ? { valueFrom: "field" as const } : {}),
    };
  };
  const parsed = parse(raw);
  return parsed?.kind === "group"
    ? parsed
    : parsed
      ? { kind: "group", operation: "and", children: [parsed] }
      : null;
}

function isLargeIntegerType(type: string) {
  return fieldType(type) === "large_integer";
}
export function isNumericFilterType(type: string) {
  return /^(large_integer|integer|unsigned integer|float|decimal|numeric|double|bigint|int)(?:$|\()/i.test(
    type.trim(),
  );
}
export function isTemporalFilterType(type: string) {
  return ["date", "datetime"].includes(fieldType(type));
}
export function isFilterableFieldType(type: string) {
  return (
    isNumericFilterType(type) ||
    isTemporalFilterType(type) ||
    ["string", "text", "boolean", "json"].includes(fieldType(type))
  );
}

/** Conservative UI matrix; unverified platform types remain unavailable. */
export function filterOperationsForField(
  field: ResourceSchemaField,
  path: FilterQueryPath = "source",
): FilterOperation[] {
  const type = fieldType(field.type);
  if (!isFilterableFieldType(type)) return [];
  if (type === "json") return path === "source" ? ["null", "not_null"] : [];
  if (/^(decimal|numeric)(?:$|\()/.test(type) && path === "local_index") return [];
  if (type === "boolean") return ["==", "!=", ...PRESENCE];
  if (isTemporalFilterType(type))
    return [...COMPARISONS, ...SETS, ...RANGES, ...PRESENCE, "before", "current"];
  if (isNumericFilterType(type) && !(isLargeIntegerType(type) && path === "local_index"))
    return [...COMPARISONS, ...SETS, ...RANGES, ...PRESENCE];
  const { features: propertyFeatures } = field;
  const fulltext: FilterOperation[] =
    path === "local_index" &&
    propertyFeatures?.some((feature) => feature.featureType === "fulltext")
      ? [...FULLTEXT]
      : [];
  if (
    path === "local_index" &&
    type === "text" &&
    !propertyFeatures?.some((feature) => feature.featureType === "keyword")
  )
    return [...PRESENCE, ...fulltext];
  return ["==", "!=", ...SETS, ...STRINGS, ...PRESENCE, ...fulltext];
}

export function compatibleFilterFields(
  field: ResourceSchemaField,
  fields: ResourceSchemaField[],
  operation: FilterOperation,
  path: FilterQueryPath = "source",
) {
  if (!filterSupportsFieldValue(operation)) return [];
  return fields.filter((candidate) => {
    if (candidate.name === field.name) return false;
    if (!filterOperationsForField(candidate, path).includes(operation)) return false;
    // LARGEINT is a keyword in indexes and a precise decimal string at the source.
    if (isLargeIntegerType(field.type) || isLargeIntegerType(candidate.type))
      return fieldType(field.type) === fieldType(candidate.type);
    return (
      (isNumericFilterType(field.type) && isNumericFilterType(candidate.type)) ||
      fieldType(field.type) === fieldType(candidate.type)
    );
  });
}

export function filterValidationError(
  group: FilterGroup,
  fields: ResourceSchemaField[],
  path: FilterQueryPath = "source",
): FilterError | null {
  const fieldMap = new Map(fields.map((field) => [field.name, field]));
  const validate = (node: FilterNode, root: boolean): FilterError | null => {
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
    const kind = filterValueKind(node.operation);
    if (node.valueFrom === "field") {
      if (node.value === node.field) return "sameField";
      return typeof node.value === "string" &&
        compatibleFilterFields(field, fields, node.operation, path).some(
          (right) => right.name === node.value,
        )
        ? null
        : "incompatibleField";
    }
    if (kind === "none") return null;
    if (
      ["like", "not_like"].includes(node.operation) &&
      typeof node.value === "string" &&
      unescapedLikePercent.test(node.value)
    )
      return "invalidSubstring";
    if (kind === "current")
      return typeof node.value === "string" && hasOperation(FILTER_TIME_UNITS, node.value)
        ? null
        : "invalidRelativeTime";
    if (kind === "before")
      return Array.isArray(node.value) &&
        node.value.length === 2 &&
        typeof node.value[0] === "string" &&
        typeof node.value[1] === "string" &&
        /^\d+$/.test(node.value[0]) &&
        new BigNumber(node.value[0]).isGreaterThan(0) &&
        new BigNumber(node.value[0]).isLessThanOrEqualTo(
          path === "local_index" ? 2147483647 : Number.MAX_SAFE_INTEGER,
        ) &&
        hasOperation(FILTER_TIME_UNITS, node.value[1])
        ? null
        : "invalidRelativeTime";
    const array = kind === "set" || kind === "range";
    if (array !== Array.isArray(node.value)) return "missingValue";
    const values = Array.isArray(node.value) ? node.value : [node.value];
    if (!values.length || !values.every((value): value is string => typeof value === "string"))
      return "missingValue";
    const acceptsEmpty =
      ["string", "text"].includes(fieldType(field.type)) ||
      (isLargeIntegerType(field.type) && path === "local_index");
    if (!acceptsEmpty && values.some((value) => !value.trim())) return "missingValue";
    if (kind === "range" && values.length !== 2) return "invalidRange";
    for (const value of values) {
      if (
        isNumericFilterType(field.type) &&
        !(isLargeIntegerType(field.type) && path === "local_index")
      ) {
        const number = new BigNumber(value.trim());
        if (
          !number.isFinite() ||
          !(isLargeIntegerType(field.type) ? /^[+-]?\d+$/ : numericLiteral).test(value.trim())
        )
          return "invalidNumber";
        if (!isLargeIntegerType(field.type)) {
          try {
            parsePrecisionPreservingJSON(value.trim());
          } catch {
            return "invalidNumber";
          }
        }
        if (
          /^(integer|unsigned integer|bigint|int)$/.test(fieldType(field.type)) &&
          !number.isInteger()
        )
          return "invalidNumber";
        if (
          fieldType(field.type) === "unsigned integer" &&
          (number.isLessThan(0) || number.isGreaterThan("18446744073709551615"))
        )
          return "invalidNumber";
        if (
          fieldType(field.type) === "integer" &&
          (number.isLessThan("-9223372036854775808") || number.isGreaterThan("9223372036854775807"))
        )
          return "invalidNumber";
        if (["float", "double"].includes(fieldType(field.type)) && !Number.isFinite(Number(value)))
          return "invalidNumber";
      }
      if (isTemporalFilterType(field.type) && !temporalFilterValue(field.type, value))
        return "invalidDate";
      if (fieldType(field.type) === "boolean" && !["true", "false"].includes(value))
        return "invalidField";
    }
    if (kind === "range") {
      if (isNumericFilterType(field.type) && new BigNumber(values[0]).isGreaterThan(values[1]))
        return "invalidRange";
      if (isTemporalFilterType(field.type)) {
        const lower = temporalFilterValue(field.type, values[0])!;
        const upper = temporalFilterValue(field.type, values[1])!;
        // A wall time and an absolute time cannot be ordered without the server timezone.
        if (lower.absolute === upper.absolute && lower.nanoseconds > upper.nanoseconds)
          return "invalidRange";
      }
    }
    return null;
  };
  return validate(group, true);
}

export function filterToBackend(
  group: FilterGroup,
  fields: ResourceSchemaField[],
  path: FilterQueryPath = "source",
): Record<string, unknown> | null {
  if (!group.children.length) return null;
  const fieldMap = new Map(fields.map((field) => [field.name, field]));
  const serialize = (node: FilterNode): Record<string, unknown> => {
    if (node.kind === "group")
      return { operation: node.operation, sub_conditions: node.children.map(serialize) };
    const base = { field: node.field, operation: node.operation };
    if (node.operation === "empty" || node.operation === "not_empty") {
      // Equality uses keyword routing for TEXT and keeps NULL separate from empty strings.
      const equality = {
        field: node.field,
        operation: node.operation === "empty" ? "==" : "!=",
        value_from: "const",
        value: "",
      };
      return node.operation === "empty"
        ? equality
        : {
            operation: "and",
            sub_conditions: [{ field: node.field, operation: "not_null" }, equality],
          };
    }
    if (filterValueKind(node.operation) === "none") return base;
    if (node.valueFrom === "field") return { ...base, value_from: "field", value: node.value };
    const field = fieldMap.get(node.field);
    const scalar = (value: string | undefined): unknown => {
      if (value === undefined) throw new Error("A filter constant is required.");
      return field && isNumericFilterType(field.type) && !isLargeIntegerType(field.type)
        ? parsePrecisionPreservingJSON(value.trim())
        : field && isLargeIntegerType(field.type) && path === "source"
          ? value.trim()
          : fieldType(field?.type ?? "") === "boolean"
            ? value === "true"
            : value;
    };
    const value =
      node.operation === "before" && Array.isArray(node.value)
        ? [Number(node.value[0]), node.value[1]]
        : node.operation === "current"
          ? node.value
          : Array.isArray(node.value)
            ? node.value.map(scalar)
            : scalar(node.value);
    return { ...base, value_from: "const", value };
  };
  return serialize(group);
}

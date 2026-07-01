/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ActionTypeConditionOperation } from "@/modules/knowledge-network/types/knowledge-network";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";

/** Backend-supported condition operators (Vega ActionCondition). */
const BACKEND_OPERATIONS = new Set<ActionTypeConditionOperation>([
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "in",
  "not_in",
  "range",
  "out_range",
  "exist",
  "not_exist",
]);

/** Vega DataFilterNew typeOperationMapping, filtered to backend-supported ops. */
const TYPE_OPERATION_MAPPING: Record<string, ActionTypeConditionOperation[]> = {
  string: ["==", "!=", "in", "not_in", "exist", "not_exist"],
  text: ["==", "!=", "in", "not_in", "exist", "not_exist"],
  number: [
    "==",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "in",
    "not_in",
    "range",
    "out_range",
    "exist",
    "not_exist",
  ],
  date: [
    "==",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "range",
    "out_range",
    "exist",
    "not_exist",
  ],
  boolean: ["==", "!=", "exist", "not_exist"],
  ip: ["==", "!=", "in", "not_in", "exist", "not_exist"],
  json: ["exist", "not_exist"],
  vector: ["exist", "not_exist"],
  binary: ["exist", "not_exist"],
};

const DEFAULT_OPERATIONS = TYPE_OPERATION_MAPPING.string;

export function transformConditionFieldType(type?: string): string {
  if (!type) {
    return "string";
  }

  if (["time", "datetime", "timestamp"].includes(type)) {
    return "date";
  }

  if (["integer", "unsigned integer", "float", "decimal"].includes(type)) {
    return "number";
  }

  if (["point", "shape", "other"].includes(type)) {
    return "binary";
  }

  return type;
}

export function getConditionOperationsForFieldType(
  type?: string,
): ActionTypeConditionOperation[] {
  const formatType = transformConditionFieldType(type);
  const operations = TYPE_OPERATION_MAPPING[formatType] ?? DEFAULT_OPERATIONS;

  return operations.filter((operation) => BACKEND_OPERATIONS.has(operation));
}

export function resolveConditionOperation(
  fieldType: string | undefined,
  operation?: ActionTypeConditionOperation,
): ActionTypeConditionOperation | undefined {
  const operations = getConditionOperationsForFieldType(fieldType);
  if (operations.length === 0) {
    return undefined;
  }

  if (operation && operations.includes(operation)) {
    return operation;
  }

  return operations[0];
}

export function findConditionProperty(
  propertyOptions: RelationTypePropertyOption[],
  fieldName?: string,
) {
  if (!fieldName) {
    return undefined;
  }

  return propertyOptions.find(
    (item) => item.name === fieldName || item.value === fieldName,
  );
}

export function buildGroupedConditionFieldOptions(
  propertyOptions: RelationTypePropertyOption[],
) {
  const groups = new Map<string, RelationTypePropertyOption[]>();

  for (const property of propertyOptions) {
    const groupKey = property.type || "string";
    const current = groups.get(groupKey) ?? [];
    current.push(property);
    groups.set(groupKey, current);
  }

  return [...groups.entries()].map(([type, items]) => ({
    label: type,
    options: items.map((item) => ({
      label: item.displayName || item.label || item.name,
      value: item.name,
    })),
  }));
}

export function getConditionOperationLabelKey(operation: ActionTypeConditionOperation) {
  return `knowledgeNetwork.actionTypeConditionOperation_${operation}`;
}

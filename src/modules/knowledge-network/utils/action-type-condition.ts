/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ActionTypeCondition,
  ActionTypeConditionOperation,
  ActionTypeExecutionParameter,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import {
  conditionNeedsArray,
  conditionNeedsValue,
  findConditionProperty,
  isConditionReferenceCompatible,
} from "@/modules/knowledge-network/constants/action-type-condition";

export type BackendActionCondition = {
  field?: string;
  object_type_id?: string;
  operation?: string;
  sub_conditions?: (BackendActionCondition | undefined)[];
  value?: string | string[];
  value_from?: "const" | "property" | "input";
};

export function toBackendActionCondition(
  condition?: ActionTypeCondition,
): BackendActionCondition | undefined {
  const normalized = promoteLegacyActionCondition(condition);
  if (!normalized) {
    return undefined;
  }

  if (normalized.operation === "and" || normalized.operation === "or") {
    const subConditions = normalized.subConditions
      ?.map((item) => toBackendActionCondition(item))
      .filter((item): item is BackendActionCondition => Boolean(item));
    if (!subConditions?.length) {
      return undefined;
    }
    return {
      object_type_id: normalized.objectTypeId,
      operation: normalized.operation,
      sub_conditions: subConditions,
      value_from: normalized.valueFrom ?? "const",
    };
  }

  if (!normalized.field || !normalized.operation) {
    return undefined;
  }

  return {
    field: normalized.field,
    object_type_id: normalized.objectTypeId,
    operation: normalized.operation,
    value: normalized.value,
    value_from: normalized.valueFrom ?? "const",
  };
}

export function mapActionTypeConditionFromBackend(
  condition?: BackendActionCondition,
): ActionTypeCondition | undefined {
  if (!condition) {
    return undefined;
  }

  if (!condition.field && !(condition.sub_conditions?.length ?? 0)) {
    return undefined;
  }

  return promoteLegacyActionCondition({
    field: condition.field,
    objectTypeId: condition.object_type_id,
    operation: condition.operation as ActionTypeConditionOperation | undefined,
    subConditions: condition.sub_conditions
      ?.map((item) => mapActionTypeConditionFromBackend(item))
      .filter((item): item is ActionTypeCondition => Boolean(item)),
    value: condition.value,
    valueFrom: condition.value_from ?? "const",
  });
}

export function hasReferencedConditionValue(condition?: ActionTypeCondition | null): boolean {
  if (!condition) return false;
  return (
    (!isLogicalOperation(condition.operation) &&
      conditionNeedsValue(condition.operation) &&
      (condition.valueFrom === "property" || condition.valueFrom === "input")) ||
    (condition.subConditions ?? []).some(hasReferencedConditionValue)
  );
}

/** Validate references again at save time, including references made stale by tool changes. */
export function validateActionCondition(
  condition: ActionTypeCondition | null | undefined,
  properties: RelationTypePropertyOption[],
  parameters: ActionTypeExecutionParameter[],
): string | null {
  if (!condition) return null;
  for (const child of condition.subConditions ?? []) {
    const error = validateActionCondition(child, properties, parameters);
    if (error) return error;
  }
  if (isLogicalOperation(condition.operation) || !condition.field || !condition.operation)
    return null;
  if (!conditionNeedsValue(condition.operation)) return null;
  const valueFrom = condition.valueFrom ?? "const";
  const fieldType = findConditionProperty(properties, condition.field)?.type;
  if (valueFrom === "property") {
    const property =
      typeof condition.value === "string"
        ? findConditionProperty(properties, condition.value)
        : undefined;
    return property && isConditionReferenceCompatible(fieldType, property.type, condition.operation)
      ? null
      : "knowledgeNetwork.actionTypeConditionPropertyRequired";
  }
  if (valueFrom === "input") {
    const parameter = parameters.find(
      (item) => item.name === condition.value && (item.valueFrom ?? "input") === "input",
    );
    return parameter &&
      isConditionReferenceCompatible(fieldType, parameter.type, condition.operation)
      ? null
      : "knowledgeNetwork.actionTypeConditionParameterRequired";
  }
  const values = Array.isArray(condition.value)
    ? condition.value
    : condition.value === undefined
      ? undefined
      : conditionNeedsArray(condition.operation)
        ? condition.value.split(",")
        : [condition.value];
  if (!values?.length || values.some((item) => !item.trim())) {
    return "knowledgeNetwork.actionTypeConditionValueRequired";
  }
  if (
    conditionNeedsArray(condition.operation) &&
    (condition.operation === "range" || condition.operation === "out_range") &&
    values.length !== 2
  )
    return "knowledgeNetwork.actionTypeConditionRangeRequired";
  return null;
}

export function isLogicalOperation(
  operation?: ActionTypeConditionOperation,
): operation is "and" | "or" {
  return operation === "and" || operation === "or";
}

export function asLeaf(
  condition: ActionTypeCondition,
  fallbackObjectTypeId?: string,
): ActionTypeCondition {
  return {
    field: condition.field,
    objectTypeId: condition.objectTypeId || fallbackObjectTypeId,
    operation: condition.operation,
    value: !conditionNeedsValue(condition.operation)
      ? undefined
      : (condition.valueFrom ?? "const") === "const" &&
          conditionNeedsArray(condition.operation) &&
          typeof condition.value === "string"
        ? condition.value.split(",").map((item) => item.trim())
        : condition.value,
    valueFrom: conditionNeedsValue(condition.operation)
      ? (condition.valueFrom ?? "const")
      : "const",
  };
}

export function hasLeafContent(condition?: ActionTypeCondition): boolean {
  if (!condition) {
    return false;
  }
  return Boolean(condition.field && condition.operation);
}

/**
 * Promote legacy Studio trees where a comparison leaf also carries
 * `subConditions` into an explicit `and` node so backends recurse correctly.
 */
export function promoteLegacyActionCondition(
  condition?: ActionTypeCondition | null,
): ActionTypeCondition | undefined {
  if (!condition) {
    return undefined;
  }

  if (isLogicalOperation(condition.operation)) {
    const subConditions = (condition.subConditions ?? [])
      .map((item) => promoteLegacyActionCondition(item))
      .filter((item): item is ActionTypeCondition => Boolean(item));
    if (subConditions.length === 0) {
      return undefined;
    }
    return {
      objectTypeId: condition.objectTypeId,
      operation: condition.operation,
      subConditions,
      valueFrom: "const",
    };
  }

  const nested = (condition.subConditions ?? [])
    .map((item) => promoteLegacyActionCondition(item))
    .filter((item): item is ActionTypeCondition => Boolean(item));

  if (nested.length === 0) {
    if (!hasLeafContent(condition) && !condition.objectTypeId) {
      return undefined;
    }
    return asLeaf(condition);
  }

  if (!hasLeafContent(condition)) {
    if (nested.length === 1) {
      return nested[0];
    }
    return {
      objectTypeId: condition.objectTypeId ?? nested[0]?.objectTypeId,
      operation: "and",
      subConditions: nested,
      valueFrom: "const",
    };
  }

  return {
    objectTypeId: condition.objectTypeId,
    operation: "and",
    subConditions: [asLeaf(condition), ...nested],
    valueFrom: "const",
  };
}

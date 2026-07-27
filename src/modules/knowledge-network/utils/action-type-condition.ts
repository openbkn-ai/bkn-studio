/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ActionTypeCondition,
  ActionTypeConditionOperation,
} from "@/modules/knowledge-network/types/knowledge-network";

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
    value: condition.value,
    valueFrom: condition.valueFrom ?? "const",
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


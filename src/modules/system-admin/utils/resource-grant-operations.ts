/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResourceGrant, ResourceRef } from "@/modules/system-admin/types/admin";
import { HIDDEN_INSTANCE_OPS } from "@/modules/system-admin/utils/authz-catalog";
import { operationsForType, WILDCARD } from "@/modules/system-admin/utils/resource-catalog";

const sameResource = (a: ResourceRef, b: ResourceRef) => a.type === b.type && a.id === b.id;

export function availableOperationsForGrant<Operation extends { key: string }>(
  grant: Pick<ResourceGrant, "resource" | "operations">,
  definitions: Operation[],
): Operation[] {
  return definitions
    .filter((operation) => grant.resource.id === WILDCARD || !HIDDEN_INSTANCE_OPS.has(operation.key))
    .filter((operation) => !grant.operations.includes(operation.key));
}

export function normalizeRoleOperations(resourceType: string, selected: string[]): string[] {
  const definitions = new Map(
    operationsForType(resourceType).map((operation) => [operation.key, operation]),
  );
  const normalized = new Set<string>();
  const visiting = new Set<string>();
  const addWithRequirements = (operation: string) => {
    if (normalized.has(operation) || visiting.has(operation)) {
      return;
    }
    visiting.add(operation);
    definitions.get(operation)?.requires.forEach(addWithRequirements);
    visiting.delete(operation);
    normalized.add(operation);
  };
  selected.forEach(addWithRequirements);
  return [...normalized];
}

export function addOperationToGrant(
  grants: ResourceGrant[],
  target: ResourceGrant,
  operation: string,
): ResourceGrant[] {
  return grants.map((grant) =>
    sameResource(grant.resource, target.resource)
      ? {
          ...grant,
          operations: normalizeRoleOperations(grant.resource.type, [...grant.operations, operation]),
        }
      : grant,
  );
}

export function removeOperationFromGrant(
  grants: ResourceGrant[],
  target: ResourceGrant,
  operation: string,
): ResourceGrant[] {
  const remainingOperations = normalizeRoleOperations(
    target.resource.type,
    target.operations.filter((item) => item !== operation),
  );
  if (remainingOperations.length === 0) {
    return grants.filter((grant) => !sameResource(grant.resource, target.resource));
  }

  return grants.map((grant) =>
    sameResource(grant.resource, target.resource)
      ? { ...grant, operations: remainingOperations }
      : grant,
  );
}

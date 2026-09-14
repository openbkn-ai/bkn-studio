/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResourceGrant, ResourceRef } from "@/modules/system-admin/types/admin";

const sameResource = (a: ResourceRef, b: ResourceRef) => a.type === b.type && a.id === b.id;

export function addOperationToGrant(
  grants: ResourceGrant[],
  target: ResourceGrant,
  operation: string,
): ResourceGrant[] {
  return grants.map((grant) =>
    sameResource(grant.resource, target.resource)
      ? { ...grant, operations: Array.from(new Set([...grant.operations, operation])) }
      : grant,
  );
}

export function removeOperationFromGrant(
  grants: ResourceGrant[],
  target: ResourceGrant,
  operation: string,
): ResourceGrant[] {
  const remainingOperations = target.operations.filter((item) => item !== operation);
  if (remainingOperations.length === 0) {
    return grants.filter((grant) => !sameResource(grant.resource, target.resource));
  }

  return grants.map((grant) =>
    sameResource(grant.resource, target.resource)
      ? { ...grant, operations: remainingOperations }
      : grant,
  );
}

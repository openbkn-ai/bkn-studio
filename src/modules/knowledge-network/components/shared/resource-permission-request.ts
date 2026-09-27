/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";

const resourcePermissionOperations: Record<string, readonly string[]> = {
  knowledge_network: ["view_detail", "modify", "delete", "execute", "query_data"],
  catalog: [
    "view_detail",
    "modify",
    "delete",
    "task_manage",
    "resource_manage",
    "query_data",
    "data_write",
  ],
  resource: ["view_detail", "query_data", "data_write", "modify", "delete"],
  tool_box: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  function: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  mcp: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  skill: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  concept_group: ["view_detail", "modify", "delete"],
  object_type: ["view_detail", "modify", "delete", "query_data"],
  relation_type: ["view_detail", "modify", "delete", "query_data"],
  action_type: ["view_detail", "modify", "delete", "execute"],
  metric: ["view_detail", "modify", "delete", "query_data"],
};

export type RequestablePermissionOperation = {
  key: string;
  requires: readonly string[];
};

// Expands a selection only with prerequisites that are still missing. A
// prerequisite absent from requestableOperations is already effective for the
// user, so sending it again would make the whole request conflict at the
// server's live-permission check.
export function togglePermissionRequestOperation(
  current: string[],
  operationKey: string,
  requestableOperations: readonly RequestablePermissionOperation[],
) {
  const operation = requestableOperations.find((candidate) => candidate.key === operationKey);
  if (!operation) return current;

  if (current.includes(operationKey)) {
    const requiredBySelection = requestableOperations.some(
      (candidate) => current.includes(candidate.key) && candidate.requires.includes(operationKey),
    );
    return requiredBySelection
      ? current
      : current.filter((candidateOperation) => candidateOperation !== operationKey);
  }

  const requestableKeys = new Set(requestableOperations.map((candidate) => candidate.key));
  const missingRequirements = operation.requires.filter((requirement) =>
    requestableKeys.has(requirement),
  );
  return [...new Set([...current, ...missingRequirements, operationKey])];
}

export function canRequestResourcePermission(
  resourceType: string,
  operations: string[] | undefined,
  permissionRequestsEnabled = true,
) {
  if (!permissionRequestsEnabled || getRuntimeConfig().currentUser.isSuperAdmin) return false;
  // Object types additionally expose self-service row/property restrictions.
  // Those policies remain meaningful even when every base operation is already
  // effective, so do not hide the only entry point in that situation.
  if (resourceType === "object_type" && Array.isArray(operations)) return true;
  return getMissingResourcePermissionOperations(resourceType, operations).length > 0;
}

export function hasRequestableObjectTypePermission({
  hasPendingRequest,
  hasRowFilter,
  missingOperationCount,
  restrictedPropertyCount,
}: {
  hasPendingRequest: boolean;
  hasRowFilter: boolean;
  missingOperationCount: number;
  restrictedPropertyCount: number;
}) {
  return (
    missingOperationCount > 0 || hasRowFilter || restrictedPropertyCount > 0 || hasPendingRequest
  );
}

export function hasRequestableObjectTypePolicyScope(preview: unknown) {
  const value = preview as {
    property_grants?: { entries?: Array<{ level?: string }> };
    row_filter?: { policy?: { conditions?: unknown[] } | null };
  };
  const hasRestrictedRowScope = Boolean(value.row_filter?.policy?.conditions?.length);
  const hasRestrictedPropertyScope = (value.property_grants?.entries ?? []).some(
    (entry) => entry.level !== "full" && entry.level !== "inherit",
  );
  return hasRestrictedRowScope || hasRestrictedPropertyScope;
}

export function getMissingResourcePermissionOperations(
  resourceType: string,
  operations: string[] | undefined,
) {
  // Do not infer missing permissions when the backend did not return the
  // effective operation set. Otherwise owners could incorrectly see and
  // submit a permission request for resources they already control.
  if (!operations || operations.includes("*") || operations.includes("full_business_access")) {
    return [];
  }

  return (resourcePermissionOperations[resourceType] ?? []).filter(
    (operation) => !operations.includes(operation),
  );
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";

const resourcePermissionOperations: Record<string, readonly string[]> = {
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

export function canRequestResourcePermission(
  resourceType: string,
  operations: string[] | undefined,
  permissionRequestsEnabled = true,
) {
  if (!permissionRequestsEnabled || getRuntimeConfig().currentUser.isSuperAdmin) return false;
  return getMissingResourcePermissionOperations(resourceType, operations).length > 0;
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

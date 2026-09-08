/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  hasPermissions,
  type PermissionCheckMode,
} from "@/framework/permission/has-permissions";

export type HomeActionAccess = {
  path?: string;
  permissionMode?: PermissionCheckMode;
  permissions?: string | string[];
};

const NAVIGATION_ENTRY_PATHS = new Set([
  "/data-connect",
  "/data-directory",
  "/index-builds",
  "/knowledge-network",
  "/knowledge-network/integration",
  "/execution-factory/units",
]);

export function canAccessHomeAction(
  currentPermissions: string[],
  action: HomeActionAccess,
) {
  if (action.path && NAVIGATION_ENTRY_PATHS.has(action.path)) {
    return true;
  }

  if (!action.permissions) {
    return true;
  }

  return hasPermissions({
    currentPermissions,
    mode: action.permissionMode,
    requiredPermissions: action.permissions,
  });
}

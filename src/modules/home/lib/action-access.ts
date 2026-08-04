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
  permissionMode?: PermissionCheckMode;
  permissions?: string | string[];
};

export function canAccessHomeAction(
  currentPermissions: string[],
  action: HomeActionAccess,
) {
  if (!action.permissions) {
    return true;
  }

  return hasPermissions({
    currentPermissions,
    mode: action.permissionMode,
    requiredPermissions: action.permissions,
  });
}

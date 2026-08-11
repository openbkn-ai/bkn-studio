/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Audit-log method and action mapped to stable tokens, then rendered through i18n.
 * See bkn-safe admin-api-frontend-changes.md for the mapping table.
 */
const ACTION_MAP: Record<string, string> = {
  "POST users": "user_create",
  "PUT users": "user_update",
  "DELETE users": "user_delete",
  "PUT users.password": "user_reset_pwd",
  "POST departments": "dept_create",
  "PUT departments": "dept_update",
  "DELETE departments": "dept_delete",
  "POST departments.members": "dept_add_member",
  "DELETE departments.members": "dept_remove_member",
  "POST roles": "role_create",
  "PUT roles": "role_update",
  "DELETE roles": "role_delete",
  "POST roles.permissions": "role_grant",
  "DELETE roles.permissions": "role_revoke",
  "POST role-bindings": "role_bind",
  "DELETE role-bindings": "role_unbind",
};

export function auditActionToken(method: string, action: string): string {
  return ACTION_MAP[`${method} ${action}`] ?? "";
}

export const AUDIT_RESOURCES = ["users", "departments", "roles", "role-bindings"] as const;

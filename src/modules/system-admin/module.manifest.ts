/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const systemAdminModuleManifest = {
  id: "system-admin",
  name: "System Admin",
  permissions: [
    "admin-user:create",
    "admin-user:edit",
    "admin-user:delete",
    "admin-user:toggle",
    "admin-user:reset-password",
    "admin-dept:create",
    "admin-dept:edit",
    "admin-dept:delete",
    "admin-dept:members",
    "admin-role:create",
    "admin-role:edit",
    "admin-role:delete",
    "admin-role:members",
    "admin-authz:grant",
    "admin-authz:revoke",
    "admin-license:view",
    "admin-license:manage",
    "admin-audit:view",
  ],
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: ["user-management/users", "user-management/departments", "authorization/roles", "authorization/role-members", "authorization/object-grants", "license-management/license"],
  scenes: [
    {
      id: "system-admin.users",
      exportName: "UserManagementScene",
      description: "Manage platform users and the department (org) tree: create, edit, freeze, disable, reset password.",
      inputs: [],
    },
    {
      id: "system-admin.roles",
      exportName: "RoleManagementScene",
      description: "Manage authorization roles, their object-level resource grants, and user/department members.",
      inputs: [],
    },
    {
      id: "system-admin.object-authorization",
      exportName: "ObjectAuthorizationScene",
      description: "Grant a specific object (data connection / Catalog, knowledge network, small model) directly to a user or department, on top of role permissions. Authorization is at the whole-object level (e.g. a whole Catalog, not individual resources). List-style with an overview page (all / by object / by member).",
      inputs: [],
    },
    {
      id: "system-admin.license",
      exportName: "LicenseManagementScene",
      description: "Manage the product license for the current OpenBKN cluster: view state, copy the device fingerprint, import license or activation certificate text, activate online, and remove the license.",
      inputs: [],
    },
    {
      id: "system-admin.audit",
      exportName: "AuditLogScene",
      description: "Browse the bkn-safe admin audit log: who changed what, with status and time filters.",
      inputs: [],
    },
  ],
} as const;

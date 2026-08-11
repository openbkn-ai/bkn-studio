/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Permissions required by each system-administration page (any one is sufficient). Navigation
// filtering and route guards share this definition to prevent drift. These align with module.manifest.ts;
// regular users do not hold any admin-* permissions.
//
// Entering a page and acting within it are separate layers. This defines the minimum capability
// required to enter, including read-only review. Each write action is checked again against its
// authzPoints entry by PermissionGate, so auditors can review policies but cannot grant or revoke.
export const systemAdminPermissions: Record<
  "audit" | "authorizations" | "license" | "licenseManage" | "roles" | "users",
  string[]
> = {
  users: [
    "admin-user:create",
    "admin-user:edit",
    "admin-user:delete",
    "admin-user:toggle",
    "admin-user:reset-password",
    "admin-dept:create",
    "admin-dept:edit",
    "admin-dept:delete",
    "admin-dept:members",
  ],
  roles: [
    "admin-role:view",
    "admin-role:create",
    "admin-role:edit",
    "admin-role:delete",
    "admin-role:members",
    "admin-role:permissions",
  ],
  authorizations: ["admin-authz:view", "admin-authz:grant", "admin-authz:revoke"],
  license: ["admin-license:view", "admin-license:manage"],
  licenseManage: ["admin-license:manage"],
  audit: ["admin-audit:view"],
};

// Authorization action points. Each constant maps to a backend endpoint action and controls its
// corresponding page button or entry point, matching bkn-safe's API-layer checks (bkn-docs/
// docs/foundry/bkn-safe/design/issue-134-authz-admin-fine-grained.md).
//
// grant/revoke controls assigning a concrete object to a concrete user (object-grants), whereas
// rolePermissions controls the role itself (roles/:id/permissions). The backend separates these
// concerns into different permission points, so the frontend must not combine their checks.
export const authzPoints = {
  /** Grant an object - POST /admin/object-grants. */
  grant: "admin-authz:grant",
  /** Revoke an object grant - DELETE /admin/object-grants. */
  revoke: "admin-authz:revoke",
  /** Bind or unbind role members - POST and DELETE /admin/role-bindings. */
  roleMembers: "admin-role:members",
  /** Configure role permissions - POST and DELETE /admin/roles/:id/permissions. */
  rolePermissions: "admin-role:permissions",
  /** Read-only review of policies and grants - GET /admin/policies and /admin/object-grants. */
  review: "admin-authz:view",
} as const;

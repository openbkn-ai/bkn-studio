/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// 系统管理各页面所需权限(任一即可)。导航过滤与路由守卫共用同一份，避免漂移。
// 与 module.manifest.ts 的权限点对齐;普通用户不持有任何 admin-* 权限。
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
  roles: ["admin-role:create", "admin-role:edit", "admin-role:delete", "admin-role:members"],
  authorizations: ["admin-authz:grant", "admin-authz:revoke"],
  license: ["admin-license:view", "admin-license:manage"],
  licenseManage: ["admin-license:manage"],
  audit: ["admin-audit:view"],
};

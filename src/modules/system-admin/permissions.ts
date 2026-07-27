/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// 系统管理各页面所需权限(任一即可)。导航过滤与路由守卫共用同一份，避免漂移。
// 与 module.manifest.ts 的权限点对齐;普通用户不持有任何 admin-* 权限。
//
// 进入页面与页内动作是两层:这里给的是「能不能进这个页」,门槛取该页最低的
// 能力——只读审查也算能进。页内每个写动作各自按 authzPoints 的点位再判一次
// (PermissionGate),因此审计员进得去授权页看策略,但看不到授权/撤权按钮。
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

// 授权面的动作点位。每个常量对应后端一个接口动作,页内按钮/入口按它判定,
// 与 bkn-safe 的接口层校验一一对应(bkn-docs
// docs/foundry/bkn-safe/design/issue-134-authz-admin-fine-grained.md)。
//
// grant/revoke 管的是「把某个具体对象授予某个具体用户」(object-grants);
// rolePermissions 管的是「塑造角色本身」(roles/:id/permissions)——后端把这两件
// 事拆成了不同点位,前端不能再用同一个判定糊在一起。
export const authzPoints = {
  /** 对象授权 —— POST /admin/object-grants */
  grant: "admin-authz:grant",
  /** 对象撤权 —— DELETE /admin/object-grants */
  revoke: "admin-authz:revoke",
  /** 角色成员绑定/解绑 —— POST、DELETE /admin/role-bindings */
  roleMembers: "admin-role:members",
  /** 角色权限配置 —— POST、DELETE /admin/roles/:id/permissions */
  rolePermissions: "admin-role:permissions",
  /** 策略与授权只读审查 —— GET /admin/policies、/admin/object-grants */
  review: "admin-authz:view",
} as const;

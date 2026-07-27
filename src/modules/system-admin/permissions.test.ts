/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { deriveStudioPermissions, flattenSafeGrants } from "@/framework/auth/permission-map";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { systemAdminModuleManifest } from "@/modules/system-admin/module.manifest";
import { authzPoints, systemAdminPermissions } from "@/modules/system-admin/permissions";

/**
 * 三员角色在 bkn-safe 种子里的授权（grants.json，bkn-foundry PR #474 之后）。
 * 用种子的真实形态而非臆造数据，前端的显隐结论才等于线上结论。
 */
type SeedGrant = { operations: string[]; resource: { id: string; type: string } };

const SEEDED_GRANTS: Record<"admin" | "audit" | "security", SeedGrant[]> = {
  admin: [
    { resource: { type: "safe_admin", id: "console" }, operations: ["manage"] },
    {
      resource: { type: "admin-user", id: "*" },
      operations: ["view", "create", "edit", "delete", "toggle", "reset-password"],
    },
    {
      resource: { type: "admin-dept", id: "*" },
      operations: ["view", "create", "edit", "delete", "members"],
    },
  ],
  security: [
    { resource: { type: "safe_admin", id: "console" }, operations: ["manage"] },
    {
      resource: { type: "admin-role", id: "*" },
      operations: ["view", "create", "edit", "delete", "members", "permissions"],
    },
    { resource: { type: "admin-authz", id: "*" }, operations: ["view", "grant", "revoke"] },
    { resource: { type: "admin-user", id: "*" }, operations: ["view", "toggle", "reset-password"] },
    { resource: { type: "admin-dept", id: "*" }, operations: ["view"] },
  ],
  audit: [
    { resource: { type: "safe_admin", id: "console" }, operations: ["manage"] },
    { resource: { type: "admin-audit", id: "*" }, operations: ["view"] },
    { resource: { type: "admin-user", id: "*" }, operations: ["view"] },
    { resource: { type: "admin-dept", id: "*" }, operations: ["view"] },
    { resource: { type: "admin-role", id: "*" }, operations: ["view"] },
    { resource: { type: "admin-authz", id: "*" }, operations: ["view"] },
  ],
};

function permissionsOf(role: keyof typeof SEEDED_GRANTS): string[] {
  return deriveStudioPermissions(
    systemAdminModuleManifest.permissions,
    flattenSafeGrants(SEEDED_GRANTS[role]),
    false,
  );
}

const can = (permissions: string[], point: string) =>
  hasPermissions({ currentPermissions: permissions, requiredPermissions: point });

const canEnter = (permissions: string[], page: string[]) =>
  hasPermissions({ currentPermissions: permissions, mode: "any", requiredPermissions: page });

describe("授权面权限点", () => {
  it("每个动作点位都在 manifest 里声明，否则永远推导不出来", () => {
    for (const point of Object.values(authzPoints)) {
      expect(systemAdminModuleManifest.permissions).toContain(point);
    }
  });

  it("安全管理员：授权面读写全通", () => {
    const permissions = permissionsOf("security");
    expect(can(permissions, authzPoints.grant)).toBe(true);
    expect(can(permissions, authzPoints.revoke)).toBe(true);
    expect(can(permissions, authzPoints.roleMembers)).toBe(true);
    expect(can(permissions, authzPoints.rolePermissions)).toBe(true);
    expect(can(permissions, authzPoints.review)).toBe(true);
  });

  it("审计管理员：只读审查进得去，授权面写动作一个都看不到", () => {
    const permissions = permissionsOf("audit");
    expect(can(permissions, authzPoints.review)).toBe(true);
    expect(canEnter(permissions, systemAdminPermissions.authorizations)).toBe(true);
    expect(canEnter(permissions, systemAdminPermissions.roles)).toBe(true);

    expect(can(permissions, authzPoints.grant)).toBe(false);
    expect(can(permissions, authzPoints.revoke)).toBe(false);
    expect(can(permissions, authzPoints.roleMembers)).toBe(false);
    expect(can(permissions, authzPoints.rolePermissions)).toBe(false);
  });

  it("系统管理员：授权面既进不去也写不了", () => {
    const permissions = permissionsOf("admin");
    expect(canEnter(permissions, systemAdminPermissions.authorizations)).toBe(false);
    expect(canEnter(permissions, systemAdminPermissions.roles)).toBe(false);
    for (const point of Object.values(authzPoints)) {
      expect(can(permissions, point)).toBe(false);
    }
    // 用户与部门管理仍归系统管理员。
    expect(canEnter(permissions, systemAdminPermissions.users)).toBe(true);
  });

  it("角色成员与角色权限配置是两个点位，互不代开", () => {
    const membersOnly = deriveStudioPermissions(
      systemAdminModuleManifest.permissions,
      flattenSafeGrants([
        { resource: { type: "admin-role", id: "*" }, operations: ["view", "members"] },
      ]),
      false,
    );
    expect(can(membersOnly, authzPoints.roleMembers)).toBe(true);
    expect(can(membersOnly, authzPoints.rolePermissions)).toBe(false);

    const permissionsOnly = deriveStudioPermissions(
      systemAdminModuleManifest.permissions,
      flattenSafeGrants([
        { resource: { type: "admin-role", id: "*" }, operations: ["view", "permissions"] },
      ]),
      false,
    );
    expect(can(permissionsOnly, authzPoints.rolePermissions)).toBe(true);
    expect(can(permissionsOnly, authzPoints.roleMembers)).toBe(false);
  });

  it("对象授权与角色权限配置是两个点位：只持 admin-authz:grant 配不了角色权限", () => {
    const grantOnly = deriveStudioPermissions(
      systemAdminModuleManifest.permissions,
      flattenSafeGrants([
        { resource: { type: "admin-authz", id: "*" }, operations: ["view", "grant"] },
      ]),
      false,
    );
    expect(can(grantOnly, authzPoints.grant)).toBe(true);
    expect(can(grantOnly, authzPoints.revoke)).toBe(false);
    expect(can(grantOnly, authzPoints.rolePermissions)).toBe(false);
  });

  // 操作通配(`operations: ["*"]`)不在这里断言:它对 admin-* 点位既不可能来自接口
  // ——bkn-safe 的角色权限写入直接拒绝通配操作(rejectWildcardGrant)——超管也不走
  // 推导,fetchCurrentUser 在 is_admin 为真时直接放行全部已注册权限。
});

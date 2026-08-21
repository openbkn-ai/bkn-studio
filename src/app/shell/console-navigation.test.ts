/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  consoleNavigation,
  filterNavByPermission,
} from "@/app/shell/console-navigation";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";

const keys = (items: { key: string }[]) => items.map((item) => item.key);
const systemGroup = (items: ReturnType<typeof filterNavByPermission>) =>
  items.find((item) => item.key === "system-management");

describe("filterNavByPermission — 系统管理按功能独立授权", () => {
  it("仅持有系统管理权限的用户只显示首页和获授权的系统管理菜单", () => {
    const group = systemGroup(filterNavByPermission(consoleNavigation, []));
    expect(group).toBeUndefined();
    expect(keys(filterNavByPermission(consoleNavigation, []))).toEqual(["home"]);
  });

  it("超管(全部权限)→ 系统管理可见,4 个子项齐全", () => {
    const all = [
      ...systemAdminPermissions.users,
      ...systemAdminPermissions.roles,
      ...systemAdminPermissions.authorizations,
      ...systemAdminPermissions.license,
      ...systemAdminPermissions.audit,
    ];
    const group = systemGroup(filterNavByPermission(consoleNavigation, all));
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual(
      expect.arrayContaining([
        "user-management",
        "role-management",
        "authorization-management",
        "license-management",
        "log-management",
      ]),
    );
  });

  it("仅持有 admin-audit:view → 系统管理只包含原有管理审计日志", () => {
    const group = systemGroup(
      filterNavByPermission(consoleNavigation, ["admin-audit:view"]),
    );
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual(["log-management"]);
  });

  it("审计管理员的用户和部门只读权限 → 显示用户管理与审计日志", () => {
    const group = systemGroup(
      filterNavByPermission(consoleNavigation, [
        "admin-audit:view",
        "admin-user:view",
        "admin-dept:view",
      ]),
    );
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual(["user-management", "log-management"]);
  });

  it("审计角色不会看到未授予的业务菜单", () => {
    const filtered = filterNavByPermission(consoleNavigation, [
      "admin-audit:view",
      "admin-user:view",
      "admin-dept:view",
      "admin-role:view",
      "admin-authz:view",
    ]);

    expect(keys(filtered)).toEqual(["home", "system-management"]);
  });

  it("Catalog 查看权限显示数据连接和数据目录入口", () => {
    const filtered = filterNavByPermission(consoleNavigation, ["catalog:view_detail"]);
    const businessGroup = filtered.find(
      (item) => item.key === "general-business-knowledge-network",
    );

    expect(keys(filtered)).toContain("home");
    expect(keys(businessGroup?.children ?? [])).toEqual(["data-connection", "data-catalog"]);
  });

  it("领域知识网络拆分为管理和调用两个入口", () => {
    const filtered = filterNavByPermission(consoleNavigation, ["knowledge-network:view"]);
    const group = filtered.find((item) => item.key === "domain-knowledge-network");
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual([
      "domain-knowledge-network-management",
      "domain-knowledge-network-integration",
    ]);
  });
});

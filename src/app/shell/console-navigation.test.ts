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
    // 数据面(数据连接/数据目录/任务管理)不做前端权限管控,授权只能在企业档的对象授权页发放,
    // 挡在这里等于对社区版所有非超管永久隐藏。后端 403 才是判据。
    expect(keys(filterNavByPermission(consoleNavigation, []))).toEqual([
      "home",
      "general-business-knowledge-network",
    ]);
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

    expect(keys(filtered)).toEqual([
      "home",
      "general-business-knowledge-network",
      "system-management",
    ]);
  });

  it("数据面入口不看权限点:没有任何授权也能进,越权由后端拦", () => {
    const filtered = filterNavByPermission(consoleNavigation, []);
    const businessGroup = filtered.find(
      (item) => item.key === "general-business-knowledge-network",
    );

    expect(keys(filtered)).toContain("home");
    expect(keys(businessGroup?.children ?? [])).toEqual([
      "data-connection",
      "data-catalog",
      "index-builds",
    ]);
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

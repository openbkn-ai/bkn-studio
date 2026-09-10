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

describe("consoleNavigation — 主线菜单顺序", () => {
  it("将可观测性置于通用业务知识网络之后、模型管理之前", () => {
    const navigationKeys = keys(consoleNavigation);

    expect(navigationKeys.indexOf("general-business-knowledge-network")).toBeLessThan(
      navigationKeys.indexOf("observability"),
    );
    expect(navigationKeys.indexOf("observability")).toBeLessThan(
      navigationKeys.indexOf("model-resources"),
    );
  });
});

describe("filterNavByPermission — 系统管理按功能独立授权", () => {
  it("无权限用户显示首页和固定业务入口", () => {
    const group = systemGroup(filterNavByPermission(consoleNavigation, []));
    expect(group).toBeUndefined();
    expect(keys(filterNavByPermission(consoleNavigation, []))).toEqual([
      "home",
      "domain-knowledge-network",
      "execution-factory",
      "general-business-knowledge-network",
      "observability",
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

  it("审计角色仍可看到固定业务入口", () => {
    const filtered = filterNavByPermission(consoleNavigation, [
      "admin-audit:view",
      "admin-user:view",
      "admin-dept:view",
      "admin-role:view",
      "admin-authz:view",
    ]);

    expect(keys(filtered)).toEqual([
      "home",
      "domain-knowledge-network",
      "execution-factory",
      "general-business-knowledge-network",
      "observability",
      "system-management",
    ]);
  });

  it("数据资源知识网络入口不依赖菜单权限", () => {
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

  it("领域知识网络入口不依赖菜单权限", () => {
    const filtered = filterNavByPermission(consoleNavigation, []);
    const group = filtered.find((item) => item.key === "domain-knowledge-network");
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual([
      "domain-knowledge-network-management",
      "domain-knowledge-network-integration",
    ]);
  });

  it("执行单元管理入口不依赖菜单权限，沙箱运行时仍受限", () => {
    const filtered = filterNavByPermission(consoleNavigation, []);
    const executionFactory = filtered.find((item) => item.key === "execution-factory");

    expect(keys(executionFactory?.children ?? [])).toContain("execution-unit-management");
    expect(keys(executionFactory?.children ?? [])).not.toContain(
      "execution-factory-sandbox-runtime",
    );
  });

  it("可观测性设置仅对超级管理员显示", () => {
    const regular = filterNavByPermission(consoleNavigation, []);
    const superAdmin = filterNavByPermission(
      consoleNavigation,
      [],
      true,
    );
    const observabilityChildren = (items: ReturnType<typeof filterNavByPermission>) =>
      items.find((item) => item.key === "observability")?.children ?? [];

    expect(keys(observabilityChildren(regular))).not.toContain("observability-settings");
    expect(keys(observabilityChildren(superAdmin))).toContain("observability-settings");
  });
});

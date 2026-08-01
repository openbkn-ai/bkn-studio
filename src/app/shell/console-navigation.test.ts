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
  it("普通用户可进入 BKN Trace，记录正文由服务端访问画像裁决", () => {
    const group = systemGroup(filterNavByPermission(consoleNavigation, []));
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual(["bkn-trace"]);
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

  it("仅持有 admin-audit:view → 系统管理包含 BKN Trace 和日志管理", () => {
    const group = systemGroup(
      filterNavByPermission(consoleNavigation, ["admin-audit:view"]),
    );
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual([
      "bkn-trace",
      "log-management",
    ]);
  });

  it("非系统类菜单不受权限过滤影响", () => {
    const filtered = filterNavByPermission(consoleNavigation, []);
    expect(keys(filtered)).toContain("general-business-knowledge-network");
  });

  it("领域知识网络拆分为管理和调用两个入口", () => {
    const filtered = filterNavByPermission(consoleNavigation, []);
    const group = filtered.find((item) => item.key === "domain-knowledge-network");
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual([
      "domain-knowledge-network-management",
      "domain-knowledge-network-integration",
    ]);
  });
});

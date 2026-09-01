/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  getRoleDutyCategory,
  hasThreeAdminConflict,
  isAssignableRole,
  roleDescription,
  roleSearchText,
  resolveBuiltinRoleKey,
  threeAdminConflictLabels,
} from "@/modules/system-admin/utils/role-catalog";

describe("role-catalog", () => {
  it("classifies the six default Studio roles", () => {
    expect(getRoleDutyCategory({ name: "super_admin" })).toBe("super-admin");
    expect(getRoleDutyCategory({ name: "admin" })).toBe("three-admin");
    expect(getRoleDutyCategory({ name: "security" })).toBe("three-admin");
    expect(getRoleDutyCategory({ name: "audit" })).toBe("three-admin");
    expect(getRoleDutyCategory({ name: "network_builder" })).toBe("business");
    expect(getRoleDutyCategory({ name: "normal_user" })).toBe("normal-user");
  });

  it("recognizes old system display names as default role aliases", () => {
    expect(resolveBuiltinRoleKey({ name: "系统管理员", builtin: true })).toBe("admin");
    expect(resolveBuiltinRoleKey({ name: "安全管理员", builtin: true })).toBe("security");
    expect(resolveBuiltinRoleKey({ name: "审计管理员", builtin: true })).toBe("audit");
    expect(resolveBuiltinRoleKey({ name: "系统管理员", builtin: false })).toBeNull();
  });

  it("keeps super admin out of normal role assignment", () => {
    expect(isAssignableRole({ name: "super_admin" })).toBe(false);
    expect(isAssignableRole({ name: "network_builder" })).toBe(true);
  });

  it("localizes built-in descriptions while preserving custom descriptions", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.exists("systemAdmin.roleCatalog.builtin.adminDescription", { lng: "en-US" })).toBe(true);
    expect(roleDescription({ name: "super_admin", description: "中文后端描述", builtin: true })).toBe(
      "Built-in hidden and controlled role with full platform permissions.",
    );
    expect(roleDescription({ name: "系统管理员", description: "用户自定义描述", builtin: false })).toBe("用户自定义描述");
    expect(roleSearchText({ name: "admin", description: "backend description", builtin: true })).toContain(
      "operations",
    );

    await i18n.changeLanguage("zh-CN");
    expect(roleDescription({ name: "super_admin", description: "中文后端描述", builtin: true })).toBe(
      "内置隐藏 / 受控角色，拥有平台全量权限。",
    );
    expect(roleSearchText({ name: "admin", description: "backend description", builtin: true })).toContain("运维");
  });

  it("detects multiple three-admin roles on the same account", async () => {
    await i18n.changeLanguage("zh-CN");

    expect(hasThreeAdminConflict([{ name: "admin" }, { name: "security" }])).toBe(true);
    expect(hasThreeAdminConflict([{ name: "audit" }, { name: "normal_user" }])).toBe(false);
    expect(
      hasThreeAdminConflict([{ name: "admin" }, { name: "legacy_system_role", source: "system" }]),
    ).toBe(false);
    expect(threeAdminConflictLabels([{ name: "admin" }, { name: "security" }])).toEqual([
      "系统管理员",
      "安全管理员",
    ]);
  });
});

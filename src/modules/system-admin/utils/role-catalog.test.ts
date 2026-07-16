/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  getRoleDutyCategory,
  hasThreeAdminConflict,
  isAssignableRole,
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
    expect(resolveBuiltinRoleKey({ name: "系统管理员" })).toBe("admin");
    expect(resolveBuiltinRoleKey({ name: "安全管理员" })).toBe("security");
    expect(resolveBuiltinRoleKey({ name: "审计管理员" })).toBe("audit");
  });

  it("keeps super admin out of normal role assignment", () => {
    expect(isAssignableRole({ name: "super_admin" })).toBe(false);
    expect(isAssignableRole({ name: "network_builder" })).toBe(true);
  });

  it("detects multiple three-admin roles on the same account", () => {
    expect(hasThreeAdminConflict([{ name: "admin" }, { name: "security" }])).toBe(true);
    expect(hasThreeAdminConflict([{ name: "audit" }, { name: "normal_user" }])).toBe(false);
    expect(hasThreeAdminConflict([{ name: "admin" }, { name: "legacy_system_role", source: "system" }])).toBe(
      false,
    );
    expect(threeAdminConflictLabels([{ name: "admin" }, { name: "security" }])).toEqual([
      "系统管理员",
      "安全管理员",
    ]);
  });
});

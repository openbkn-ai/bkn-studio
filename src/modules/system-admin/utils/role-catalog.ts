/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { AdminRole } from "@/modules/system-admin/types/admin";

export type BuiltinRoleKey =
  | "super_admin"
  | "admin"
  | "security"
  | "audit"
  | "network_builder"
  | "normal_user";

export type RoleDutyCategory = "super-admin" | "three-admin" | "business" | "normal-user" | "custom";

type RoleMeta = {
  category: RoleDutyCategory;
  label: string;
};

export const BUILTIN_ROLE_META: Record<BuiltinRoleKey, RoleMeta> = {
  super_admin: { category: "super-admin", label: "超级管理员" },
  admin: { category: "three-admin", label: "系统管理员" },
  security: { category: "three-admin", label: "安全管理员" },
  audit: { category: "three-admin", label: "审计管理员" },
  network_builder: { category: "business", label: "业务网络构建者" },
  normal_user: { category: "normal-user", label: "普通用户" },
};

const ROLE_NAME_ALIASES: Record<string, BuiltinRoleKey> = {
  超级管理员: "super_admin",
  系统管理员: "admin",
  安全管理员: "security",
  审计管理员: "audit",
  业务网络构建者: "network_builder",
  普通用户: "normal_user",
};

export function resolveBuiltinRoleKey(role: Pick<AdminRole, "name">): BuiltinRoleKey | null {
  if (role.name in BUILTIN_ROLE_META) {
    return role.name as BuiltinRoleKey;
  }
  return ROLE_NAME_ALIASES[role.name] ?? null;
}

export function getRoleDutyCategory(role: Pick<AdminRole, "name" | "source">): RoleDutyCategory {
  const builtinKey = resolveBuiltinRoleKey(role);
  if (builtinKey) {
    return BUILTIN_ROLE_META[builtinKey].category;
  }
  return role.source === "system" ? "three-admin" : "custom";
}

export function isSuperAdminRole(role: Pick<AdminRole, "name">): boolean {
  return resolveBuiltinRoleKey(role) === "super_admin";
}

export function isThreeAdminRole(role: Pick<AdminRole, "name" | "source">): boolean {
  return getRoleDutyCategory(role) === "three-admin";
}

export function isAssignableRole(role: Pick<AdminRole, "name">): boolean {
  return !isSuperAdminRole(role);
}

export function hasThreeAdminConflict(roles: Pick<AdminRole, "name" | "source">[]): boolean {
  return roles.filter(isThreeAdminRole).length > 1;
}

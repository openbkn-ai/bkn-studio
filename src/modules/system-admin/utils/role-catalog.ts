/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";
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

const BUILTIN_ROLE_FALLBACK_DESCRIPTIONS: Record<BuiltinRoleKey, string> = {
  admin: "System administrator for operations, users, and departments.",
  audit: "Audit administrator for audit logs, permission review, and admin behavior supervision.",
  network_builder: "Business network builder for data, knowledge, models, and execution factory assets.",
  normal_user: "Regular user for viewing, querying, executing, and invoking module capabilities.",
  security: "Security administrator for roles, authorization, and account security.",
  super_admin: "Built-in hidden and controlled role with full platform permissions.",
};

const BUILTIN_ROLE_FALLBACK_LABELS: Record<BuiltinRoleKey, string> = {
  admin: "System administrator",
  audit: "Audit administrator",
  network_builder: "Business network builder",
  normal_user: "Normal user",
  security: "Security administrator",
  super_admin: "Super administrator",
};

export const BUILTIN_ROLE_META: Record<BuiltinRoleKey, RoleMeta> = {
  super_admin: { category: "super-admin", label: builtinRoleLabel("super_admin") },
  admin: { category: "three-admin", label: builtinRoleLabel("admin") },
  security: { category: "three-admin", label: builtinRoleLabel("security") },
  audit: { category: "three-admin", label: builtinRoleLabel("audit") },
  network_builder: { category: "business", label: builtinRoleLabel("network_builder") },
  normal_user: { category: "normal-user", label: builtinRoleLabel("normal_user") },
};

const ROLE_NAME_ALIASES: Record<string, BuiltinRoleKey> = {
  "\u5ba1\u8ba1\u7ba1\u7406\u5458": "audit",
  "\u5b89\u5168\u7ba1\u7406\u5458": "security",
  "\u666e\u901a\u7528\u6237": "normal_user",
  "\u4e1a\u52a1\u7f51\u7edc\u6784\u5efa\u8005": "network_builder",
  "\u7cfb\u7edf\u7ba1\u7406\u5458": "admin",
  "\u8d85\u7ea7\u7ba1\u7406\u5458": "super_admin",
};

export function builtinRoleLabel(key: BuiltinRoleKey): string {
  return i18n.t(`systemAdmin.roleCatalog.builtin.${key}`, {
    defaultValue: BUILTIN_ROLE_FALLBACK_LABELS[key],
  });
}

export function builtinRoleDescription(key: BuiltinRoleKey): string {
  return i18n.t(`systemAdmin.roleCatalog.builtin.${key}Description`, {
    defaultValue: BUILTIN_ROLE_FALLBACK_DESCRIPTIONS[key],
  });
}

export function resolveBuiltinRoleKey(role: Pick<AdminRole, "name">): BuiltinRoleKey | null {
  if (role.name in BUILTIN_ROLE_META) {
    return role.name as BuiltinRoleKey;
  }
  return ROLE_NAME_ALIASES[role.name] ?? null;
}

export function roleDescription(role: Pick<AdminRole, "name" | "description">): string {
  const builtinKey = resolveBuiltinRoleKey(role);
  return builtinKey ? builtinRoleDescription(builtinKey) : role.description;
}

export function getRoleDutyCategory(role: Pick<AdminRole, "name" | "source">): RoleDutyCategory {
  const builtinKey = resolveBuiltinRoleKey(role);
  if (builtinKey) {
    return BUILTIN_ROLE_META[builtinKey].category;
  }
  return "custom";
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

export function threeAdminConflictLabels(roles: Pick<AdminRole, "name" | "source">[]): string[] {
  return roles
    .filter(isThreeAdminRole)
    .map((role) => {
      const builtinKey = resolveBuiltinRoleKey(role);
      return builtinKey ? builtinRoleLabel(builtinKey) : role.name;
    });
}

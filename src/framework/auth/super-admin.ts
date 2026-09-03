/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * `/me` may return either the stable role key or the legacy localized display name.
 * `is_admin` includes the three administrator roles and must not be used here.
 */
export function isSuperAdmin(roles: readonly string[]): boolean {
  return roles.some((role) => role === "super_admin" || role === "超级管理员");
}

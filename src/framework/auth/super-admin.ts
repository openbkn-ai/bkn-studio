/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** `is_admin` includes the three administrator roles; only this role is platform super admin. */
export function isSuperAdmin(roles: readonly string[]): boolean {
  return roles.includes("super_admin");
}

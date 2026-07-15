/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Role names that unlock model-resources admin-only UI, such as the quota switch. */
const ADMIN_ROLE_KEYS = new Set([
  "admin",
  "super_admin",
  "\u7cfb\u7edf\u7ba1\u7406\u5458",
  "\u8d85\u7ea7\u7ba1\u7406\u5458",
]);

/**
 * Whether the caller's role list implies platform/system admin for UI gating.
 * Prefer pairing with `/me/permissions`.is_admin when available because role strings
 * alone miss accounts that are admin by identity but not listed as `"admin"`.
 */
export function hasModelResourcesAdminRole(roles: string[] | undefined | null): boolean {
  if (!roles?.length) {
    return false;
  }

  return roles.some((role) => ADMIN_ROLE_KEYS.has(role));
}

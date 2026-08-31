/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  deriveStudioPermissions,
  flattenSafeGrants,
} from "@/framework/auth/permission-map";
import { http } from "@/framework/request/http";
import { defaultDevPermissions } from "@/framework/runtime/module-manifests";
import type { RuntimeUser } from "@/framework/runtime/types";

// GET /api/safe/v1/me — caller identity and roles (token-gated by RequireUser).
type MeResponse = {
  account?: string;
  account_type?: string;
  departments?: string[];
  email?: string;
  id?: string;
  name?: string;
  role_ids?: string[];
  roles?: string[];
};

// GET /api/safe/v1/me/permissions — role-inherited grants, type:op pairs.
// instance_operations appears only for scope=type and aggregates operations held on at least one
// instance but not at the type level (see bkn-safe authz.typeWideGrants).
type MePermissionsResponse = {
  is_admin?: boolean;
  permissions?: {
    instance_operations?: string[];
    operations?: string[];
    resource?: { id?: string; type?: string };
  }[];
};

/**
 * Fallback user with no identity or permissions. Use it whenever a permission source is
 * unavailable: fail closed by under-granting rather than over-granting. Never fall back to the
 * development default user with all permissions (see dev-profile), or transient /me/permissions
 * failures would expose all system-admin entries to regular users (#176).
 */
export const anonymousRuntimeUser: RuntimeUser = {
  id: null,
  isAdmin: false,
  name: null,
  permissions: [],
  roles: [],
};

/**
 * Loads the current user's identity and permissions after login and assembles a RuntimeUser.
 *
 * bkn-safe emits `<resource_type>:<operation>`, which uses a different naming scheme than module
 * manifest permissions and must be translated through permission-map.
 *
 * Full access is determined by a resource wildcard grant (`*:*`), not by `is_admin`; they are
 * not equivalent. is_admin comes from backend CanAdmin and checks safe_admin:console:manage,
 * meaning access to management APIs. System, security, and audit administrators all hold it. If
 * it granted every permission, point-level guards would fail for all three roles. Only super
 * administrators receive a resource wildcard, compacted in /me/permissions to `{type:"*",id:"*",ops:["*"]}`.
 *
 * is_admin is retained for identity/UI decisions, but must not expand the permission set: all
 * three administrator roles receive it, while only a resource wildcard denotes super-admin.
 *
 * The two requests degrade independently through allSettled: failing to load identity does not
 * affect permissions, and failing to load permissions yields no permissions. Never grant on a
 * permissions-load failure, preventing a transient error from retaining the all-permission default user.
 */
export async function fetchCurrentUser(): Promise<RuntimeUser> {
  const [meResult, permResult] = await Promise.allSettled([
    http.get<MeResponse>("/safe/v1/me", { skipErrorToast: true }),
    // scope=type is sufficient at startup to render navigation and menus. It reduces responses
    // from linear growth with object grants to type-scale size. The backend aggregates operations
    // outside type-level grants into instance_operations, and flattenSafeGrants includes them, so
    // entry visibility is unaffected. Older backends ignore this unknown parameter, allowing independent rollout.
    http.get<MePermissionsResponse>("/safe/v1/me/permissions", {
      params: { scope: "type" },
      skipErrorToast: true,
    }),
  ]);

  const me: MeResponse = meResult.status === "fulfilled" ? meResult.value.data : {};
  // Permission endpoint failure produces an empty grant set and therefore no permissions, rather than retaining the caller's all-permission default.
  const perm: MePermissionsResponse =
    permResult.status === "fulfilled" ? permResult.value.data : {};

  const safeGrants = flattenSafeGrants(perm.permissions);
  const isAdmin = Boolean(perm.is_admin);
  // A resource wildcard means super administrator and covers every operation on every resource type, so per-point derivation is unnecessary.
  const hasResourceWildcard = safeGrants.has("*:*");

  return {
    id: me.id ?? null,
    isAdmin,
    name: me.name || me.account || me.id || null,
    roles: me.roles ?? [],
    permissions: hasResourceWildcard
      ? [...defaultDevPermissions]
      : deriveStudioPermissions(defaultDevPermissions, safeGrants, isAdmin),
  };
}

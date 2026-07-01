/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

export type AuthorizationResource = {
  id: string;
  type: string;
};

type ResourceOperationItem = {
  id: string;
  operation?: string[];
};

export type AccessorPermission = {
  type: string;
  id: string;
  operations: string[];
};

export type MyPermissions = {
  isAdmin: boolean;
  permissions: AccessorPermission[];
};

/**
 * Ops surfaced to an admin so menu/button visibility is complete even when the
 * permission list is grant-driven. The backend still enforces every write.
 */
const ADMIN_OPERATIONS = [
  "create",
  "delete",
  "display",
  "execute",
  "modify",
  "authorize",
];

type MePermissionsResponse = {
  is_admin?: boolean;
  permissions?: {
    resource?: { type?: string; id?: string };
    operations?: string[];
  }[];
};

/**
 * Self-service permission read — `/api/safe/v1/me/permissions`.
 *
 * This is the gateway-exposed, token-gated bkn-safe endpoint frontends are meant
 * to call (accessor derived from the bearer token). The `/authz/*` family is an
 * internal, tokenless ClusterIP API and is NOT reachable through the gateway, so
 * UI permission checks must go through `/me/*`, not `/authz/operations`.
 *
 * Returns `is_admin` plus the accessor's grants (role-inherited included);
 * type-wide grants keep the id `"*"`.
 */
export async function getMyPermissions(): Promise<MyPermissions> {
  const response = await http.get<MePermissionsResponse>("/safe/v1/me/permissions");

  return {
    isAdmin: Boolean(response.data?.is_admin),
    permissions: (response.data?.permissions ?? []).map((item) => ({
      type: item.resource?.type ?? "",
      id: item.resource?.id ?? "",
      operations: item.operations ?? [],
    })),
  };
}

/**
 * Ops the accessor may perform on a single resource, derived from
 * `/me/permissions`: a type-wide grant (id `"*"`) applies to every instance, so
 * its operations union with any exact-id grant.
 */
function operationsFor(me: MyPermissions, type: string, id: string): string[] {
  if (me.isAdmin) {
    return [...ADMIN_OPERATIONS];
  }

  const ops = new Set<string>();
  for (const permission of me.permissions) {
    if (permission.type !== type) {
      continue;
    }
    if (permission.id === id || permission.id === "*") {
      permission.operations.forEach((op) => ops.add(op));
    }
  }

  return [...ops];
}

/**
 * Back-compat helper for the existing callers: resolve the ops for each
 * requested resource from a single `/me/permissions` read.
 */
export async function getResourceOperations(
  resources: AuthorizationResource[],
): Promise<ResourceOperationItem[]> {
  if (resources.length === 0) {
    return [];
  }

  const me = await getMyPermissions();

  return resources.map((resource) => ({
    id: resource.id,
    operation: operationsFor(me, resource.type, resource.id),
  }));
}

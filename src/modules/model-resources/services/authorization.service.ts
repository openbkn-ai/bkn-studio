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
 * Complete bkn-safe operation vocabulary. It expands global and type-level `"*"` grants so
 * grant-driven button visibility is complete; the backend
 * still enforces authorization per operation.
 *
 * It must include every operation that any consumer may check with `includes(op)`, or a `"*"`
 * grantee would see fewer controls. `display` is the model-manager read operation issued by the
 * Studio authorization UI and listed in bkn-safe's resource catalog.
 */
const ADMIN_OPERATIONS = [
  "create",
  "delete",
  "modify",
  "display",
  "view",
  "view_detail",
  "execute",
  "authorize",
  "publish",
  "unpublish",
  "public_access",
  "task_manage",
];

/**
 * Maximum instance IDs in one scoped query. The BKN gateway limits URL length, so large lists
 * must batch comma-separated IDs and union results. About 50 UUIDs of 36 characters use 1.8 KB,
 * leaving sufficient gateway headroom.
 */
const SCOPED_ID_BATCH = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

type MePermissionsResponse = {
  is_admin?: boolean;
  permissions?: {
    resource?: { type?: string; id?: string };
    operations?: string[];
  }[];
};

/**
 * Ops the accessor may perform on a single resource, per the folded
 * `/me/permissions` contract. An instance row carries only the *delta* over its
 * type-level row, so the effective set is the UNION of the type-wide (`id:"*"`)
 * row and the exact-id row. A wildcard row (`type:"*"` with op `"*"`) or a `"*"`
 * operation means "all ops" — expanded to ADMIN_OPERATIONS for display.
 */
function operationsFor(me: MyPermissions, type: string, id: string): string[] {
  // Global wildcard, equivalent to super admin: permits every operation on every resource and short-circuits.
  if (me.permissions.some((p) => p.type === "*" && p.operations.includes("*"))) {
    return [...ADMIN_OPERATIONS];
  }

  const ops = new Set<string>();
  for (const permission of me.permissions) {
    if (permission.type !== type) {
      continue;
    }
    // Union the type-level row (id:"*") with this instance's exception row, which contains only deltas.
    if (permission.id === id || permission.id === "*") {
      permission.operations.forEach((op) => ops.add(op));
    }
  }

  // A type-level "*" operation means every operation for that type.
  if (ops.has("*")) {
    return [...ADMIN_OPERATIONS];
  }

  return [...ops];
}

/**
 * Loads effective grants by type, optionally narrowed to selected instances. Under the compact
 * contract, the type-level row (id:"*") always returns; instance rows appear only for operations
 * beyond type-level access and contain only deltas, so authorization uses the operationsFor union.
 *
 * `"*"` is not an instance ID; its permissions are covered by the type-level row and need no resource_id.
 */
async function fetchScopedPermissions(
  type: string,
  ids: string[],
): Promise<MyPermissions> {
  const instanceIds = [...new Set(ids.filter((id) => id && id !== "*"))];
  // Always make one request with only resource_type to retrieve the type-level row. When there
  // are many instances, add resource_id chunks per SCOPED_ID_BATCH to avoid gateway URL limits.
  const batches = instanceIds.length > 0 ? chunk(instanceIds, SCOPED_ID_BATCH) : [[]];

  const responses = await Promise.all(
    batches.map((batch) => {
      const params: Record<string, string> = { resource_type: type };
      if (batch.length > 0) {
        params.resource_id = batch.join(",");
      }
      return http.get<MePermissionsResponse>("/safe/v1/me/permissions", { params });
    }),
  );

  // Every batch returns the type-level row (id:"*"); operationsFor's Set deduplicates it during union.
  return {
    isAdmin: responses.some((response) => Boolean(response.data?.is_admin)),
    permissions: responses.flatMap((response) =>
      (response.data?.permissions ?? []).map((item) => ({
        type: item.resource?.type ?? "",
        id: item.resource?.id ?? "",
        operations: item.operations ?? [],
      })),
    ),
  };
}

/**
 * Operations available to the current account for each resource. Run one scoped query per type
 * instead of loading all ACLs and filtering in the frontend; each final operation set is the union
 * of its type-level row and instance exception row.
 */
export async function getResourceOperations(
  resources: AuthorizationResource[],
): Promise<ResourceOperationItem[]> {
  if (resources.length === 0) {
    return [];
  }

  const idsByType = new Map<string, string[]>();
  for (const resource of resources) {
    const ids = idsByType.get(resource.type) ?? [];
    ids.push(resource.id);
    idsByType.set(resource.type, ids);
  }

  const permsByType = new Map<string, MyPermissions>();
  await Promise.all(
    [...idsByType].map(async ([type, ids]) => {
      permsByType.set(type, await fetchScopedPermissions(type, ids));
    }),
  );

  return resources.map((resource) => {
    const me = permsByType.get(resource.type);
    return {
      id: resource.id,
      operation: me ? operationsFor(me, resource.type, resource.id) : [],
    };
  });
}

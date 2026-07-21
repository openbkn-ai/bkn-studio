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
 * Ops the accessor may perform on a single resource, per the folded
 * `/me/permissions` contract. An instance row carries only the *delta* over its
 * type-level row, so the effective set is the UNION of the type-wide (`id:"*"`)
 * row and the exact-id row. A wildcard row (`type:"*"` with op `"*"`) or a `"*"`
 * operation means "all ops" — expanded to ADMIN_OPERATIONS for display.
 */
function operationsFor(me: MyPermissions, type: string, id: string): string[] {
  if (me.isAdmin) {
    return [...ADMIN_OPERATIONS];
  }

  // 通配行(超管等价):对一切资源可做一切,出现即短路。
  if (me.permissions.some((p) => p.type === "*" && p.operations.includes("*"))) {
    return [...ADMIN_OPERATIONS];
  }

  const ops = new Set<string>();
  for (const permission of me.permissions) {
    if (permission.type !== type) {
      continue;
    }
    // union:类型级行(id:"*")与该实例例外行(仅含增量)都并入。
    if (permission.id === id || permission.id === "*") {
      permission.operations.forEach((op) => ops.add(op));
    }
  }

  // 类型级 "*" 操作 = 该类型全部操作。
  if (ops.has("*")) {
    return [...ADMIN_OPERATIONS];
  }

  return [...ops];
}

/**
 * 按类型拉取「有效授权」,可选收窄到指定实例。折叠契约下类型级行(id:"*")
 * 总会返回;实例行只在操作超出类型级时出现,且仅含增量 —— 判权靠 operationsFor union。
 *
 * `"*"` 不是实例 id,其权限由类型级行覆盖,无需下发 resource_id。
 */
async function fetchScopedPermissions(
  type: string,
  ids: string[],
): Promise<MyPermissions> {
  const params: Record<string, string> = { resource_type: type };
  const instanceIds = ids.filter((id) => id && id !== "*");
  if (instanceIds.length > 0) {
    params.resource_id = instanceIds.join(",");
  }

  const response = await http.get<MePermissionsResponse>(
    "/safe/v1/me/permissions",
    { params },
  );

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
 * 各资源当前账号可执行的操作。按类型分组做 scoped 查询(每型一次),
 * 不再拉全量 ACL 再前端过滤;每个资源的最终操作集为类型级行与实例例外行的 union。
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

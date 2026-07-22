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
 * 完整的 bkn-safe 操作词表 —— 作为「全操作」(`is_admin`、通配行、类型级 `"*"`)
 * 的展开目标,让按钮显隐在 grant 驱动下也完整。后端仍逐操作强制鉴权。
 *
 * 必须覆盖任意消费方可能 `includes(op)` 的每一个操作,否则 `"*"` 授权者反而少显示。
 * 取自 bkn-safe 实际下发词表(见 permission-map.test.ts 的真实 /me/permissions 响应);
 * 早前的 `"display"` 后端并不存在,已剔除,并补齐 view/view_detail/publish 等。
 */
const ADMIN_OPERATIONS = [
  "create",
  "delete",
  "modify",
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
 * 单次 scoped 查询携带的实例 id 数目上限。bkn 网关对 URL 长度有限制,
 * 大列表(几十上百实例)把 id 逗号拼进 query 会超限,故按此分批多发再并集。
 * UUID(~36 char)× 50 ≈ 1.8KB resource_id,留足网关余量。
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
  const instanceIds = [...new Set(ids.filter((id) => id && id !== "*"))];
  // 至少发一次(仅 resource_type)以取类型级行;实例过多时按 SCOPED_ID_BATCH 分批,
  // 每批各带一段 resource_id,避免单条 URL 超网关长度限制。
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

  // 各批都会带回类型级行(id:"*"),并集时靠 operationsFor 的 Set 去重,无害。
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

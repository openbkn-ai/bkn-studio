/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  listDomainObjects,
  resolveGrantNames,
} from "@/modules/system-admin/services/authz-objects.service";
import type {
  AuthorizableObject,
  AuthzSummary,
  ObjectGrant,
  ObjectGrantInput,
  ObjectGrantListResult,
  ObjectGrantQuery,
} from "@/modules/system-admin/types/authz";

/**
 * Object-level authorization service for bkn-safe `/api/safe/v1/admin/object-grants`.
 * Uses frontend mock data by default; `VITE_USE_MOCK=false` calls the real backend.
 * See bkn-foundry/bkn-safe/docs/frontend-object-grants-integration.md.
 *
 * - Grant model: {accessor_id, resource:{type,id}, operations[]}; grantees are users.
 * - POST replaces the whole operation set; operations must be non-empty and resource.id concrete.
 * - DELETE revokes one user's grant on one resource.
 * - bkn-safe does not store resource names; real mode resolves them from domain services.
 */
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const ADMIN = "/safe/v1/admin";

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

// ---- mock store -------------------------------------------------------------

// Demo authorizable objects. Real mode loads them from domain services.
const authzObjects: AuthorizableObject[] = [
  { type: "knowledge_network", id: "kn-customer-360", name: "Customer 360 Knowledge Network", sub: "customer" },
  { type: "knowledge_network", id: "kn-finance-risk", name: "Financial Risk Knowledge Network", sub: "finance" },
  { type: "catalog", id: "cat-customer-mysql", name: "Customer Master Data - MySQL", sub: "mysql" },
  { type: "catalog", id: "cat-events-kafka", name: "Behavior Events - Kafka", sub: "kafka" },
  { type: "small_model", id: "bge-m3", name: "BGE-M3", sub: "bge · embedding" },
  { type: "large_model", id: "qwen3-72b", name: "Qwen3-72B-Instruct", sub: "qwen · chat" },
  { type: "operator", id: "op-text-clean", name: "Text Cleaning Operator", sub: "transform" },
  { type: "tool_box", id: "tb-web-search", name: "Web Search Toolbox", sub: "toolbox" },
  { type: "mcp", id: "mcp-filesystem", name: "Filesystem MCP", sub: "mcp" },
  { type: "skill", id: "sk-sql-gen", name: "SQL Generation Skill", sub: "skill" },
];

const objMeta = (type: string, id: string) =>
  authzObjects.find((item) => item.type === type && item.id === id);

const seed = (
  objType: string,
  objId: string,
  accessorId: string,
  operations: string[],
): ObjectGrant => {
  const meta = objMeta(objType, objId);
  return { accessorId, objType, objId, objName: meta?.name ?? objId, objSub: meta?.sub, operations };
};

let grants: ObjectGrant[] = [
  seed("knowledge_network", "kn-customer-360", "u-li", ["view_detail", "modify", "data_query"]),
  seed("knowledge_network", "kn-finance-risk", "u-li", ["view_detail"]),
  seed("catalog", "cat-customer-mysql", "u-li", ["view_detail", "modify", "task_manage"]),
  seed("catalog", "cat-customer-mysql", "u-chen", ["view_detail"]),
  seed("small_model", "bge-m3", "u-chen", ["display", "execute"]),
  seed("large_model", "qwen3-72b", "u-chen", ["display", "execute"]),
  seed("operator", "op-text-clean", "u-wang", ["view", "execute"]),
  seed("tool_box", "tb-web-search", "u-wang", ["view", "execute", "publish"]),
  seed("mcp", "mcp-filesystem", "u-wang", ["view", "execute"]),
  seed("skill", "sk-sql-gen", "u-chen", ["view", "execute"]),
];

const sameTarget = (
  grant: ObjectGrant,
  input: Pick<ObjectGrantInput, "accessorId" | "objType" | "objId">,
) => grant.accessorId === input.accessorId && grant.objType === input.objType && grant.objId === input.objId;

const clone = (grant: ObjectGrant): ObjectGrant => ({ ...grant, operations: [...grant.operations] });

// ---- reads ------------------------------------------------------------------

function filterMockGrants(query: ObjectGrantQuery): ObjectGrant[] {
  const search = query.search?.trim().toLowerCase();
  return grants.filter((grant) => {
    if (query.accessorId && grant.accessorId !== query.accessorId) {
      return false;
    }
    if (query.resourceType && grant.objType !== query.resourceType) {
      return false;
    }
    if (query.resourceId && grant.objId !== query.resourceId) {
      return false;
    }
    if (search) {
      const haystack = [grant.objName, grant.objSub, grant.objId, grant.objType, grant.accessorId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

export async function listObjectGrantsPage(
  query: ObjectGrantQuery = {},
  options: { resolveNames?: boolean } = {},
): Promise<ObjectGrantListResult> {
  if (useMock) {
    const filtered = filterMockGrants(query).map(clone);
    const total = filtered.length;
    const summary = summarizeGrants(filtered);
    const offset = query.offset ?? 0;
    const limit = query.limit;
    const page =
      limit === undefined ? filtered : filtered.slice(offset, offset + Math.max(limit, 0));
    return {
      grants: page,
      total,
      summary: query.includeSummary ? summary : undefined,
    };
  }

  const params = new URLSearchParams();
  if (query.accessorId) {
    params.set("accessor_id", query.accessorId);
  }
  if (query.resourceType) {
    params.set("resource_type", query.resourceType);
  }
  if (query.resourceId) {
    params.set("resource_id", query.resourceId);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.includeSummary) {
    params.set("include_summary", "true");
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await http.get<{
    entries?: BackendEntry[];
    total?: number;
    summary?: AuthzSummary;
  }>(`${ADMIN}/object-grants${suffix}`);
  const mapped = (response.data.entries ?? []).map(mapEntry);
  // Resolve names by default for drawers. List pages can render ids first and hydrate names later.
  const grants = options.resolveNames === false ? mapped : await resolveGrantNames(mapped);
  return {
    grants,
    total: response.data.total ?? grants.length,
    summary: response.data.summary,
  };
}

export async function listObjectGrants(query: ObjectGrantQuery = {}): Promise<ObjectGrant[]> {
  const { grants: grantList } = await listObjectGrantsPage(query);
  return grantList;
}

/** One grouped row: an object group or grantee group aggregate. */
export type AuthzGroup = {
  objType?: string;
  objId?: string;
  objName?: string;
  accessorId?: string;
  /** Object mode counts grantees; grantee mode counts objects. */
  count: number;
  /** Merged operation set for this group. */
  operations: string[];
};

/**
 * Data source for grouped views. The backend aggregates by object or grantee and
 * paginates results, so the frontend no longer loads all grants for client grouping.
 */
export async function listObjectGroups(
  groupBy: "object" | "grantee",
  query: { offset?: number; limit?: number; search?: string; resourceType?: string } = {},
): Promise<{ groups: AuthzGroup[]; total: number }> {
  if (useMock) {
    const filtered = filterMockGrants({ search: query.search, resourceType: query.resourceType });
    const map = new Map<string, AuthzGroup>();
    for (const grant of filtered) {
      const key = groupBy === "object" ? `${grant.objType}::${grant.objId}` : grant.accessorId;
      const row =
        map.get(key) ??
        (groupBy === "object"
          ? { objType: grant.objType, objId: grant.objId, objName: grant.objName, count: 0, operations: [] }
          : { accessorId: grant.accessorId, count: 0, operations: [] });
      row.count += 1;
      row.operations = [...new Set([...row.operations, ...grant.operations])];
      map.set(key, row);
    }
    const all = [...map.values()];
    const offset = query.offset ?? 0;
    const limit = query.limit;
    const page = limit === undefined ? all : all.slice(offset, offset + Math.max(limit, 0));
    return wait({ groups: page, total: all.length });
  }

  const params = new URLSearchParams();
  params.set("group_by", groupBy);
  if (query.resourceType) {
    params.set("resource_type", query.resourceType);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  const response = await http.get<{
    groups?: {
      object?: { type?: string; id?: string; name?: string };
      accessor_id?: string;
      grantee_count?: number;
      object_count?: number;
      operations?: string[];
    }[];
    total?: number;
  }>(`${ADMIN}/object-grants?${params.toString()}`);

  const groups: AuthzGroup[] = (response.data.groups ?? []).map((raw) =>
    groupBy === "object"
      ? {
          objType: raw.object?.type ?? "",
          objId: raw.object?.id ?? "",
          objName: raw.object?.name || raw.object?.id || "",
          count: raw.grantee_count ?? 0,
          operations: raw.operations ?? [],
        }
      : {
          accessorId: raw.accessor_id ?? "",
          count: raw.object_count ?? 0,
          operations: raw.operations ?? [],
        },
  );
  return { groups, total: response.data.total ?? groups.length };
}

export async function listAuthorizableObjects(objType?: string): Promise<AuthorizableObject[]> {
  if (useMock) {
    return wait(authzObjects.filter((item) => !objType || item.type === objType).map((item) => ({ ...item })));
  }
  const objects = await listDomainObjects();
  return objType ? objects.filter((item) => item.type === objType) : objects;
}

export function summarizeGrants(list: ObjectGrant[]): AuthzSummary {
  const objects = new Set(list.map((g) => `${g.objType}:${g.objId}`));
  const grantees = new Set(list.map((g) => g.accessorId));
  return { grants: list.length, objects: objects.size, grantees: grantees.size };
}

// ---- writes -----------------------------------------------------------------

/** Creates or updates a grant by replacing this user's full operation set. Empty operations revoke it. */
export async function upsertObjectGrant(input: ObjectGrantInput): Promise<void> {
  if (!input.operations.length) {
    await revokeObjectGrant(input.accessorId, input.objType, input.objId);
    return;
  }
  if (useMock) {
    const existing = grants.find((g) => sameTarget(g, input));
    if (existing) {
      existing.operations = [...input.operations];
      existing.objName = input.objName;
      existing.objSub = input.objSub;
    } else {
      grants = [
        ...grants,
        {
          accessorId: input.accessorId,
          objType: input.objType,
          objId: input.objId,
          objName: input.objName,
          objSub: input.objSub,
          operations: [...input.operations],
        },
      ];
    }
    await wait(undefined);
    return;
  }
  await http.post(`${ADMIN}/object-grants`, {
    accessor_id: input.accessorId,
    resource: { type: input.objType, id: input.objId },
    operations: input.operations,
  });
}

export async function revokeObjectGrant(
  accessorId: string,
  objType: string,
  objId: string,
): Promise<void> {
  if (useMock) {
    grants = grants.filter(
      (g) => !(g.accessorId === accessorId && g.objType === objType && g.objId === objId),
    );
    await wait(undefined);
    return;
  }
  await http.request({
    url: `${ADMIN}/object-grants`,
    method: "DELETE",
    data: { accessor_id: accessorId, resource: { type: objType, id: objId } },
  });
}

// ---- backend mapper (real path) --------------------------------------------

type BackendEntry = {
  accessor_id?: string;
  operations?: string[];
  resource?: { id?: string; type?: string };
};

function mapEntry(item: BackendEntry): ObjectGrant {
  const objId = item.resource?.id ?? "";
  return {
    accessorId: item.accessor_id ?? "",
    objType: item.resource?.type ?? "",
    objId,
    // The backend does not return resource names; callers resolve them in real mode.
    objName: objId,
    operations: item.operations ?? [],
  };
}

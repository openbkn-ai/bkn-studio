/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Resolves object IDs to names through domain services; bkn-safe does not provide this.
// See section 7 of bkn-foundry/bkn-safe/docs/frontend-object-grants-integration.md:
//   7.1 List instances (id + name, searchable and paginated) for the new-grant object picker.
//   7.2 Resolve names by ID in batches for grant-list and group display.
// Domain APIs use different field names, envelopes, and paging parameters, so normalize them to {id, name} here.
// Used only in real mode; authz.service includes seed data for mock mode.
import { http } from "@/framework/request/http";
import { listKnowledgeNetworkActionTypes } from "@/modules/knowledge-network/services/action-type.service";
import { listKnowledgeNetworkConceptGroups } from "@/modules/knowledge-network/services/concept-group.service";
import { listKnowledgeNetworkMetrics } from "@/modules/knowledge-network/services/metric.service";
import { listKnowledgeNetworkObjectTypes } from "@/modules/knowledge-network/services/object-type.service";
import { listKnowledgeNetworkRelationTypes } from "@/modules/knowledge-network/services/relation-type.service";
import type { AuthorizableObject, ObjectGrant } from "@/modules/system-admin/types/authz";
import {
  AUTHZ_OBJECT_PICKER_TYPES,
  isAuthzObjectPickerType,
} from "@/modules/system-admin/utils/authz-catalog";

const PAGE_SIZE = 100;

export const AUTHZ_OBJECT_PAGE_SIZE = PAGE_SIZE;

export type AuthorizableObjectPage = {
  items: AuthorizableObject[];
  total: number;
};

// Maximum IDs per batch URL. Legacy Vega/MCP APIs put comma-separated IDs in the path, so batching
// avoids gateway URL limits and confines a missing ID's 404 to its own batch (50 UUIDs are ~1.8 KB).
const NAME_ID_BATCH = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

const str = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";

type Paging = "offset" | "page-size" | "page-page_size";

type ListConfig = {
  envelope: "entries" | "data";
  idField: string;
  nameField: string;
  nameParam: string;
  paging: Paging;
  path: string;
};

// 7.1 List instances.
const LIST_CONFIG: Record<string, ListConfig> = {
  catalog: { path: "/vega-backend/v1/catalogs", envelope: "entries", idField: "id", nameField: "name", nameParam: "name", paging: "offset" },
  resource: { path: "/vega-backend/v1/resources", envelope: "entries", idField: "id", nameField: "name", nameParam: "name", paging: "offset" },
  knowledge_network: { path: "/bkn-backend/v1/knowledge-networks", envelope: "entries", idField: "id", nameField: "name", nameParam: "name_pattern", paging: "offset" },
  small_model: { path: "/mf-model-manager/v1/small-model/list", envelope: "data", idField: "model_id", nameField: "model_name", nameParam: "model_name", paging: "page-size" },
  large_model: { path: "/mf-model-manager/v1/llm/list", envelope: "data", idField: "model_id", nameField: "model_name", nameParam: "name", paging: "page-size" },
  operator: { path: "/agent-operator-integration/v1/operator/info/list", envelope: "data", idField: "operator_id", nameField: "name", nameParam: "name", paging: "page-page_size" },
  tool_box: { path: "/agent-operator-integration/v1/tool-box/list", envelope: "data", idField: "box_id", nameField: "box_name", nameParam: "name", paging: "page-page_size" },
  mcp: { path: "/agent-operator-integration/v1/mcp/list", envelope: "data", idField: "mcp_id", nameField: "name", nameParam: "name", paging: "page-page_size" },
  skill: { path: "/agent-operator-integration/v1/skills", envelope: "data", idField: "skill_id", nameField: "name", nameParam: "name", paging: "page-page_size" },
};

function pagingParams(paging: Paging, offset = 0, limit = PAGE_SIZE): Record<string, number> {
  if (paging === "offset") return { offset, limit };
  if (paging === "page-size") return { page: Math.floor(offset / limit) + 1, size: limit };
  return { page: Math.floor(offset / limit) + 1, page_size: limit };
}

function arrayFrom(body: unknown, key: "entries" | "data"): Record<string, unknown>[] {
  const raw = (body as Record<string, unknown>)?.[key];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

type ObjectPage = { objects: AuthorizableObject[]; total: number };

async function listOne(type: string, keyword: string, offset = 0, limit = PAGE_SIZE): Promise<ObjectPage> {
  const cfg = LIST_CONFIG[type];
  if (!cfg) {
    return { objects: [], total: 0 };
  }

  const toObjects = (body: Record<string, unknown>) => arrayFrom(body, cfg.envelope)
    .map((item) => ({ type, id: str(item[cfg.idField]), name: str(item[cfg.nameField]) || str(item[cfg.idField]) }))
    .filter((object) => object.id);
  const totalFrom = (body: Record<string, unknown>, fallback: number) => {
    const total = Number(body.total_count ?? body.total ?? fallback);
    return Number.isFinite(total) ? total : fallback;
  };

  if (cfg.paging === "offset") {
    const response = await http.get<Record<string, unknown>>(cfg.path, {
      params: { ...pagingParams(cfg.paging, offset, limit), [cfg.nameParam]: keyword || undefined },
      skipErrorToast: true,
    });
    const objects = toObjects(response.data);
    return { objects, total: totalFrom(response.data, objects.length) };
  }

  // Page-based APIs cannot take an arbitrary offset. Fetch their stable PAGE_SIZE pages and
  // trim the requested slice locally; using the aggregate's remaining offset as page size would
  // otherwise turn an offset such as 7 into page 1 and duplicate the preceding seven records.
  const pageOffset = offset % PAGE_SIZE;
  const firstPageOffset = offset - pageOffset;
  const pageCount = Math.ceil((pageOffset + limit) / PAGE_SIZE);
  const responses = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => http.get<Record<string, unknown>>(cfg.path, {
      params: {
        ...pagingParams(cfg.paging, firstPageOffset + index * PAGE_SIZE, PAGE_SIZE),
        [cfg.nameParam]: keyword || undefined,
      },
      skipErrorToast: true,
    })),
  );
  const objects = responses.flatMap((response) => toObjects(response.data));
  return {
    objects: objects.slice(pageOffset, pageOffset + limit),
    total: totalFrom(responses[0]?.data ?? {}, objects.length),
  };
}

// List types that have a concrete-instance endpoint. Object-grant history can include additional
// types, but new grants must not offer a type whose instances cannot be selected.
export async function listDomainObjects(type?: string, keyword = ""): Promise<AuthorizableObject[]> {
  const types = type
    ? (isAuthzObjectPickerType(type) ? [type] : [])
    : AUTHZ_OBJECT_PICKER_TYPES;
  const settled = await Promise.allSettled(types.map((item) => listOne(item, keyword)));
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value.objects : []));
}

/** Lists one picker type through its domain API. Errors deliberately propagate so the picker can retry. */
export async function listDomainObjectsPage(
  type: string,
  { keyword = "", page = 0 }: { keyword?: string; page?: number } = {},
): Promise<AuthorizableObjectPage> {
  if (!isAuthzObjectPickerType(type)) {
    return { items: [], total: 0 };
  }
  const result = await listOne(type, keyword, page * PAGE_SIZE, PAGE_SIZE);
  return { items: result.objects, total: result.total };
}

/**
 * Resource roots shown by the authorization workbench. `resource` is intentionally absent: it is
 * managed below its owning catalog. Knowledge-network children are likewise loaded on expansion.
 */
export const TOP_LEVEL_AUTHZ_RESOURCE_TYPES = [
  "catalog",
  "knowledge_network",
  "operator",
  "tool_box",
  "mcp",
  "skill",
] as const;

export type TopResourceChild = AuthorizableObject & {
  category: string;
};

export type TopResourceChildPage = {
  category: string;
  children: TopResourceChild[];
  total: number;
};

export type TopResourceType = (typeof TOP_LEVEL_AUTHZ_RESOURCE_TYPES)[number];

export async function listTopLevelAuthzObjects(
  type: TopResourceType | undefined,
  keyword = "",
  query: { limit?: number; offset?: number } = {},
): Promise<ObjectPage> {
  const offset = query.offset ?? 0;
  const limit = query.limit ?? PAGE_SIZE;
  if (type) return listOne(type, keyword, offset, limit);

  // Domain services do not expose a shared top-resource endpoint. Build one stable virtual page
  // from their totals instead of fetching just the first page from every type and silently losing
  // later resources. A type whose service is temporarily unavailable is omitted from this view;
  // selecting that type still surfaces its direct request error to the caller.
  const counted = await Promise.allSettled(
    TOP_LEVEL_AUTHZ_RESOURCE_TYPES.map(async (resourceType) => ({
      resourceType,
      result: await listOne(resourceType, keyword, 0, 1),
    })),
  );
  const sections = counted.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  const total = sections.reduce((sum, item) => sum + item.result.total, 0);
  let remainingOffset = offset;
  let remainingLimit = limit;
  const requests: Array<Promise<ObjectPage>> = [];

  for (const section of sections) {
    if (remainingLimit <= 0) break;
    if (remainingOffset >= section.result.total) {
      remainingOffset -= section.result.total;
      continue;
    }
    const available = section.result.total - remainingOffset;
    const take = Math.min(remainingLimit, available);
    requests.push(listOne(section.resourceType, keyword, remainingOffset, take));
    remainingLimit -= take;
    remainingOffset = 0;
  }
  const pages = await Promise.all(requests);
  return { objects: pages.flatMap((page) => page.objects), total };
}

const KNOWLEDGE_NETWORK_CHILD_CATEGORIES = [
  "object_type",
  "relation_type",
  "action_type",
  "metric",
  "concept_group",
] as const;

const KNOWLEDGE_NETWORK_CHILD_PATHS: Record<(typeof KNOWLEDGE_NETWORK_CHILD_CATEGORIES)[number], string> = {
  object_type: "object-types",
  relation_type: "relation-types",
  action_type: "action-types",
  metric: "metrics",
  concept_group: "concept-groups",
};

export function listTopResourceChildCategories(root: AuthorizableObject): string[] {
  if (root.type === "catalog") return ["resource"];
  if (root.type === "knowledge_network") return [...KNOWLEDGE_NETWORK_CHILD_CATEGORIES];
  return [];
}

function childPage(
  root: AuthorizableObject,
  category: string,
  body: unknown,
): TopResourceChildPage {
  const entries = arrayFrom(body, "entries");
  const totalValue = Number((body as Record<string, unknown>)?.total_count ?? entries.length);
  const total = Number.isFinite(totalValue) ? totalValue : entries.length;
  return {
    category,
    children: entries
      .map((item) => ({
        category,
        id: root.type === "knowledge_network" ? `${root.id}/${str(item.id)}` : str(item.id),
        name: str(item.name) || str(item.id),
        sub: root.name,
        type: category,
      }))
      .filter((item) => item.id && item.name),
    total,
  };
}

/**
 * Lists one category below a top-level resource. Every category has independent pagination: a
 * catalog has resources, while a knowledge network has five child resource categories. Keeping
 * their pages independent avoids mixing object types, relations and actions into an unstable
 * aggregate order.
 */
export async function listTopResourceChildren(
  root: AuthorizableObject,
  category: string,
  query: { limit?: number; offset?: number } = {},
): Promise<TopResourceChildPage> {
  const limit = query.limit ?? PAGE_SIZE;
  const offset = query.offset ?? 0;
  if (root.type === "catalog" && category === "resource") {
    const response = await http.get<Record<string, unknown>>("/vega-backend/v1/resources", {
      params: { catalog_id: root.id, limit, offset },
      skipErrorToast: true,
    });
    return childPage(root, category, response.data);
  }
  if (root.type === "knowledge_network" && category in KNOWLEDGE_NETWORK_CHILD_PATHS) {
    const path = KNOWLEDGE_NETWORK_CHILD_PATHS[category as keyof typeof KNOWLEDGE_NETWORK_CHILD_PATHS];
    const response = await http.get<Record<string, unknown>>(
      `/bkn-backend/v1/knowledge-networks/${root.id}/${path}`,
      {
        params: { direction: "desc", limit, offset, sort: "update_time" },
        skipErrorToast: true,
      },
    );
    return childPage(root, category, response.data);
  }
  return { category, children: [], total: 0 };
}

// 7.2 Resolve names by ID in batches.
type NamesConfig =
  | { kind: "post"; path: string }
  | { kind: "vega"; path: string }
  | { kind: "mcp" };

const NAMES_CONFIG: Record<string, NamesConfig> = {
  small_model: { kind: "post", path: "/mf-model-manager/v1/small-model/names" },
  large_model: { kind: "post", path: "/mf-model-manager/v1/llm/names" },
  operator: { kind: "post", path: "/agent-operator-integration/v1/operator/names" },
  tool_box: { kind: "post", path: "/agent-operator-integration/v1/tool-box/names" },
  skill: { kind: "post", path: "/agent-operator-integration/v1/skills/names" },
  knowledge_network: { kind: "post", path: "/bkn-backend/v1/knowledge-networks/names" },
  catalog: { kind: "vega", path: "/vega-backend/v1/catalogs" },
  // A single table can be granted on its own — reading rows is judged there, while its management
  // verbs live on the owning catalog. Same batch API as catalog for name display.
  resource: { kind: "vega", path: "/vega-backend/v1/resources" },
  mcp: { kind: "mcp" },
};

type KnowledgeChildResolver = (networkId: string) => Promise<Array<{ id: string; name: string }>>;

// bkn-safe deliberately stores an opaque `network_id/child_id` key for knowledge-network
// children. Resolve it through the owning domain instead of presenting that storage key as a name.
const KNOWLEDGE_CHILD_RESOLVERS: Partial<Record<string, KnowledgeChildResolver>> = {
  action_type: listKnowledgeNetworkActionTypes,
  concept_group: listKnowledgeNetworkConceptGroups,
  metric: async (networkId) => (await listKnowledgeNetworkMetrics(networkId)).entries,
  object_type: listKnowledgeNetworkObjectTypes,
  relation_type: listKnowledgeNetworkRelationTypes,
};

type ResolvedName = { name: string; sub?: string };

function splitKnowledgeChildId(id: string): { childId: string; networkId: string } | null {
  const separator = id.indexOf("/");
  if (separator <= 0 || separator === id.length - 1) return null;
  return { networkId: id.slice(0, separator), childId: id.slice(separator + 1) };
}

function collectNamePairs(payload: unknown, idField: string, nameField: string): Array<[string, string]> {
  const body = payload as Record<string, unknown>;
  const list = Array.isArray(payload)
    ? (payload as Record<string, unknown>[])
    : Array.isArray(body?.entries)
      ? (body.entries as Record<string, unknown>[])
      : Array.isArray(body?.data)
        ? (body.data as Record<string, unknown>[])
        : [];
  return list
    .map((item): [string, string] => [str(item[idField]), str(item[nameField])])
    .filter(([id, name]) => id && name);
}

async function namesFor(type: string, ids: string[]): Promise<Map<string, string>> {
  const cfg = NAMES_CONFIG[type];
  const map = new Map<string, string>();
  if (!cfg || !ids.length) {
    return map;
  }
  if (cfg.kind === "post") {
    const response = await http.post<Record<string, unknown>>(
      cfg.path,
      { ids },
      { skipErrorToast: true },
    );
    for (const [id, name] of collectNamePairs(response.data, "id", "name")) {
      map.set(id, name);
    }
    return map;
  }
  if (cfg.kind === "vega") {
    // Resolve names through comma-separated IDs in the path. ignore_missing=true returns 200 with
    // found IDs instead of making the whole batch fail for one deleted ID, so orphaned grants do not
    // affect other entries. NAME_ID_BATCH keeps URLs bounded (50 IDs are about 1.1 KB, well below
    // the gateway's roughly 8 KB / 414 limit). Reconcile by entry.id without assuming result order
    // or count; requested IDs absent from the response represent deleted objects and fall back to their IDs.
    await Promise.all(
      chunk(ids, NAME_ID_BATCH).map(async (batch) => {
        try {
          const response = await http.get<unknown>(
            `${cfg.path}/${batch.map(encodeURIComponent).join(",")}`,
            { params: { ignore_missing: true }, skipErrorToast: true },
          );
          for (const [id, name] of collectNamePairs(response.data, "id", "name")) {
            map.set(id, name);
          }
        } catch {
          // The whole batch failed because of the network or gateway, not missing IDs; keep ID fallbacks without per-ID retries.
        }
      }),
    );
    return map;
  }
  // Legacy MCP endpoint: GET .../mcp/market/batch/{ids}/{fields}; batch it to avoid URL overflow as well.
  await Promise.all(
    chunk(ids, NAME_ID_BATCH).map(async (batch) => {
      try {
        const response = await http.get<unknown>(
          `/agent-operator-integration/v1/mcp/market/batch/${batch.map(encodeURIComponent).join(",")}/mcp_id,name`,
          { skipErrorToast: true },
        );
        for (const [id, name] of collectNamePairs(response.data, "mcp_id", "name")) {
          map.set(id, name);
        }
      } catch {
        // This batch cannot be resolved; retain IDs as name fallbacks.
      }
    }),
  );
  return map;
}

/** Resolve data resources together with the catalog that owns each resource. */
async function resolveResourceNames(ids: string[]): Promise<Map<string, ResolvedName>> {
  const resolved = new Map<string, ResolvedName>();
  const resources = new Map<string, { catalogId: string; name: string }>();
  await Promise.all(
    chunk(ids, NAME_ID_BATCH).map(async (batch) => {
      try {
        const response = await http.get<Record<string, unknown>>(
          `/vega-backend/v1/resources/${batch.map(encodeURIComponent).join(",")}`,
          { params: { ignore_missing: true }, skipErrorToast: true },
        );
        const entries = Array.isArray(response.data.entries)
          ? response.data.entries as Record<string, unknown>[]
          : [];
        for (const entry of entries) {
          const id = str(entry.id);
          const name = str(entry.name);
          if (id && name) {
            resources.set(id, { catalogId: str(entry.catalog_id), name });
          }
        }
      } catch {
        // Keep the resource ID when Vega cannot resolve its display context.
      }
    }),
  );
  let catalogNames = new Map<string, string>();
  try {
    catalogNames = await namesFor("catalog", [...new Set([...resources.values()].map((item) => item.catalogId).filter(Boolean))]);
  } catch {
    // The catalog ID is still useful parent context when its display name is unavailable.
  }
  for (const [id, resource] of resources) {
    resolved.set(id, {
      name: resource.name,
      sub: (catalogNames.get(resource.catalogId) ?? resource.catalogId) || undefined,
    });
  }
  return resolved;
}

// In-memory positive cache of resolved object names (`${type}:${id}` -> name). Reuse names across
// pagination, refreshes, and dev StrictMode loads. Cache only successes; retries remain batched and
// the cache lasts for the SPA session.
const nameCache = new Map<string, ResolvedName>();

async function resolveKnowledgeChildNames(type: string, ids: string[]): Promise<Map<string, ResolvedName>> {
  const resolveChildren = KNOWLEDGE_CHILD_RESOLVERS[type];
  const resolved = new Map<string, ResolvedName>();
  if (!resolveChildren) return resolved;

  const byNetwork = new Map<string, Array<{ childId: string; id: string }>>();
  for (const id of ids) {
    const parts = splitKnowledgeChildId(id);
    if (!parts) continue;
    const entries = byNetwork.get(parts.networkId) ?? [];
    entries.push({ childId: parts.childId, id });
    byNetwork.set(parts.networkId, entries);
  }
  if (!byNetwork.size) return resolved;

  // The child lists remain useful even when the optional parent-name batch endpoint is
  // temporarily unavailable. In that case the child gets its business name and the
  // parent falls back to its ID as secondary context.
  let networkNames = new Map<string, string>();
  try {
    networkNames = await namesFor("knowledge_network", [...byNetwork.keys()]);
  } catch {
    // Parent names are display enrichment only; do not discard resolved children.
  }
  await Promise.all(
    [...byNetwork.entries()].map(async ([networkId, entries]) => {
      try {
        const children = await resolveChildren(networkId);
        const namesById = new Map(children.map((child) => [child.id, child.name]));
        for (const entry of entries) {
          const name = namesById.get(entry.childId);
          if (name) {
            resolved.set(entry.id, { name, sub: networkNames.get(networkId) ?? networkId });
          }
        }
      } catch {
        // A deleted parent or unavailable child endpoint is represented as an unresolved object by the caller.
      }
    }),
  );
  return resolved;
}

// Resolve object names through domain services and retain IDs when resolution fails.
export async function resolveGrantNames(grants: ObjectGrant[]): Promise<ObjectGrant[]> {
  // Request only IDs without cached names, grouped by type.
  const pendingByType = new Map<string, Set<string>>();
  for (const grant of grants) {
    // Skip entries that already contain a real backend name (objName !== id). This is forward
    // compatible: when object-grants returns names directly, the domain-service fan-out stops automatically.
    if (grant.objName && grant.objName !== grant.objId) {
      continue;
    }
    // Missing type or ID cannot be resolved reliably and would pollute the `${type}:${id}` cache key, so skip it.
    if (!grant.objType || !grant.objId) {
      continue;
    }
    if (nameCache.has(`${grant.objType}:${grant.objId}`)) {
      continue;
    }
    const set = pendingByType.get(grant.objType) ?? new Set<string>();
    set.add(grant.objId);
    pendingByType.set(grant.objType, set);
  }
  await Promise.all(
    [...pendingByType.entries()].map(async ([type, ids]) => {
      try {
        const childNames = await resolveKnowledgeChildNames(type, [...ids]);
        if (childNames.size) {
          for (const [id, value] of childNames) {
            nameCache.set(`${type}:${id}`, value);
          }
        }
        const resourceNames = type === "resource" ? await resolveResourceNames([...ids]) : new Map<string, ResolvedName>();
        for (const [id, value] of resourceNames) {
          nameCache.set(`${type}:${id}`, value);
        }
        // This is normally empty for knowledge-network children. Keep the generic
        // fallback for mixed/legacy object keys that a domain endpoint did not resolve.
        const unresolvedIds = [...ids].filter((id) => !childNames.has(id) && !resourceNames.has(id));
        const map = type === "resource" ? new Map<string, string>() : await namesFor(type, unresolvedIds);
        for (const [id, name] of map) {
          nameCache.set(`${type}:${id}`, { name });
        }
      } catch {
        // One type failed to resolve; use IDs as its object-name fallbacks without affecting list display.
      }
    }),
  );
  return grants.map((grant) => {
    // Preserve names already supplied by the backend.
    if (grant.objName && grant.objName !== grant.objId) {
      return grant;
    }
    const resolved = nameCache.get(`${grant.objType}:${grant.objId}`);
    return resolved ? { ...grant, objName: resolved.name, objSub: resolved.sub } : grant;
  });
}

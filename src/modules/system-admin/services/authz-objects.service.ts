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
import { getRuntimeConfig } from "@/framework/runtime/config";
import type { AuthorizableObject, ObjectGrant } from "@/modules/system-admin/types/authz";
import { AUTHZ_OBJECT_TYPES } from "@/modules/system-admin/utils/authz-catalog";

const PAGE_SIZE = 100;

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

const domainHeaders = (): Record<string, string> => ({
  "x-business-domain": getRuntimeConfig().currentUser.businessDomainId ?? "bd_public",
});

type Paging = "offset" | "page-size" | "page-page_size";

type ListConfig = {
  domain: boolean;
  envelope: "entries" | "data";
  idField: string;
  nameField: string;
  nameParam: string;
  paging: Paging;
  path: string;
};

// 7.1 List instances.
const LIST_CONFIG: Record<string, ListConfig> = {
  catalog: { path: "/vega-backend/v1/catalogs", domain: false, envelope: "entries", idField: "id", nameField: "name", nameParam: "name", paging: "offset" },
  resource: { path: "/vega-backend/v1/resources", domain: false, envelope: "entries", idField: "id", nameField: "name", nameParam: "name", paging: "offset" },
  knowledge_network: { path: "/bkn-backend/v1/knowledge-networks", domain: true, envelope: "entries", idField: "id", nameField: "name", nameParam: "name_pattern", paging: "offset" },
  small_model: { path: "/mf-model-manager/v1/small-model/list", domain: false, envelope: "data", idField: "model_id", nameField: "model_name", nameParam: "model_name", paging: "page-size" },
  large_model: { path: "/mf-model-manager/v1/llm/list", domain: false, envelope: "data", idField: "model_id", nameField: "model_name", nameParam: "name", paging: "page-size" },
  operator: { path: "/agent-operator-integration/v1/operator/info/list", domain: true, envelope: "data", idField: "operator_id", nameField: "name", nameParam: "name", paging: "page-page_size" },
  tool_box: { path: "/agent-operator-integration/v1/tool-box/list", domain: true, envelope: "data", idField: "box_id", nameField: "box_name", nameParam: "name", paging: "page-page_size" },
  mcp: { path: "/agent-operator-integration/v1/mcp/list", domain: true, envelope: "data", idField: "mcp_id", nameField: "name", nameParam: "name", paging: "page-page_size" },
  skill: { path: "/agent-operator-integration/v1/skills", domain: true, envelope: "data", idField: "skill_id", nameField: "name", nameParam: "name", paging: "page-page_size" },
};

function pagingParams(paging: Paging): Record<string, number> {
  if (paging === "offset") return { offset: 0, limit: PAGE_SIZE };
  if (paging === "page-size") return { page: 1, size: PAGE_SIZE };
  return { page: 1, page_size: PAGE_SIZE };
}

function arrayFrom(body: unknown, key: "entries" | "data"): Record<string, unknown>[] {
  const raw = (body as Record<string, unknown>)?.[key];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

async function listOne(type: string, keyword: string): Promise<AuthorizableObject[]> {
  const cfg = LIST_CONFIG[type];
  if (!cfg) {
    return [];
  }
  const response = await http.get<Record<string, unknown>>(cfg.path, {
    params: { ...pagingParams(cfg.paging), [cfg.nameParam]: keyword || undefined },
    headers: cfg.domain ? domainHeaders() : undefined,
    skipErrorToast: true,
  });
  return arrayFrom(response.data, cfg.envelope)
    .map((item) => ({ type, id: str(item[cfg.idField]), name: str(item[cfg.nameField]) || str(item[cfg.idField]) }))
    .filter((object) => object.id);
}

// List authorizable objects by type in parallel; one type failing does not affect the others.
export async function listDomainObjects(keyword = ""): Promise<AuthorizableObject[]> {
  const settled = await Promise.allSettled(AUTHZ_OBJECT_TYPES.map((type) => listOne(type, keyword)));
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

// 7.2 Resolve names by ID in batches.
type NamesConfig =
  | { kind: "post"; domain: boolean; path: string }
  | { kind: "vega"; path: string }
  | { kind: "mcp" };

const NAMES_CONFIG: Record<string, NamesConfig> = {
  small_model: { kind: "post", domain: false, path: "/mf-model-manager/v1/small-model/names" },
  large_model: { kind: "post", domain: false, path: "/mf-model-manager/v1/llm/names" },
  operator: { kind: "post", domain: true, path: "/agent-operator-integration/v1/operator/names" },
  tool_box: { kind: "post", domain: true, path: "/agent-operator-integration/v1/tool-box/names" },
  skill: { kind: "post", domain: true, path: "/agent-operator-integration/v1/skills/names" },
  knowledge_network: { kind: "post", domain: true, path: "/bkn-backend/v1/knowledge-networks/names" },
  catalog: { kind: "vega", path: "/vega-backend/v1/catalogs" },
  // A single table can be granted on its own — reading rows is judged there, while its management
  // verbs live on the owning catalog. Same batch API as catalog for name display.
  resource: { kind: "vega", path: "/vega-backend/v1/resources" },
  mcp: { kind: "mcp" },
};

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
      { headers: cfg.domain ? domainHeaders() : undefined, skipErrorToast: true },
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
          { headers: domainHeaders(), skipErrorToast: true },
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

// In-memory positive cache of resolved object names (`${type}:${id}` -> name). Reuse names across
// pagination, refreshes, and dev StrictMode loads. Cache only successes; retries remain batched and
// the cache lasts for the SPA session.
const nameCache = new Map<string, string>();

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
        const map = await namesFor(type, [...ids]);
        for (const [id, name] of map) {
          nameCache.set(`${type}:${id}`, name);
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
    const name = nameCache.get(`${grant.objType}:${grant.objId}`);
    return name ? { ...grant, objName: name } : grant;
  });
}

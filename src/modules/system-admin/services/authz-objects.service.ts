/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// 对象 id → 名称解析（各领域服务，bkn-safe 不提供）。
// 契约见 bkn-foundry/bkn-safe/docs/frontend-object-grants-integration.md 第七节：
//   7.1 列实例（id+name，搜索分页）—— 喂「新建授权」对象选择器
//   7.2 按 id 批量取名 —— 授权列表/分组回显对象名
// 各域接口的字段名/外壳/分页参数不统一，这里按类型归一成 {id,name}。
// 仅真实模式使用（mock 模式 authz.service 自带 seed）。
import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type { AuthorizableObject, ObjectGrant } from "@/modules/system-admin/types/authz";
import { AUTHZ_OBJECT_TYPES } from "@/modules/system-admin/utils/authz-catalog";

const PAGE_SIZE = 100;

const str = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

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

// 7.1 列实例
const LIST_CONFIG: Record<string, ListConfig> = {
  catalog: { path: "/vega-backend/v1/catalogs", domain: false, envelope: "entries", idField: "id", nameField: "name", nameParam: "name", paging: "offset" },
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

/** 列出全部可授权对象（按类型并行；单类型失败不影响其它）。 */
export async function listDomainObjects(keyword = ""): Promise<AuthorizableObject[]> {
  const settled = await Promise.allSettled(AUTHZ_OBJECT_TYPES.map((type) => listOne(type, keyword)));
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

// 7.2 按 id 批量取名
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
  // resource 不在授权对象选择器里（不新建单资源授权），但后端可能已存在 resource 级
  // 授权记录，列表需能回显其名称，故保留按 id 取名（vega 旧批量接口，同 catalog）。
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
    // 旧接口：逗号分隔 path、返回完整对象、任一 id 不存在整批 404 → 失败时退化为逐个。
    try {
      const response = await http.get<unknown>(`${cfg.path}/${ids.map(encodeURIComponent).join(",")}`, {
        skipErrorToast: true,
      });
      for (const [id, name] of collectNamePairs(response.data, "id", "name")) {
        map.set(id, name);
      }
    } catch {
      const settled = await Promise.allSettled(
        ids.map((id) => http.get<unknown>(`${cfg.path}/${encodeURIComponent(id)}`, { skipErrorToast: true })),
      );
      settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
          // 单条响应同样是 {entries:[{id,name}]} 形态；用同一解析兜住。
          const name = collectNamePairs(result.value.data, "id", "name")[0]?.[1];
          if (name) {
            map.set(ids[index], name);
          }
        }
      });
    }
    return map;
  }
  // mcp 旧接口：GET .../mcp/market/batch/{ids}/{fields}
  const response = await http.get<unknown>(
    `/agent-operator-integration/v1/mcp/market/batch/${ids.map(encodeURIComponent).join(",")}/mcp_id,name`,
    { headers: domainHeaders(), skipErrorToast: true },
  );
  for (const [id, name] of collectNamePairs(response.data, "mcp_id", "name")) {
    map.set(id, name);
  }
  return map;
}

/** 用领域服务解析对象名，回填到 grants 的 objName（解析失败的保持原 id 兜底）。 */
export async function resolveGrantNames(grants: ObjectGrant[]): Promise<ObjectGrant[]> {
  const idsByType = new Map<string, Set<string>>();
  for (const grant of grants) {
    const set = idsByType.get(grant.objType) ?? new Set<string>();
    set.add(grant.objId);
    idsByType.set(grant.objType, set);
  }
  const resolved = new Map<string, string>(); // `${type}:${id}` -> name
  await Promise.all(
    [...idsByType.entries()].map(async ([type, ids]) => {
      try {
        const map = await namesFor(type, [...ids]);
        for (const [id, name] of map) {
          resolved.set(`${type}:${id}`, name);
        }
      } catch {
        // 单类型解析失败：该类型对象名退化为 id，不影响列表展示。
      }
    }),
  );
  return grants.map((grant) => {
    const name = resolved.get(`${grant.objType}:${grant.objId}`);
    return name ? { ...grant, objName: name } : grant;
  });
}

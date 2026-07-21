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

/**
 * 按 id 批量取名时,单条 URL(逗号拼 id)携带的 id 数上限。旧的 vega/mcp 接口把 id
 * 拼进 path,几十上百个会撞网关 URL 长度限制;且任一 id 不存在整批 404 —— 分批可把
 * 单个坏 id 的影响限定在本批,不牵连其它。UUID(~36 char)× 50 ≈ 1.8KB。
 */
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
    // 逗号分隔 path 批量取名。ignore_missing=true 让后端对已删 id 返 200 + 查到的那些
    // (而非任一 id 不存在就整批 404),孤儿授权混进本批也不牵连其余。按 NAME_ID_BATCH
    // 分批控 URL 长度(50 ≈ 1.1KB,远低于网关 ~8KB/414 上限)。回填按 entry.id 对齐,
    // 不假设返回顺序/数量;请求了但没返的 id = 已删对象 → 名称退化为 id 兜底。
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
          // 本批整体失败(非缺 id,而是网络/网关):名称保持 id 兜底,不逐个重试。
        }
      }),
    );
    return map;
  }
  // mcp 旧接口：GET .../mcp/market/batch/{ids}/{fields}，同样分批防 URL 超限。
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
        // 本批不可解析：名称保持 id 兜底。
      }
    }),
  );
  return map;
}

/**
 * 已解析对象名的进程内正向缓存(`${type}:${id}` -> name)。跨分页翻页、列表刷新、
 * dev StrictMode 的重复加载复用,已有名字的 id 不再重复请求。只缓存成功项:解析不到
 * 的 id 下次仍会重试(可能是后来才建的对象),但重试也走分批,不会退化成风暴。
 * 生命周期随 SPA 会话,硬刷新即清空。
 */
const nameCache = new Map<string, string>();

/** 用领域服务解析对象名，回填到 grants 的 objName（解析失败的保持原 id 兜底）。 */
export async function resolveGrantNames(grants: ObjectGrant[]): Promise<ObjectGrant[]> {
  // 只对缓存里没有名字的 id 发起请求,按类型分组。
  const pendingByType = new Map<string, Set<string>>();
  for (const grant of grants) {
    // 后端已带真实名(objName ≠ id)则跳过。前向兼容:一旦 object-grants 直接回 name,
    // 整套领域服务 fan-out 自动停掉,无需再改这里。
    if (grant.objName && grant.objName !== grant.objId) {
      continue;
    }
    // 缺 type 或 id 无法可靠取名,也会污染 `${type}:${id}` 缓存键,跳过。
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
        // 单类型解析失败：该类型对象名退化为 id，不影响列表展示。
      }
    }),
  );
  return grants.map((grant) => {
    // 已是后端真实名的保留不动。
    if (grant.objName && grant.objName !== grant.objId) {
      return grant;
    }
    const name = nameCache.get(`${grant.objType}:${grant.objId}`);
    return name ? { ...grant, objName: name } : grant;
  });
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 知识网络「立即体验」—— ContextLoader 接口调试台 (agent-retrieval)。
 *
 * 单一 ContextLoader 操作集，REST 与 MCP 一一对应：同一接口的两种调用方式。
 * REST 全路径前缀 /api/agent-retrieval/v1（经实测网关路由：/v1 返回 401 需鉴权，/in 与 /out 均 404）；
 * MCP 端点 /api/agent-retrieval/v1/mcp。MCP 工具名 = op.id，arguments = mcpArgs 或 body。
 * 「发送请求」是真实 HTTP 调用（默认同源，避免跨域；服务地址可改）。
 */

export type ContextLoaderMode = "agent" | "rest" | "mcp";

export type OpQueryParam = {
  name: string;
  value: string;
  options?: string[];
  required?: boolean;
};

export type ContextLoaderOp = {
  id: string;
  group: string;
  summary: string;
  /** REST 全路径。 */
  path: string;
  query: OpQueryParam[];
  body: Record<string, unknown> | null;
  /** MCP arguments（默认 = body）。 */
  mcpArgs?: Record<string, unknown>;
};

export const REST_PREFIX = "/api/agent-retrieval/v1";

/** MCP 端点（实测 /api/agent-retrieval/v1/mcp，非根 /mcp）。 */
export const MCP_PATH = "/api/agent-retrieval/v1/mcp";

export const CONTEXT_LOADER_OPS: ContextLoaderOp[] = [
  {
    id: "search_schema",
    group: "Knowledge Network",
    summary: "统一的 Schema 探索入口：根据自然语言探索 object / relation / action / metric types。固定 Schema-only，不返回实例数据。",
    path: `${REST_PREFIX}/kn/search_schema`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: {
      query: "查询核心业务对象与关系",
      kn_id: "your_kn_id",
      search_scope: { concept_groups: [], include_object_types: true, include_relation_types: true, include_action_types: true, include_metric_types: true },
      max_concepts: 10,
      schema_brief: true,
      enable_rerank: true,
    },
  },
  {
    id: "query_object_instance",
    group: "查询",
    summary:
      "根据单个对象类查询对象实例数据，支持过滤、排序与分页。REST 经 query 传 kn_id / ot_id；MCP 经 arguments 传入。" +
      "推荐用 filters 扁平糖衣——[{field, op, value}]，op: == != > >= < <= in not_in like not_like exist not_exist match" +
      "（白名单以对象类 condition_operations 为准；in/not_in 的 value 传数组）。" +
      "需要 or / 嵌套时改用 condition（与 filters 互斥，同传 condition 优先）。不过滤就删掉 filters。",
    path: `${REST_PREFIX}/kn/query_object_instance`,
    query: [
      { name: "kn_id", value: "your_kn_id", required: true },
      { name: "ot_id", value: "your_object_type", required: true },
      { name: "include_logic_params", value: "false", options: ["false", "true"] },
      { name: "response_format", value: "json", options: ["json", "toon"] },
    ],
    body: {
      filters: [{ field: "your_field", op: "==", value: "your_value" }],
      sort: [{ field: "@timestamp", direction: "desc" }],
      limit: 10,
      need_total: true,
      properties: [],
    },
    mcpArgs: {
      kn_id: "your_kn_id",
      ot_id: "your_object_type",
      include_logic_params: false,
      filters: [{ field: "your_field", op: "==", value: "your_value" }],
      sort: [{ field: "@timestamp", direction: "desc" }],
      limit: 10,
      need_total: true,
    },
  },
  {
    id: "query_instance_subgraph",
    group: "查询",
    summary: "基于预定义关系类路径查询知识图谱中的对象子图。支持多条路径；object_types 与 relation_types 顺序必须严格对应。",
    path: `${REST_PREFIX}/kn/query_instance_subgraph`,
    query: [
      { name: "kn_id", value: "your_kn_id", required: true },
      { name: "include_logic_params", value: "false", options: ["false", "true"] },
      { name: "response_format", value: "json", options: ["json", "toon"] },
    ],
    body: {
      relation_type_paths: [
        {
          object_types: [{ id: "object_type_a" }, { id: "object_type_b" }],
          relation_types: [{ relation_type_id: "relation_a_b", source_object_type_id: "object_type_a", target_object_type_id: "object_type_b" }],
          limit: 10,
        },
      ],
    },
    mcpArgs: {
      kn_id: "your_kn_id",
      relation_type_paths: [
        {
          object_types: [{ id: "object_type_a" }, { id: "object_type_b" }],
          relation_types: [{ relation_type_id: "relation_a_b", source_object_type_id: "object_type_a", target_object_type_id: "object_type_b" }],
          limit: 10,
        },
      ],
    },
  },
  {
    id: "list_resources",
    group: "数据资源",
    summary:
      "列出当前账户可访问的数据层资源（table / file …），按 catalog_id / type 过滤并分页（offset / limit）；req 字段全可选。" +
      "列表已按 token 账户的 view_detail 权限过滤——前端不要假设能看到全部；空账户 / 无 token 后端返 403，按未授权处理。" +
      "type 是资源类别（table/file/…），不是数据类型。",
    path: `${REST_PREFIX}/kn/list_resources`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { catalog_id: "your_catalog_id", type: "table", offset: 0, limit: 20 },
  },
  {
    id: "describe_resource",
    group: "数据资源",
    summary: "查看单个数据资源的列结构，返回 connector_type 与 columns:[{name,type,description}]。resource_id 取自 list_resources 的 entries[].resource_id。",
    path: `${REST_PREFIX}/kn/describe_resource`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { resource_id: "your_resource_id" },
  },
  {
    id: "run_sql",
    group: "数据资源",
    summary: "在知识网络上直接执行 SQL 查询并返回结果集。表名用模板占位 {{.<resource_id>}} 引用资源；跨 catalog 不能 join。",
    path: `${REST_PREFIX}/kn/run_sql`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    // 数据表必须用模板占位引用（后端解析为真实资源），不能写裸表名：
    // 后端报错示例 "sql must reference at least one data resource via the {{.resource_id}}"。
    body: { kn_id: "your_kn_id", sql: "SELECT * FROM {{.resource_id}} WHERE status = 'active' LIMIT 10" },
  },
  {
    id: "get_logic_properties_values",
    group: "Skills & Logic",
    summary: "批量查询对象的逻辑属性值（metric / operator），自动根据 query 生成 dynamic_params。缺参时返回 missing 提示。",
    path: `${REST_PREFIX}/kn/get_logic_properties_values`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: {
      kn_id: "your_kn_id",
      ot_id: "your_object_type",
      query: "示例：批量计算对象的逻辑属性值",
      _instance_identities: [{ id: "instance_000001" }],
      properties: ["your_metric_a", "your_metric_b"],
      options: { return_debug: true },
    },
  },
  {
    id: "get_action_info",
    group: "Skills & Logic",
    summary: "根据对象实例标识召回关联行动，返回符合 Function Call 规范的 _dynamic_tools 工具定义。支持多个实例标识。",
    path: `${REST_PREFIX}/kn/get_action_info`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", at_id: "your_action_type", _instance_identities: [{ id: "instance_000001" }, { id: "instance_000002" }] },
  },
  {
    id: "find_skills",
    group: "Skills & Logic",
    summary: "基于业务上下文召回 Skill 候选列表。kn_id + object_type_id 为对象类级；附带 instance_identities 为实例级召回。",
    path: `${REST_PREFIX}/kn/find_skills`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", object_type_id: "your_object_type", instance_identities: [{ id: "instance_000001" }], skill_query: "示例技能检索", top_k: 10 },
  },
  {
    id: "list_knowledge_networks",
    group: "Knowledge Network",
    summary: "列出当前账户可访问的业务知识网络。支持 name_pattern 过滤、limit/offset 分页、sort/direction 排序。",
    path: `${REST_PREFIX}/kn/list_knowledge_networks`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { limit: 20, offset: 0 },
  },
  {
    id: "get_kn_detail",
    group: "Knowledge Network",
    summary: "查询指定知识网络的详细信息。",
    path: `${REST_PREFIX}/kn/get_kn_detail`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id" },
  },
];

export function mcpPathOf(op: ContextLoaderOp): string {
  return op.path.startsWith(REST_PREFIX) ? op.path.slice(REST_PREFIX.length) : op.path;
}

export type ContextLoaderEnv = {
  base: string;
  token: string;
  /** 锁定的知识网络 slug（kn_id）。 */
  knId: string;
};

export function authHeaders(env: ContextLoaderEnv): Record<string, string> {
  // 网关从 Bearer token 派生账号；x-account-id / x-account-type 无需再传。
  const headers: Record<string, string> = {};
  if (env.token) headers.Authorization = `Bearer ${env.token}`;
  return headers;
}

/** 把 body / mcpArgs 里的 kn_id 注入为当前网络 slug，并格式化为 JSON 文本。 */
export function exampleBodyText(op: ContextLoaderOp, mode: ContextLoaderMode, knId: string): string {
  const source = mode === "mcp" ? (op.mcpArgs ?? op.body) : op.body;
  if (source === null) {
    return "";
  }
  const cloned: Record<string, unknown> = { ...source };
  if ("kn_id" in cloned) {
    cloned.kn_id = knId;
  }
  return JSON.stringify(cloned, null, 2);
}

/* ============================ 一键填充测试数据 ============================ */
// 用当前知识网络的真实 schema + 样本行生成可直接发送的请求体。
// 仅覆盖能从 get_kn_detail / 样本行推出真实值的接口；relation / action / metric 类留待大模型填。

const TEST_DATA_OPS = new Set([
  "query_object_instance",
  "run_sql",
  "search_schema",
  "get_kn_detail",
  "query_instance_subgraph",
  "get_object_types",
  "get_relation_types",
  "describe_resource",
  "list_resources",
]);

/** 该接口是否支持「填充测试数据」。 */
export function opSupportsTestData(opId: string): boolean {
  return TEST_DATA_OPS.has(opId);
}

/** 选一个绑定了数据资源的对象类型（有资源才查得到数据）。 */
export function pickQueryableObjectType(detail: KnDetail): KnObjectType | null {
  return detail.object_types.find((o) => Boolean(o.data_source?.id)) ?? null;
}

/** 从样本行挑一个非空标量字段当过滤条件，优先 schema 声明的 data_properties。 */
function pickFilterFieldValue(
  ot: KnObjectType,
  row: Record<string, unknown> | null,
): { field: string; value: string | number | boolean } | null {
  if (!row) return null;
  const declared = (ot.data_properties ?? []).map((p) => p.name);
  const candidates = declared.length > 0 ? declared : Object.keys(row).filter((k) => !k.startsWith("_"));
  for (const name of candidates) {
    const v = row[name];
    if (typeof v === "number" || typeof v === "boolean") return { field: name, value: v };
    if (typeof v === "string" && v.trim() !== "") return { field: name, value: v };
  }
  return null;
}

/** 由一条关系类构造 query_instance_subgraph 的单条路径。 */
export function subgraphPathFor(rel: KnRelationType) {
  return {
    object_types: [{ id: rel.sourceId }, { id: rel.targetId }],
    relation_types: [
      { relation_type_id: rel.id, source_object_type_id: rel.sourceId, target_object_type_id: rel.targetId },
    ],
    limit: 10,
  };
}

export type TestDataFill = { body: string; query?: Record<string, string>; note: string };

/**
 * 为支持的接口生成测试请求体。ot / sampleRow 由调用方按 op 需要预取：
 * query_object_instance 需要二者；run_sql 只需带资源的 ot；schema / kn 详情无需。
 */
export function buildTestData(
  op: ContextLoaderOp,
  mode: ContextLoaderMode,
  knId: string,
  detail: KnDetail,
  ot: KnObjectType | null,
  sampleRow: Record<string, unknown> | null,
): TestDataFill {
  switch (op.id) {
    case "get_kn_detail":
      return { body: JSON.stringify({ kn_id: knId }, null, 2), note: "已填入当前 kn_id" };

    case "search_schema": {
      const groupId = detail.concept_groups[0]?.id;
      const body = {
        query: "查询核心业务对象与关系",
        kn_id: knId,
        search_scope: {
          concept_groups: groupId ? [groupId] : [],
          include_object_types: true,
          include_relation_types: true,
          include_action_types: true,
          include_metric_types: true,
        },
        max_concepts: 10,
        schema_brief: false,
        enable_rerank: true,
      };
      return { body: JSON.stringify(body, null, 2), note: groupId ? `kn_id + 真实资源组 ${groupId}` : "已填入 kn_id" };
    }

    case "run_sql": {
      const resId = ot?.data_source?.id ?? "";
      const body = { kn_id: knId, sql: `SELECT * FROM {{.${resId}}} LIMIT 10` };
      return { body: JSON.stringify(body, null, 2), note: `资源 ${resId}` };
    }

    case "query_instance_subgraph": {
      const otIds = new Set(detail.object_types.map((o) => o.id));
      const rels = detail.relation_types ?? [];
      const rel = rels.find((r) => otIds.has(r.sourceId) && otIds.has(r.targetId)) ?? rels[0] ?? null;
      if (!rel) {
        return { body: exampleBodyText(op, mode, knId), note: "未在 get_kn_detail 发现可用关系类，请手填" };
      }
      const path = subgraphPathFor(rel);
      const note = `关系类 ${rel.name || rel.id}（${rel.sourceId} → ${rel.targetId}）`;
      if (mode === "mcp") {
        return { body: JSON.stringify({ kn_id: knId, relation_type_paths: [path] }, null, 2), note };
      }
      return { body: JSON.stringify({ relation_type_paths: [path] }, null, 2), query: { kn_id: knId }, note };
    }

    case "query_object_instance": {
      const ff = ot ? pickFilterFieldValue(ot, sampleRow) : null;
      const filters = ff ? [{ field: ff.field, op: "==", value: ff.value }] : [];
      const otId = ot?.id ?? "";
      const note = ff ? `对象类型 ${otId}，过滤 ${ff.field} == ${ff.value}` : `对象类型 ${otId}（无样本，未加过滤）`;
      if (mode === "mcp") {
        const body: Record<string, unknown> = { kn_id: knId, ot_id: otId, include_logic_params: false };
        if (filters.length) body.filters = filters;
        body.limit = 10;
        body.need_total = true;
        return { body: JSON.stringify(body, null, 2), note };
      }
      const body: Record<string, unknown> = {};
      if (filters.length) body.filters = filters;
      body.limit = 10;
      body.need_total = true;
      body.properties = [];
      return { body: JSON.stringify(body, null, 2), query: { kn_id: knId, ot_id: otId }, note };
    }

    case "get_object_types": {
      const ids = detail.object_types
        .slice(0, 3)
        .map((o) => o.id)
        .filter(Boolean);
      return {
        body: JSON.stringify({ kn_id: knId, ids }, null, 2),
        note: ids.length ? `前 ${ids.length} 个对象类` : "该网络无对象类，请手填 ids",
      };
    }

    case "get_relation_types": {
      const ids = detail.relation_types
        .slice(0, 3)
        .map((r) => r.id)
        .filter(Boolean);
      return {
        body: JSON.stringify({ kn_id: knId, ids }, null, 2),
        note: ids.length ? `前 ${ids.length} 个关系类` : "该网络无关系类，请手填 ids",
      };
    }

    case "describe_resource": {
      const resId = detail.object_types.find((o) => o.data_source?.id)?.data_source?.id ?? "";
      return {
        body: JSON.stringify({ resource_id: resId }, null, 2),
        note: resId ? `资源 ${resId}（取自对象类绑定）` : "该网络对象类无绑定资源，请手填 resource_id",
      };
    }

    case "list_resources":
      return { body: JSON.stringify({ type: "table", offset: 0, limit: 20 }, null, 2), note: "前 20 个 table 资源" };

    default:
      return { body: exampleBodyText(op, mode, knId), note: "" };
  }
}

export function buildRestUrl(env: ContextLoaderEnv, op: ContextLoaderOp, queryValues: Record<string, string>): string {
  const base = env.base.replace(/\/+$/, "");
  const parts: string[] = [];
  op.query.forEach((param) => {
    const value = param.name === "kn_id" ? env.knId : queryValues[param.name] ?? param.value;
    if (value !== "" && value != null) {
      parts.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`);
    }
  });
  return base + op.path + (parts.length ? `?${parts.join("&")}` : "");
}

function mcpBase(env: ContextLoaderEnv): string {
  return `${env.base.replace(/\/+$/, "")}${MCP_PATH}`;
}

/**
 * MCP tools/call 的 arguments：解析请求体 JSON，并把 response_format 选择器的值
 * 注入进 arguments（MCP 没有 query，response_format 必须走 arg；不传则后端默认 toon）。
 */
function mcpCallArgs(bodyText: string, queryValues: Record<string, string>): Record<string, unknown> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(bodyText || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      args = parsed as Record<string, unknown>;
    }
  } catch {
    args = {};
  }
  const responseFormat = queryValues.response_format;
  if (responseFormat && !("response_format" in args)) {
    args.response_format = responseFormat;
  }
  return args;
}

export function buildCurl(
  env: ContextLoaderEnv,
  op: ContextLoaderOp,
  mode: ContextLoaderMode,
  queryValues: Record<string, string>,
  bodyText: string,
): string {
  if (mode === "mcp") {
    const url = mcpBase(env);
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...authHeaders(env) };
    const args = mcpCallArgs(bodyText, queryValues);
    const payload = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: op.id, arguments: args } };
    let curl = `curl -X POST '${url}'`;
    Object.entries(headers).forEach(([key, value]) => {
      curl += ` \\\n  -H '${key}: ${value}'`;
    });
    curl += ` \\\n  -d '${JSON.stringify(payload)}'`;
    return curl;
  }
  const url = buildRestUrl(env, op, queryValues);
  const headers = { "Content-Type": "application/json", ...authHeaders(env) };
  let curl = `curl -X POST '${url}'`;
  Object.entries(headers).forEach(([key, value]) => {
    curl += ` \\\n  -H '${key}: ${value}'`;
  });
  if (op.body !== null) {
    curl += ` \\\n  -d '${(bodyText || "{}").replace(/\n\s*/g, "")}'`;
  }
  return curl;
}

export type ContextLoaderResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  latencyMs: number;
  sizeBytes: number;
  text: string;
};

/** 真实发送请求（REST 或 MCP），返回原始响应文本 + 元信息。 */
export async function sendRequest(
  env: ContextLoaderEnv,
  op: ContextLoaderOp,
  mode: ContextLoaderMode,
  queryValues: Record<string, string>,
  bodyText: string,
): Promise<ContextLoaderResponse> {
  const start = performance.now();
  if (mode === "mcp") {
    // MCP Streamable HTTP：必须先 initialize 建会话（响应头 Mcp-Session-Id），
    // 再 notifications/initialized，最后才能 tools/call。
    const url = mcpBase(env);
    const baseHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...authHeaders(env),
    };
    const initResp = await fetch(url, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bkn-studio", version: "1.0.0" } },
      }),
    });
    const sessionId = initResp.headers.get("mcp-session-id") ?? initResp.headers.get("Mcp-Session-Id");
    const initText = await initResp.text();
    if (!initResp.ok && !sessionId) {
      return {
        ok: false,
        status: initResp.status,
        statusText: `${initResp.statusText} (initialize)`,
        latencyMs: Math.round(performance.now() - start),
        sizeBytes: new Blob([initText]).size,
        text: initText || "MCP initialize 失败，未拿到会话（Mcp-Session-Id）。",
      };
    }
    const sessionHeaders = sessionId ? { ...baseHeaders, "Mcp-Session-Id": sessionId } : baseHeaders;
    if (sessionId) {
      await fetch(url, {
        method: "POST",
        headers: sessionHeaders,
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      }).catch(() => undefined);
    }
    const response = await fetch(url, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: op.id, arguments: mcpCallArgs(bodyText, queryValues) },
      }),
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      latencyMs: Math.round(performance.now() - start),
      sizeBytes: new Blob([text]).size,
      text,
    };
  }
  const url = buildRestUrl(env, op, queryValues);
  const headers = { "Content-Type": "application/json", ...authHeaders(env) };
  const init: RequestInit = { method: "POST", headers };
  if (op.body !== null) {
    init.body = JSON.stringify(JSON.parse(bodyText || "{}"));
  }
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    latencyMs: Math.round(performance.now() - start),
    sizeBytes: new Blob([text]).size,
    text,
  };
}

/* ============================ MCP 工具发现（tools/list）============================ */
export type McpToolDef = { name: string; description?: string; inputSchema?: unknown; outputSchema?: unknown };

/** 解析 MCP 响应（SSE event:/data: 取最后一条 data，再 JSON.parse）。失败返回 null。 */
function parseMcpEnvelope(text: string): unknown {
  const dataLines = text
    .split("\n")
    .filter((line) => line.trimStart().startsWith("data:"))
    .map((line) => line.replace(/^\s*data:/, "").trim())
    .filter(Boolean);
  const candidate = dataLines.length > 0 ? dataLines[dataLines.length - 1]! : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * 调 MCP tools/list 动态发现工具（含 inputSchema）。
 * 走完整握手：initialize → notifications/initialized → tools/list。
 * 用于「工具发现 / 漂移对照」，也是 schema 驱动表单的数据源。
 */
export async function listMcpTools(env: ContextLoaderEnv): Promise<McpToolDef[]> {
  const url = mcpBase(env);
  const baseHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...authHeaders(env),
  };
  const initResp = await fetch(url, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bkn-studio", version: "1.0.0" } },
    }),
  });
  const sessionId = initResp.headers.get("mcp-session-id") ?? initResp.headers.get("Mcp-Session-Id");
  if (!initResp.ok && !sessionId) {
    throw new Error((await initResp.text()) || `MCP initialize 失败 (${initResp.status})`);
  }
  const sessionHeaders = sessionId ? { ...baseHeaders, "Mcp-Session-Id": sessionId } : baseHeaders;
  if (sessionId) {
    await fetch(url, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }).catch(() => undefined);
  }
  const resp = await fetch(url, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(text || `tools/list 失败 (${resp.status})`);
  }
  const parsed = parseMcpEnvelope(text);
  const result = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).result : null;
  const tools = result && typeof result === "object" ? (result as Record<string, unknown>).tools : null;
  if (!Array.isArray(tools)) {
    throw new Error("tools/list 未返回 tools 数组");
  }
  return tools
    .map((item) => {
      const tool = (item ?? {}) as Record<string, unknown>;
      return {
        name: typeof tool.name === "string" ? tool.name : "",
        description: typeof tool.description === "string" ? tool.description : undefined,
        inputSchema: tool.inputSchema,
        // MCP 规格用 outputSchema；个别实现用 output_schema，做兜底。
        outputSchema: tool.outputSchema ?? tool.output_schema,
      };
    })
    .filter((tool) => tool.name);
}

/* ============================ 会话级 MCP 客户端（Agent 对话工具执行复用） ============================ */

/**
 * 从 MCP tools/call 信封抽出文本载荷：result.content[].text 合并；
 * 无 content 时回退序列化 result；JSON-RPC error 时序列化 error。给大模型回灌用。
 */
export function mcpResultText(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object") return "";
  const envelope = parsed as Record<string, unknown>;
  const result = envelope.result;
  if (!result || typeof result !== "object") {
    return envelope.error ? JSON.stringify(envelope.error) : "";
  }
  const content = (result as Record<string, unknown>).content;
  if (Array.isArray(content)) {
    const texts = content
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).text : undefined))
      .filter((value): value is string => typeof value === "string");
    if (texts.length > 0) return texts.join("\n");
  }
  return JSON.stringify(result);
}

export type McpToolCallResult = { ok: boolean; text: string; latencyMs: number };

export type McpSession = {
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
};

/**
 * 会话级 MCP 客户端：initialize 一次、缓存并复用 Mcp-Session-Id；
 * 会话失效（400/404）时自动重连一次。供 Agent 对话的工具循环复用，避免每次调用重建会话。
 */
/** 可选鉴权：getToken 每次取新鲜 token，refresh 在 401 时刷新（OAuth 自动续期）。 */
export type McpAuth = { getToken?: () => string; refresh?: () => Promise<string | null> };

export function createMcpSession(env: ContextLoaderEnv, auth?: McpAuth): McpSession {
  const url = mcpBase(env);
  const getToken = auth?.getToken ?? (() => env.token);
  const baseHeaders = (): Record<string, string> => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };
  let sessionId: string | null = null;
  let rpcId = 1;

  async function initialize(): Promise<void> {
    const initResp = await fetch(url, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: rpcId++,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bkn-studio-agent", version: "1.0.0" } },
      }),
    });
    sessionId = initResp.headers.get("mcp-session-id") ?? initResp.headers.get("Mcp-Session-Id");
    if (!initResp.ok && !sessionId) {
      throw new Error((await initResp.text()) || `MCP initialize 失败 (${initResp.status})`);
    }
    if (sessionId) {
      await fetch(url, {
        method: "POST",
        headers: { ...baseHeaders(), "Mcp-Session-Id": sessionId },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      }).catch(() => undefined);
    }
  }

  function callOnce(name: string, args: Record<string, unknown>): Promise<Response> {
    const headers = sessionId ? { ...baseHeaders(), "Mcp-Session-Id": sessionId } : baseHeaders();
    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method: "tools/call", params: { name, arguments: args } }),
    });
  }

  return {
    async callTool(name, args) {
      const start = performance.now();
      if (!sessionId) await initialize();
      let response = await callOnce(name, args);
      if (response.status === 401 && auth?.refresh) {
        // token 过期 → 刷新后重连重试。
        await auth.refresh().catch(() => null);
        sessionId = null;
        await initialize();
        response = await callOnce(name, args);
      }
      if (response.status === 400 || response.status === 404) {
        // 会话失效 → 重连一次再试。
        sessionId = null;
        await initialize();
        response = await callOnce(name, args);
      }
      const text = await response.text();
      const parsed = parseMcpEnvelope(text);
      const payload = parsed ? mcpResultText(parsed) : text;
      return { ok: response.ok, text: payload || text, latencyMs: Math.round(performance.now() - start) };
    },
  };
}

/* ============================ 数据浏览器：知识网络 schema + 资源 ============================ */
export type KnDataSource = { type?: string; id: string; name?: string };

export type KnDataProperty = { name: string; display_name?: string; type?: string; comment?: string };

export type KnObjectType = {
  id: string;
  name?: string;
  comment?: string;
  data_source?: KnDataSource | null;
  data_properties?: KnDataProperty[] | null;
};

export type KnConceptGroup = { id: string; name?: string; object_type_ids?: string[] };

export type KnRelationType = { id: string; name?: string; sourceId: string; targetId: string };

export type KnDetail = {
  id: string;
  name?: string;
  /** 网络简介/用途（get_kn_detail 顶层 comment），适合做摘要。 */
  comment?: string;
  object_types: KnObjectType[];
  concept_groups: KnConceptGroup[];
  relation_types: KnRelationType[];
};

/** get_kn_detail 的关系类字段名各实现不一，容错取值。 */
function parseRelationTypes(raw: unknown): KnRelationType[] {
  if (!Array.isArray(raw)) return [];
  const pickId = (...candidates: unknown[]): string => {
    for (const value of candidates) {
      if (typeof value === "string" && value) return value;
      if (value && typeof value === "object") {
        const id = (value as Record<string, unknown>).id;
        if (typeof id === "string" && id) return id;
      }
    }
    return "";
  };
  return raw
    .map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      return {
        id: pickId(r.id, r.relation_type_id),
        name: typeof r.name === "string" ? r.name : undefined,
        sourceId: pickId(r.source_object_type_id, r.source_id, r.source, r.from_object_type_id, r.from),
        targetId: pickId(r.target_object_type_id, r.target_id, r.target, r.to_object_type_id, r.to),
      };
    })
    .filter((r) => r.id && r.sourceId && r.targetId);
}

/**
 * 取知识网络详情（对象类型 + 资源绑定 + 概念分组），供数据浏览器展示与「填入请求体」。
 * 走与调试台一致的真实 REST 鉴权路径（get_kn_detail 已验证可用）。
 */
export async function fetchKnDetail(env: ContextLoaderEnv): Promise<KnDetail> {
  const base = env.base.replace(/\/+$/, "");
  const response = await fetch(`${base}${REST_PREFIX}/kn/get_kn_detail`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(env) },
    body: JSON.stringify({ kn_id: env.knId }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `获取知识网络详情失败（${response.status}）`);
  }
  const data = JSON.parse(text) as Partial<KnDetail> & Record<string, unknown>;
  return {
    id: data.id ?? env.knId,
    name: data.name,
    comment: typeof data.comment === "string" ? data.comment : undefined,
    object_types: Array.isArray(data.object_types) ? data.object_types : [],
    concept_groups: Array.isArray(data.concept_groups) ? data.concept_groups : [],
    relation_types: parseRelationTypes(data.relation_types ?? data.relations),
  };
}

/**
 * 取某对象类型的样本行（query_object_instance），供数据浏览器内嵌预览。
 * 走真实 REST 鉴权路径；返回 `datas` 数组（每行一个对象）。
 */
export async function fetchObjectInstances(
  env: ContextLoaderEnv,
  otId: string,
  limit = 5,
): Promise<Record<string, unknown>[]> {
  const base = env.base.replace(/\/+$/, "");
  const params = new URLSearchParams({ kn_id: env.knId, ot_id: otId, response_format: "json" });
  const response = await fetch(`${base}${REST_PREFIX}/kn/query_object_instance?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(env) },
    body: JSON.stringify({ limit, need_total: false, properties: [] }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `查询实例失败（${response.status}）`);
  }
  const data = JSON.parse(text) as { datas?: unknown };
  return Array.isArray(data.datas) ? (data.datas as Record<string, unknown>[]) : [];
}

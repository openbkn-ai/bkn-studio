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
    group: "Schema & 查询",
    summary: "统一的 Schema 探索入口：根据自然语言探索 object / relation / action / metric types。固定 Schema-only，不返回实例数据。",
    path: `${REST_PREFIX}/kn/search_schema`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: {
      query: "查询核心业务对象与关系",
      kn_id: "your_kn_id",
      search_scope: { concept_groups: [], include_object_types: true, include_relation_types: true, include_action_types: true, include_metric_types: true },
      max_concepts: 10,
      schema_brief: false,
      enable_rerank: true,
    },
  },
  {
    id: "query_object_instance",
    group: "Schema & 查询",
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
    group: "Schema & 查询",
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
    id: "run_sql",
    group: "Schema & 查询",
    summary: "在知识网络上直接执行 SQL 查询并返回结果集。",
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
    query: [],
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
    summary: "列出当前账户可访问的业务知识网络。",
    path: `${REST_PREFIX}/kn/list_knowledge_networks`,
    query: [],
    body: {},
  },
  {
    id: "get_kn_detail",
    group: "Knowledge Network",
    summary: "查询指定知识网络的详细信息。",
    path: `${REST_PREFIX}/kn/get_kn_detail`,
    query: [],
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

export type KnDetail = {
  id: string;
  name?: string;
  object_types: KnObjectType[];
  concept_groups: KnConceptGroup[];
};

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
  const data = JSON.parse(text) as Partial<KnDetail>;
  return {
    id: data.id ?? env.knId,
    name: data.name,
    object_types: Array.isArray(data.object_types) ? data.object_types : [],
    concept_groups: Array.isArray(data.concept_groups) ? data.concept_groups : [],
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

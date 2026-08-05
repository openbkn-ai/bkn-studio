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

export type RequestDataAssistantKind = "concept-group" | "object-type" | "resource" | "relation";

/** 返回可由知识网络模型直接辅助填写的请求参数类型；无匹配时不展示参数助手。 */
export function requestDataAssistantKindOf(opId: string): RequestDataAssistantKind | null {
  switch (opId) {
    case "search_schema":
      return "concept-group";
    case "query_object_instance":
      return "object-type";
    case "run_sql":
      return "resource";
    case "query_instance_subgraph":
      return "relation";
    default:
      return null;
  }
}

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
    summary: "批量查询对象的逻辑属性值（metric / tool），自动根据 query 生成 dynamic_params。缺参时返回 missing 提示。",
    // MCP 工具名 get_logic_properties_values；REST 路由为 logic-property-resolver（见 bkn-foundry agent-retrieval）。
    path: `${REST_PREFIX}/kn/logic-property-resolver`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: {
      kn_id: "your_kn_id",
      ot_id: "your_object_type",
      query: "查询选中实例的 GMV指标、订单折扣率 当前值",
      additional_context: "instant=true；对象类详情页实例试算",
      _instance_identities: [{ order_id: "instance_000001" }],
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
 * BKN Trace 3.0 受管调用上下文。Context Loader 对每次业务调用（REST `/kn/*` POST 与
 * 除 `bkn_*` 生命周期工具外的全部 MCP tools/call）都强制要求，缺任一字段直接 400，
 * 且下游调用次数为 0。三个 id 的来源见 bkn-lifecycle.service。
 */
export type BknContext = {
  conversation_id: string;
  interaction_id: string;
  operation_key: string;
};

/**
 * 一次受管业务调用的回执引用。终结 Interaction 时必须把本轮**全部** operation 与 receipt
 * 一条不漏地列进 closure manifest（Core 按数量与归属校验，多一条少一条都报
 * `closure_manifest_invalid`），所以每次业务调用都要把它记下来。
 */
export type BknReceiptRef = { operationId: string; receiptId: string; required: boolean };

/** 从业务调用回执对象里取 operation/receipt 引用；形状不对返回 undefined。 */
export function parseBknReceipt(value: unknown): BknReceiptRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const receipt = value as Record<string, unknown>;
  const operationId = receipt.operation_id;
  const receiptId = receipt.receipt_id;
  if (typeof operationId !== "string" || !operationId) return undefined;
  if (typeof receiptId !== "string" || !receiptId) return undefined;
  // Context Loader 的受信适配器恒以 required=true 注册 Operation；缺字段时按它兜底，
  // 因为 manifest 里的 required 必须与 Core 侧登记值一致，猜 false 会被直接判非法。
  return { operationId, receiptId, required: receipt.required !== false };
}

/** 从 MCP 业务工具的 structuredContent 里取受管回执（正常执行是 bkn_receipt，重放/pending 是 receipt）。 */
export function receiptFromStructured(structured: unknown): BknReceiptRef | undefined {
  if (!structured || typeof structured !== "object") return undefined;
  const envelope = structured as Record<string, unknown>;
  return parseBknReceipt(envelope.bkn_receipt) ?? parseBknReceipt(envelope.receipt);
}

/**
 * 一次受管交互对业务调用暴露的最小接口：取上下文 + 回执记账。
 * bkn-lifecycle 的 BknTurn 结构上满足它 —— 这里不反向 import，避免两个服务互相依赖。
 */
export type BknCallScope = {
  nextContext(toolName: string): BknContext;
  recordReceipt(receipt: BknReceiptRef | undefined): void;
};

/** 把受管上下文并进业务请求体/arguments（已有 bkn_context 不覆盖）。 */
function withBknContext(
  payload: Record<string, unknown>,
  bknContext: BknContext | undefined,
): Record<string, unknown> {
  if (!bknContext || "bkn_context" in payload) return payload;
  return { ...payload, bkn_context: bknContext };
}

/** 解析请求体 JSON；非对象/非法 JSON 一律当空对象。 */
function parseBodyObject(bodyText: string): Record<string, unknown> {
  try {
    return strictBodyObject(bodyText);
  } catch {
    return {};
  }
}

/** 同上但不吞错：请求体写错时要让调用方看到 JSON 解析报错，而不是静悄悄发个空对象。 */
function strictBodyObject(bodyText: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(bodyText || "{}");
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

/**
 * MCP tools/call 的 arguments：解析请求体 JSON，并把 response_format 选择器的值
 * 注入进 arguments（MCP 没有 query，response_format 必须走 arg；不传则后端默认 toon）。
 */
function mcpCallArgs(
  bodyText: string,
  queryValues: Record<string, string>,
  bknContext?: BknContext,
): Record<string, unknown> {
  const args = parseBodyObject(bodyText);
  const responseFormat = queryValues.response_format;
  if (responseFormat && !("response_format" in args)) {
    args.response_format = responseFormat;
  }
  return withBknContext(args, bknContext);
}

export function buildCurl(
  env: ContextLoaderEnv,
  op: ContextLoaderOp,
  mode: ContextLoaderMode,
  queryValues: Record<string, string>,
  bodyText: string,
  bknContext?: BknContext,
): string {
  if (mode === "mcp") {
    const url = mcpBase(env);
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...authHeaders(env) };
    const args = mcpCallArgs(bodyText, queryValues, bknContext);
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
    // 复制出去的 curl 必须和「发送请求」发的是同一份 —— 少了 bkn_context 直接 400，
    // 拿去排查会把生命周期问题误读成业务参数问题。
    // 请求体正在编辑中（JSON 还不合法）时保留原文，别把用户写了一半的内容显示成 {}。
    let body: string;
    try {
      body = JSON.stringify(withBknContext(strictBodyObject(bodyText), bknContext));
    } catch {
      body = (bodyText || "{}").replace(/\n\s*/g, "");
    }
    curl += ` \\\n  -d '${body}'`;
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
  /** 受管回执（REST 走响应头，MCP 走 structuredContent.bkn_receipt）；终结交互时要列全。 */
  receipt?: BknReceiptRef;
};

/**
 * REST 业务响应里的受管回执：首次正常执行走响应头 `bkn-receipt-id` / `bkn-operation-id`
 * （业务响应体保持原形），终态重放或 pending 时改由响应体 `receipt` 字段带回。
 */
function restReceiptRef(response: Response, text: string): BknReceiptRef | undefined {
  const receiptId = response.headers.get("bkn-receipt-id");
  const operationId = response.headers.get("bkn-operation-id");
  if (receiptId && operationId) return { operationId, receiptId, required: true };
  try {
    const parsed = JSON.parse(text) as { receipt?: unknown };
    return parseBknReceipt(parsed.receipt);
  } catch {
    return undefined;
  }
}

/** 真实发送请求（REST 或 MCP），返回原始响应文本 + 元信息。 */
export async function sendRequest(
  env: ContextLoaderEnv,
  op: ContextLoaderOp,
  mode: ContextLoaderMode,
  queryValues: Record<string, string>,
  bodyText: string,
  auth?: McpAuth,
  signal?: AbortSignal,
  bknContext?: BknContext,
): Promise<ContextLoaderResponse> {
  const attempt = async (token: string): Promise<ContextLoaderResponse> => {
    const start = performance.now();
    const bearer: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    if (mode === "mcp") {
      // MCP Streamable HTTP：必须先 initialize 建会话（响应头 Mcp-Session-Id），
      // 再 notifications/initialized，最后才能 tools/call。
      const url = mcpBase(env);
      const baseHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...bearer,
      };
      const initResp = await fetch(url, {
        method: "POST",
        headers: baseHeaders,
        signal,
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
          signal,
          body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        }).catch(() => undefined);
      }
      const response = await fetch(url, {
        method: "POST",
        headers: sessionHeaders,
        signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: op.id, arguments: mcpCallArgs(bodyText, queryValues, bknContext) },
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
        receipt: receiptFromStructured(mcpStructuredContent(parseMcpEnvelope(text))),
      };
    }
    const url = buildRestUrl(env, op, queryValues);
    const headers = { "Content-Type": "application/json", ...bearer };
    const init: RequestInit = { method: "POST", headers, signal };
    if (op.body !== null) {
      init.body = JSON.stringify(withBknContext(strictBodyObject(bodyText), bknContext));
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
      receipt: restReceiptRef(response, text),
    };
  };

  // token 过期不自动续：401（或 MCP initialize 401）时刷新一次再重跑整条流程。
  let res = await attempt(auth?.getToken?.() ?? env.token);
  if (res.status === 401 && auth?.refresh) {
    const fresh = await auth.refresh().catch(() => null);
    res = await attempt(fresh ?? auth?.getToken?.() ?? env.token);
  }
  return res;
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
  const candidate = dataLines.length > 0 ? dataLines[dataLines.length - 1] : text;
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
export async function listMcpTools(env: ContextLoaderEnv, auth?: McpAuth, signal?: AbortSignal): Promise<McpToolDef[]> {
  // 单次完整握手；401 用哨兵透出，由外层刷新 token 后重跑（token 过期不自动续）。
  const UNAUTHORIZED = Symbol("unauthorized");
  const attempt = async (token: string): Promise<McpToolDef[] | typeof UNAUTHORIZED> => {
    const url = mcpBase(env);
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    const initResp = await fetch(url, {
      method: "POST",
      headers: baseHeaders,
      signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bkn-studio", version: "1.0.0" } },
      }),
    });
    const sessionId = initResp.headers.get("mcp-session-id") ?? initResp.headers.get("Mcp-Session-Id");
    if (initResp.status === 401 && !sessionId) return UNAUTHORIZED;
    if (!initResp.ok && !sessionId) {
      throw new Error((await initResp.text()) || `MCP initialize 失败 (${initResp.status})`);
    }
    const sessionHeaders = sessionId ? { ...baseHeaders, "Mcp-Session-Id": sessionId } : baseHeaders;
    if (sessionId) {
      await fetch(url, {
        method: "POST",
        headers: sessionHeaders,
        signal,
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      }).catch(() => undefined);
    }
    const resp = await fetch(url, {
      method: "POST",
      headers: sessionHeaders,
      signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });
    const text = await resp.text();
    if (resp.status === 401) return UNAUTHORIZED;
    if (!resp.ok) {
      throw new Error(text || `tools/list 失败 (${resp.status})`);
    }
    const parsed = parseMcpEnvelope(text);
    const result = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).result : null;
    const tools = result && typeof result === "object" ? (result as Record<string, unknown>).tools : null;
    if (!Array.isArray(tools)) {
      throw new Error("tools/list 未返回 tools 数组");
    }
    return parseToolDefs(tools);
  };

  let out = await attempt(auth?.getToken?.() ?? env.token);
  if (out === UNAUTHORIZED && auth?.refresh) {
    const fresh = await auth.refresh().catch(() => null);
    out = await attempt(fresh ?? auth?.getToken?.() ?? env.token);
  }
  if (out === UNAUTHORIZED) {
    throw new Error('{"code":"Public.Unauthorized","description":"认证失败","details":"token is invalid"}');
  }
  return out;
}

/** tools/list 原始条目 → McpToolDef[]（含 inputSchema / outputSchema 兜底）。 */
function parseToolDefs(tools: unknown[]): McpToolDef[] {
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

/**
 * 从 MCP tools/call 信封取 `result.structuredContent`。
 * 业务工具的受管回执（`bkn_receipt`）与生命周期工具的返回体都只在这里，
 * 不在 content[].text —— mcpResultText 对生命周期工具只会拿到那句人读的提示语。
 */
export function mcpStructuredContent(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return undefined;
  const result = (parsed as Record<string, unknown>).result;
  if (!result || typeof result !== "object") return undefined;
  return (result as Record<string, unknown>).structuredContent;
}

/** 解析 Context Loader REST 或 MCP 响应体为业务 JSON（或 MCP 文本载荷）。 */
export function parseContextLoaderPayload(mode: ContextLoaderMode, text: string): unknown {
  if (mode === "mcp") {
    const parsed = parseMcpEnvelope(text);
    const structured = mcpStructuredContent(parsed);
    if (structured !== undefined) {
      return structured;
    }

    const payload = mcpResultText(parsed);
    if (payload) {
      try {
        return JSON.parse(payload) as unknown;
      } catch {
        return payload;
      }
    }

    return parsed;
  }

  return JSON.parse(text) as unknown;
}

/** tools/call 是否为工具级失败（JSON-RPC 200 + result.isError，区别于 HTTP 层失败）。 */
function mcpIsError(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const result = (parsed as Record<string, unknown>).result;
  if (!result || typeof result !== "object") return false;
  return (result as Record<string, unknown>).isError === true;
}

/** JSON-RPC 协议级错误（如工具不存在），与 result.isError 的工具级失败是两回事。 */
function mcpRpcError(parsed: unknown): { code?: number; message?: string } | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const error = (parsed as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return undefined;
  const value = error as Record<string, unknown>;
  return {
    code: typeof value.code === "number" ? value.code : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
  };
}

export type McpToolCallResult = {
  ok: boolean;
  text: string;
  latencyMs: number;
  /** `result.structuredContent`：受管回执与生命周期状态都在这里。 */
  structured?: unknown;
  /** 工具级失败（HTTP 200 但 result.isError）。 */
  isError: boolean;
  /** JSON-RPC 协议级错误（工具不存在等）。 */
  rpcError?: { code?: number; message?: string };
};

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
      return {
        ok: response.ok,
        text: payload || text,
        latencyMs: Math.round(performance.now() - start),
        structured: mcpStructuredContent(parsed),
        isError: mcpIsError(parsed),
        rpcError: mcpRpcError(parsed),
      };
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
/** REST POST：注入 fresh Bearer；401（token 过期）时刷新一次再重试。 */
async function restPost(
  env: ContextLoaderEnv,
  auth: McpAuth | undefined,
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const doFetch = (token: string) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  };
  let resp = await doFetch(auth?.getToken?.() ?? env.token);
  if (resp.status === 401 && auth?.refresh) {
    const fresh = await auth.refresh().catch(() => null);
    resp = await doFetch(fresh ?? auth?.getToken?.() ?? env.token);
  }
  return resp;
}

export async function fetchKnDetail(
  env: ContextLoaderEnv,
  auth?: McpAuth,
  signal?: AbortSignal,
  scope?: BknCallScope,
): Promise<KnDetail> {
  const base = env.base.replace(/\/+$/, "");
  const params = new URLSearchParams({ response_format: "json" });
  const response = await restPost(
    env,
    auth,
    `${base}${REST_PREFIX}/kn/get_kn_detail?${params.toString()}`,
    withBknContext({ kn_id: env.knId }, scope?.nextContext("get_kn_detail")),
    signal,
  );
  const text = await response.text();
  scope?.recordReceipt(restReceiptRef(response, text));
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
  auth?: McpAuth,
  signal?: AbortSignal,
  scope?: BknCallScope,
): Promise<Record<string, unknown>[]> {
  const base = env.base.replace(/\/+$/, "");
  const params = new URLSearchParams({ kn_id: env.knId, ot_id: otId, response_format: "json" });
  const response = await restPost(
    env,
    auth,
    `${base}${REST_PREFIX}/kn/query_object_instance?${params.toString()}`,
    withBknContext({ limit, need_total: false, properties: [] }, scope?.nextContext("query_object_instance")),
    signal,
  );
  const text = await response.text();
  scope?.recordReceipt(restReceiptRef(response, text));
  if (!response.ok) {
    throw new Error(text || `查询实例失败（${response.status}）`);
  }
  const data = JSON.parse(text) as { datas?: unknown };
  return Array.isArray(data.datas) ? (data.datas as Record<string, unknown>[]) : [];
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Knowledge Network experience console for ContextLoader (agent-retrieval).
 *
 * One ContextLoader operation set is shared by REST and MCP entry points.
 * Send Request performs real HTTP calls, same-origin by default to avoid CORS.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";
import { parsePrecisionSafeJSON } from "@/framework/request/precision-safe-json";

export type ContextLoaderMode = "agent" | "rest" | "mcp";

export type OpQueryParam = {
  name: string;
  value: string;
  options?: string[];
  required?: boolean;
};

export type ContextLoaderOp = {
  id: string;
  summary: string;
  /** Full REST path. */
  path: string;
  query: OpQueryParam[];
  body: Record<string, unknown> | null;
  /** MCP arguments; defaults to body. */
  mcpArgs?: Record<string, unknown>;
  /** Discovered and called only through MCP tools/list; hidden from REST console. */
  mcpOnly?: boolean;
};

export const REST_PREFIX = "/api/agent-retrieval/v1";

/** MCP endpoint; the gateway route is /api/agent-retrieval/v1/mcp, not root /mcp. */
export const MCP_PATH = "/api/agent-retrieval/v1/mcp/";

function languageHeaders(): Record<"Accept-Language", string> {
  return { "Accept-Language": getRuntimeConfig().locale };
}

export type RequestDataAssistantKind = "concept-group" | "object-type" | "resource" | "relation";

/** Returns the data-assistant type for operations that can be filled from KN model data. */
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
    summary: "Unified schema exploration entry. It searches object, relation, action, and metric types from natural language without returning instance data.",
    path: `${REST_PREFIX}/kn/search_schema`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: {
      query: "Find core business objects and relations",
      kn_id: "your_kn_id",
      search_scope: { concept_groups: [], include_object_types: true, include_relation_types: true, include_action_types: true, include_metric_types: true },
      max_concepts: 10,
      schema_brief: true,
      enable_rerank: true,
    },
  },
  {
    id: "query_object_instance",
    summary:
      "Queries object instance data for one object type with filtering, sorting, and pagination. " +
      "REST passes kn_id and ot_id through query; MCP passes them through arguments. " +
      "Prefer flat filters [{field, op, value}] for simple conditions. Use condition for nested or OR logic.",
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
    summary: "Queries object subgraphs through predefined relation-type paths. Multiple paths are supported, and object_types must align with relation_types order.",
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
    summary:
      "Lists data-layer resources accessible to the current account, with optional catalog_id/type filters and offset/limit pagination. " +
      "Results are already filtered by token account permissions, so the frontend must not assume global visibility.",
    path: `${REST_PREFIX}/kn/list_resources`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { catalog_id: "your_catalog_id", type: "table", offset: 0, limit: 20 },
  },
  {
    id: "describe_resource",
    summary: "Describes one data resource schema and returns connector_type plus columns. resource_id comes from list_resources entries[].resource_id.",
    path: `${REST_PREFIX}/kn/describe_resource`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { resource_id: "your_resource_id" },
  },
  {
    id: "run_sql",
    summary: "Runs SQL against knowledge-network resources and returns result rows. Table names use {{.<resource_id>}} placeholders; cross-catalog joins are not supported.",
    path: `${REST_PREFIX}/kn/run_sql`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    // Data tables must be referenced through resource placeholders, not raw table names.
    body: { kn_id: "your_kn_id", sql: "SELECT * FROM {{.resource_id}} WHERE status = 'active' LIMIT 10" },
  },
  {
    id: "get_logic_properties_values",
    summary: "Queries logical property values for objects in batch and derives dynamic_params from query when possible.",
    // MCP tool name is get_logic_properties_values; REST route is logic-property-resolver.
    path: `${REST_PREFIX}/kn/logic-property-resolver`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: {
      kn_id: "your_kn_id",
      ot_id: "your_object_type",
      query: "Query current GMV and order discount rate for selected instances",
      additional_context: "instant=true; object-type detail page instance trial",
      _instance_identities: [{ order_id: "instance_000001" }],
      properties: ["your_metric_a", "your_metric_b"],
      options: { return_debug: true },
    },
  },
  {
    id: "query_metric",
    mcpOnly: true,
    summary:
      "Queries modeled metrics using their own calculation rules. Select metric_id from get_object_types related_metrics first. " +
      "Use get_logic_properties_values for instance-level metrics bound to logical properties.",
    path: `${REST_PREFIX}/kn/query_metric`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", metric_id: "your_metric_id" },
    mcpArgs: { kn_id: "your_kn_id", metric_id: "your_metric_id" },
  },
  {
    id: "get_action_info",
    summary: "Recalls related actions from object instance identities and returns Function Call-compatible _dynamic_tools definitions.",
    path: `${REST_PREFIX}/kn/get_action_info`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", at_id: "your_action_type", _instance_identities: [{ id: "instance_000001" }, { id: "instance_000002" }] },
  },
  {
    id: "find_skills",
    summary: "Recalls candidate skills from business context. kn_id and object_type_id are object-type level; instance_identities make it instance-level.",
    path: `${REST_PREFIX}/kn/find_skills`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", object_type_id: "your_object_type", instance_identities: [{ id: "instance_000001" }], skill_query: "Example skill search", top_k: 10 },
  },
  {
    id: "list_knowledge_networks",
    summary: "Lists business knowledge networks accessible to the current account, with filtering, pagination, and sorting.",
    path: `${REST_PREFIX}/kn/list_knowledge_networks`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { limit: 20, offset: 0 },
  },
  {
    id: "get_kn_detail",
    summary: "Returns details for a specified knowledge network.",
    mcpOnly: true,
    path: `${REST_PREFIX}/kn/get_kn_detail`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id" },
  },
  {
    id: "get_object_types",
    summary:
      "Fetches full object-type definitions by id, including data_properties and logic_properties. Use get_kn_detail first, then expand selected ids here.",
    path: `${REST_PREFIX}/kn/get_object_types`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", ids: ["your_object_type"] },
  },
  {
    id: "get_relation_types",
    summary: "Fetches full relation-type definitions by id, including mapping rules and source/target object names.",
    path: `${REST_PREFIX}/kn/get_relation_types`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", ids: ["your_relation_type"] },
  },
  {
    id: "execute_action",
    summary:
      "Executes an action asynchronously and returns execution_id. Use get_action_info first to obtain the dynamic_params schema.",
    path: `${REST_PREFIX}/kn/execute_action`,
    query: [],
    body: {
      kn_id: "your_kn_id",
      at_id: "your_action_type",
      _instance_identities: [{ id: "instance_000001" }],
      dynamic_params: {},
    },
  },
  {
    id: "get_action_execution",
    summary: "Returns one action execution status and results. execution_id is returned by execute_action.",
    path: `${REST_PREFIX}/kn/get_action_execution`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", execution_id: "your_execution_id" },
  },
  {
    id: "list_action_executions",
    summary: "Lists action execution history with optional action type, status, trigger, and pagination filters.",
    path: `${REST_PREFIX}/kn/list_action_executions`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body: { kn_id: "your_kn_id", status: "completed", offset: 0, limit: 20 },
  },
];

/** The REST console only shows operations with REST workflows. */
export const REST_CONTEXT_LOADER_OPS = CONTEXT_LOADER_OPS.filter((op) => !op.mcpOnly);

export function mcpPathOf(op: ContextLoaderOp): string {
  return op.path.startsWith(REST_PREFIX) ? op.path.slice(REST_PREFIX.length) : op.path;
}

export type ContextLoaderEnv = {
  base: string;
  token: string;
  /** Locked knowledge-network slug (kn_id). */
  knId: string;
};

export function authHeaders(env: ContextLoaderEnv): Record<string, string> {
  // The gateway derives account identity from the Bearer token.
  const headers: Record<string, string> = {};
  if (env.token) headers.Authorization = `Bearer ${env.token}`;
  return headers;
}

/** Injects the current network slug into body or mcpArgs, then formats JSON text. */
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

/* ============================ Test Data Fill ============================ */
// Builds directly sendable request bodies from the current KN schema and sample rows.
// Only operations with values inferable from get_kn_detail or sample rows are covered.

const TEST_DATA_OPS = new Set([
  "query_object_instance",
  "run_sql",
  "search_schema",
  "get_kn_detail",
  "query_instance_subgraph",
  "get_object_types",
  "get_relation_types",
  "query_metric",
  "describe_resource",
  "list_resources",
]);

/** Whether this operation supports test-data fill. */
export function opSupportsTestData(opId: string): boolean {
  return TEST_DATA_OPS.has(opId);
}

/** Picks an object type bound to a data resource so sample data can be queried. */
export function pickQueryableObjectType(detail: KnDetail): KnObjectType | null {
  return detail.object_types.find((o) => Boolean(o.data_source?.id)) ?? null;
}

/** Picks one non-empty scalar field from a sample row, preferring schema data_properties. */
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

/** Builds one query_instance_subgraph path from a relation type. */
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
 * Builds a test request body for supported operations. The caller prefetches ot/sampleRow
 * according to operation needs: query_object_instance needs both; run_sql only needs a
 * resource-bound ot; schema and KN detail requests need neither.
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
      return { body: JSON.stringify({ kn_id: knId }, null, 2), note: "Filled current kn_id" };

    case "search_schema": {
      const groupId = detail.concept_groups[0]?.id;
      const body = {
        query: "Find core business objects and relations",
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
      return { body: JSON.stringify(body, null, 2), note: groupId ? `kn_id + real concept group ${groupId}` : "Filled kn_id" };
    }

    case "run_sql": {
      const resId = ot?.data_source?.id ?? "";
      const body = { kn_id: knId, sql: `SELECT * FROM {{.${resId}}} LIMIT 10` };
      return { body: JSON.stringify(body, null, 2), note: `Resource ${resId}` };
    }

    case "query_instance_subgraph": {
      const otIds = new Set(detail.object_types.map((o) => o.id));
      const rels = detail.relation_types ?? [];
      const rel = rels.find((r) => otIds.has(r.sourceId) && otIds.has(r.targetId)) ?? rels[0] ?? null;
      if (!rel) {
        return { body: exampleBodyText(op, mode, knId), note: "No relation types found in get_kn_detail; fill manually" };
      }
      const path = subgraphPathFor(rel);
      const note = `Relation type ${rel.name || rel.id} (${rel.sourceId} -> ${rel.targetId})`;
      if (mode === "mcp") {
        return { body: JSON.stringify({ kn_id: knId, relation_type_paths: [path] }, null, 2), note };
      }
      return { body: JSON.stringify({ relation_type_paths: [path] }, null, 2), query: { kn_id: knId }, note };
    }

    case "query_object_instance": {
      const ff = ot ? pickFilterFieldValue(ot, sampleRow) : null;
      const filters = ff ? [{ field: ff.field, op: "==", value: ff.value }] : [];
      const otId = ot?.id ?? "";
      const note = ff ? `Object type ${otId}, filter ${ff.field} == ${ff.value}` : `Object type ${otId} (no sample row; no filter added)`;
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
        note: ids.length ? `First ${ids.length} object types` : "This network has no object types; fill ids manually",
      };
    }

    case "get_relation_types": {
      const ids = detail.relation_types
        .slice(0, 3)
        .map((r) => r.id)
        .filter(Boolean);
      return {
        body: JSON.stringify({ kn_id: knId, ids }, null, 2),
        note: ids.length ? `First ${ids.length} relation types` : "This network has no relation types; fill ids manually",
      };
    }

    case "query_metric": {
      const usableMetrics = (ot?.related_metrics ?? []).filter((item) => Boolean(item.id));
      const metric = usableMetrics.find((item) => !item.time_dimension) ?? usableMetrics[0];
      if (!metric) {
        return { body: exampleBodyText(op, mode, knId), note: "No metrics found in object-type details; call get_object_types first" };
      }
      const body: Record<string, unknown> = { kn_id: knId, metric_id: metric.id };
      if (metric.time_dimension) body.time = { instant: true };
      return {
        body: JSON.stringify(body, null, 2),
        note: `Metric ${metric.name || metric.id} (object type ${ot?.name || ot?.id})`,
      };
    }

    case "describe_resource": {
      const resId = detail.object_types.find((o) => o.data_source?.id)?.data_source?.id ?? "";
      return {
        body: JSON.stringify({ resource_id: resId }, null, 2),
        note: resId ? `Resource ${resId} (from object-type binding)` : "This network has no object-type resource binding; fill resource_id manually",
      };
    }

    case "list_resources":
      return { body: JSON.stringify({ type: "table", offset: 0, limit: 20 }, null, 2), note: "First 20 table resources" };

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
 * Managed BKN Trace 3.0 call context. Context Loader requires it for every
 * business call, including REST `/kn/*` POST and MCP tools/call except `bkn_*`
 * lifecycle tools. Missing fields return 400 before any downstream call.
 */
export type BknContext = {
  conversation_id: string;
  interaction_id: string;
};

/**
 * Minimal interface exposed to business calls by one managed interaction.
 * BknTurn structurally satisfies it, but this module avoids importing lifecycle
 * code to keep the two services decoupled.
 */
export type BknCallScope = {
  nextContext(): BknContext;
};

/** Merges managed context into request body or arguments without overwriting bkn_context. */
/* ============================ Tool Summary Display ============================ */
/**
 * Length past which a tool summary is collapsed in the UI.
 *
 * Tool descriptions serve the model, not the reader: run_code carries the whole
 * code-mode rulebook at roughly 4.5k characters. Rendering that inline pushes
 * the parameters and the run button off the panel, so the operation cannot be
 * exercised at all. Business tools sit at 90-160 characters, hence a threshold
 * with room to spare above them — anything under it keeps rendering as before.
 */
export const TOOL_SUMMARY_COLLAPSE_CHARS = 240;

/** Whether this summary is long enough to need the collapsed treatment. */
export function isLongToolSummary(summary: string): boolean {
  return summary.length > TOOL_SUMMARY_COLLAPSE_CHARS;
}

/**
 * First readable chunk of a long summary, for the collapsed state.
 *
 * Cuts on the first blank line, then on a sentence end, so the preview reads as
 * a finished thought rather than a severed clause. Falls back to a hard cut when
 * the text offers neither within range.
 */
export function toolSummaryPreview(summary: string): string {
  if (!isLongToolSummary(summary)) return summary;
  const paragraph = summary.indexOf("\n\n");
  if (paragraph > 0 && paragraph <= TOOL_SUMMARY_COLLAPSE_CHARS) {
    return summary.slice(0, paragraph).trim();
  }
  const window = summary.slice(0, TOOL_SUMMARY_COLLAPSE_CHARS);
  const sentence = Math.max(window.lastIndexOf("。"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
  if (sentence > TOOL_SUMMARY_COLLAPSE_CHARS / 3) {
    return window.slice(0, sentence + 1).trim();
  }
  return window.trim() + "…";
}

/* ============================ Synthesized Ops (schema-driven) ============================ */
function sampleForSchemaProp(def: unknown): unknown {
  if (!def || typeof def !== "object") return "";
  const d = def as Record<string, unknown>;
  if (d.default !== undefined) return d.default;
  if (Array.isArray(d.enum) && d.enum.length > 0) return d.enum[0];
  switch (d.type) {
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

/**
 * Builds an example request body from a tool inputSchema for synthesized ops.
 *
 * `bkn_context` is skipped even though the backend marks it required. It is
 * platform identity injected at send time, not a caller parameter — the same
 * reason stripBknContextSchema removes it from the schema shown to the model.
 * Emitting it here would produce `"bkn_context": {}`, which reads as "fill this
 * in yourself" and, worse, counts as a caller-supplied override that suppresses
 * the real injection, so every synthesized op would answer conversation_required.
 */
export function exampleBodyFromSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return {};
  const s = schema as Record<string, unknown>;
  const props = (s.properties && typeof s.properties === "object" ? s.properties : {}) as Record<string, unknown>;
  const required = Array.isArray(s.required) ? (s.required as string[]) : [];
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(props)) {
    if (key === "bkn_context") continue;
    if (required.includes(key) || key === "kn_id" || key === "response_format") {
      out[key] = sampleForSchemaProp(def);
    }
  }
  return out;
}

/** Converts live MCP tools/list entries into ContextLoaderOp when no local op exists. */
export function synthesizeOp(tool: McpToolDef): ContextLoaderOp {
  const body = exampleBodyFromSchema(tool.inputSchema);
  return {
    id: tool.name,
    summary: tool.description ?? tool.name,
    path: `${REST_PREFIX}/kn/${tool.name}`,
    query: [{ name: "response_format", value: "json", options: ["json", "toon"] }],
    body,
    mcpArgs: body,
  };
}

function withBknContext(
  payload: Record<string, unknown>,
  bknContext: BknContext | undefined,
): Record<string, unknown> {
  if (!bknContext || hasUsableBknContext(payload)) return payload;
  return { ...payload, bkn_context: bknContext };
}

function isLifecycleTool(op: ContextLoaderOp): boolean {
  return op.id === "bkn_start_interaction" || op.id === "bkn_finish_interaction";
}

function withOperationContext(
  op: ContextLoaderOp,
  payload: Record<string, unknown>,
  bknContext: BknContext | undefined,
): Record<string, unknown> {
  return isLifecycleTool(op) ? payload : withBknContext(payload, bknContext);
}

/**
 * Whether the payload already carries a context worth keeping.
 *
 * Presence of the key is not enough. Context Loader requires both ids on every
 * business tool, so a `bkn_context` that lacks either one is not an override —
 * it is a placeholder, and treating it as one silently drops the real context
 * and gets the call rejected with conversation_required.
 */
function hasUsableBknContext(payload: Record<string, unknown>): boolean {
  const value = payload.bkn_context;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const context = value as Record<string, unknown>;
  return (
    typeof context.conversation_id === "string" &&
    context.conversation_id.trim() !== "" &&
    typeof context.interaction_id === "string" &&
    context.interaction_id.trim() !== ""
  );
}

/** Parses request-body JSON; non-object or invalid JSON falls back to an empty object. */
function parseBodyObject(bodyText: string): Record<string, unknown> {
  try {
    return strictBodyObject(bodyText);
  } catch {
    return {};
  }
}

/** Strict variant that lets callers see JSON parse errors. */
function strictBodyObject(bodyText: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(bodyText || "{}");
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

/**
 * Builds MCP tools/call arguments from request-body JSON and injects the
 * response_format selector because MCP has no query string.
 */
function mcpCallArgs(
  op: ContextLoaderOp,
  bodyText: string,
  queryValues: Record<string, string>,
  bknContext?: BknContext,
): Record<string, unknown> {
  const args = parseBodyObject(bodyText);
  const responseFormat = queryValues.response_format;
  if (responseFormat && !("response_format" in args)) {
    args.response_format = responseFormat;
  }
  return withOperationContext(op, args, bknContext);
}

function displayAuthHeaders(env: ContextLoaderEnv): Record<string, string> {
  const headers = authHeaders(env);
  return headers.Authorization ? { ...headers, Authorization: "Bearer <redacted>" } : headers;
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
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...languageHeaders(), ...displayAuthHeaders(env) };
    const args = mcpCallArgs(op, bodyText, queryValues, bknContext);
    const payload = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: op.id, arguments: args } };
    let curl = `curl -X POST '${url}'`;
    Object.entries(headers).forEach(([key, value]) => {
      curl += ` \\\n  -H '${key}: ${value}'`;
    });
    curl += ` \\\n  -d '${JSON.stringify(payload)}'`;
    return curl;
  }
  const url = buildRestUrl(env, op, queryValues);
  const headers = { "Content-Type": "application/json", ...languageHeaders(), ...displayAuthHeaders(env) };
  let curl = `curl -X POST '${url}'`;
  Object.entries(headers).forEach(([key, value]) => {
    curl += ` \\\n  -H '${key}: ${value}'`;
  });
  if (op.body !== null) {
    // Copied curl must match Send Request exactly, including bkn_context.
    // If the body is being edited and is not valid JSON yet, preserve user text.
    let body: string;
    try {
      body = JSON.stringify(withOperationContext(op, strictBodyObject(bodyText), bknContext));
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
};

/** Sends a real REST or MCP request and returns raw response text plus metadata. */
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
      // MCP Streamable HTTP requires initialize, notifications/initialized, then tools/call.
      const url = mcpBase(env);
      const baseHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...languageHeaders(),
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
          text: initText || "MCP initialize failed; missing session id (Mcp-Session-Id).",
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
          params: { name: op.id, arguments: mcpCallArgs(op, bodyText, queryValues, bknContext) },
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
    const headers = { "Content-Type": "application/json", ...languageHeaders(), ...bearer };
    const init: RequestInit = { method: "POST", headers, signal };
    if (op.body !== null) {
      init.body = JSON.stringify(withOperationContext(op, strictBodyObject(bodyText), bknContext));
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
  };

  // Token expiry is handled by refreshing once and retrying the whole flow.
  let res = await attempt(auth?.getToken?.() ?? env.token);
  if (res.status === 401 && auth?.refresh) {
    const fresh = await auth.refresh().catch(() => null);
    res = await attempt(fresh ?? auth?.getToken?.() ?? env.token);
  }
  return res;
}

/* ============================ MCP Tool Discovery (tools/list) ============================ */
/**
 * `_meta` keys for display metadata. MCP reserves `modelcontextprotocol.io/`
 * and `mcp.dev/`, while vendor fields use `openbkn.ai/`.
 */
const TOOL_META_GROUP = "openbkn.ai/group";
const TOOL_META_GROUP_TITLE = "openbkn.ai/group_title";
const TOOL_META_ORDER = "openbkn.ai/order";

export type McpToolDef = {
  name: string;
  description?: string;
  /** Display name from MCP 2025-06-18; old servers omit it and fall back to name. */
  title?: string;
  /** Display group key and label from `_meta`; local fallback is used when absent. */
  group?: string;
  groupTitle?: string;
  /** In-group sort order from `_meta`; absent entries sort at the group tail. */
  order?: number;
  inputSchema?: unknown;
  outputSchema?: unknown;
};

/** Parses an MCP response, using the last SSE data line when present. */
function parseMcpEnvelope(text: string): unknown {
  const dataLines = text
    .split("\n")
    .filter((line) => line.trimStart().startsWith("data:"))
    .map((line) => line.replace(/^\s*data:/, "").trim())
    .filter(Boolean);
  const candidate = dataLines.length > 0 ? dataLines[dataLines.length - 1] : text;
  try {
    return parsePrecisionSafeJSON(candidate);
  } catch {
    return null;
  }
}

/**
 * Dynamically discovers MCP tools with inputSchema through the full handshake.
 * Used for tool discovery, drift checks, and schema-driven forms.
 */
export async function listMcpTools(env: ContextLoaderEnv, auth?: McpAuth, signal?: AbortSignal): Promise<McpToolDef[]> {
  // One full handshake per attempt; 401 is surfaced to the outer refresh path.
  const UNAUTHORIZED = Symbol("unauthorized");
  const attempt = async (token: string): Promise<McpToolDef[] | typeof UNAUTHORIZED> => {
    const url = mcpBase(env);
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...languageHeaders(),
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
      throw new Error((await initResp.text()) || `MCP initialize failed (${initResp.status})`);
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
      throw new Error(text || `tools/list failed (${resp.status})`);
    }
    const parsed = parseMcpEnvelope(text);
    const result = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).result : null;
    const tools = result && typeof result === "object" ? (result as Record<string, unknown>).tools : null;
    if (!Array.isArray(tools)) {
      throw new Error("tools/list did not return a tools array");
    }
    return parseToolDefs(tools);
  };

  let out = await attempt(auth?.getToken?.() ?? env.token);
  if (out === UNAUTHORIZED && auth?.refresh) {
    const fresh = await auth.refresh().catch(() => null);
    out = await attempt(fresh ?? auth?.getToken?.() ?? env.token);
  }
  if (out === UNAUTHORIZED) {
    throw new Error('{"code":"Public.Unauthorized","description":"Authentication failed","details":"token is invalid"}');
  }
  return out;
}

/** Treats empty strings as absent so display labels do not render blank. */
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Converts raw tools/list entries to McpToolDef[] with display metadata and schema fallbacks. */
function parseToolDefs(tools: unknown[]): McpToolDef[] {
  return tools
    .map((item) => {
      const tool = (item ?? {}) as Record<string, unknown>;
      const meta = (tool._meta && typeof tool._meta === "object" ? tool._meta : {}) as Record<string, unknown>;
      const order = meta[TOOL_META_ORDER];
      return {
        name: typeof tool.name === "string" ? tool.name : "",
        description: typeof tool.description === "string" ? tool.description : undefined,
        title: optionalText(tool.title),
        group: optionalText(meta[TOOL_META_GROUP]),
        groupTitle: optionalText(meta[TOOL_META_GROUP_TITLE]),
        order: typeof order === "number" && Number.isFinite(order) ? order : undefined,
        inputSchema: tool.inputSchema,
        // MCP specifies outputSchema; tolerate output_schema from some implementations.
        outputSchema: tool.outputSchema ?? tool.output_schema,
      };
    })
    .filter((tool) => tool.name);
}

/* ============================ Session-Level MCP Client ============================ */

/**
 * Extracts text payload from an MCP tools/call envelope for model feedback.
 * It joins result.content[].text, falls back to serialized result, or serializes errors.
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
 * Reads `result.structuredContent` from an MCP tools/call envelope.
 * Business receipts and lifecycle payloads are returned here, not in content[].text.
 */
export function mcpStructuredContent(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return undefined;
  const result = (parsed as Record<string, unknown>).result;
  if (!result || typeof result !== "object") return undefined;
  return (result as Record<string, unknown>).structuredContent;
}

/** Whether tools/call is a tool-level failure, separate from HTTP failure. */
function mcpIsError(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const result = (parsed as Record<string, unknown>).result;
  if (!result || typeof result !== "object") return false;
  return (result as Record<string, unknown>).isError === true;
}

/** JSON-RPC protocol error, such as a missing tool, separate from result.isError. */
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
  /** `result.structuredContent`, including managed receipts and lifecycle state. */
  structured?: unknown;
  /** Tool-level failure, where HTTP is 200 but result.isError is true. */
  isError: boolean;
  /** JSON-RPC protocol error, for example a missing tool. */
  rpcError?: { code?: number; message?: string };
};

export type McpSession = {
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
};

/**
 * Session-level MCP client. It initializes once, reuses Mcp-Session-Id, and
 * reconnects once when the session expires.
 */
/** Optional auth hooks: getToken reads a fresh token, refresh handles 401. */
export type McpAuth = { getToken?: () => string; refresh?: () => Promise<string | null> };

export function createMcpSession(env: ContextLoaderEnv, auth?: McpAuth): McpSession {
  const url = mcpBase(env);
  const getToken = auth?.getToken ?? (() => env.token);
  const baseHeaders = (): Record<string, string> => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...languageHeaders(),
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
      throw new Error((await initResp.text()) || `MCP initialize failed (${initResp.status})`);
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
        // Token expired; refresh, reconnect, and retry.
        await auth.refresh().catch(() => null);
        sessionId = null;
        await initialize();
        response = await callOnce(name, args);
      }
      if (response.status === 400 || response.status === 404) {
        // Session expired; reconnect once and retry.
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

/* ============================ Data Browser: KN Schema and Resources ============================ */
export type KnDataSource = { type?: string; id: string; name?: string };

export type KnDataProperty = { name: string; display_name?: string; type?: string; comment?: string };

export type KnRelatedMetric = {
  id: string;
  name?: string;
  comment?: string;
  metric_type?: string;
  unit?: string;
  unit_type?: string;
  scope_ref?: string;
  analysis_dimensions?: string[];
  time_dimension?: string;
};

export type KnObjectType = {
  id: string;
  name?: string;
  comment?: string;
  data_source?: KnDataSource | null;
  data_properties?: KnDataProperty[] | null;
  related_metrics?: KnRelatedMetric[];
  related_metric_count?: number;
};

export type KnConceptGroup = { id: string; name?: string; object_type_ids?: string[] };

export type KnRelationType = { id: string; name?: string; sourceId: string; targetId: string };

export type KnDetail = {
  id: string;
  name?: string;
  /** Network summary or purpose from get_kn_detail top-level comment. */
  comment?: string;
  object_types: KnObjectType[];
  concept_groups: KnConceptGroup[];
  relation_types: KnRelationType[];
};

/** Relation-type field names vary by get_kn_detail implementation, so parse tolerantly. */
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

function normalizeKnDetailPayload(
  data: Partial<KnDetail> & Record<string, unknown>,
  fallbackId: string,
): KnDetail {
  return {
    id: data.id ?? fallbackId,
    name: data.name,
    comment: typeof data.comment === "string" ? data.comment : undefined,
    object_types: Array.isArray(data.object_types) ? data.object_types : [],
    concept_groups: Array.isArray(data.concept_groups) ? data.concept_groups : [],
    relation_types: parseRelationTypes(data.relation_types ?? data.relations),
  };
}

function knDetailFromMcpPayload(payload: unknown, fallbackId: string): KnDetail | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Partial<KnDetail> & Record<string, unknown>;
  const data = record.data;
  const candidate =
    data && typeof data === "object"
      ? (data as Partial<KnDetail> & Record<string, unknown>)
      : record;

  if (
    !("object_types" in candidate) &&
    !("concept_groups" in candidate) &&
    !("relation_types" in candidate) &&
    !("relations" in candidate)
  ) {
    return null;
  }

  return normalizeKnDetailPayload(candidate, fallbackId);
}

/**
 * Fetches knowledge-network detail for the data browser and test-data fill.
 */
/** REST POST with fresh Bearer injection and one retry after 401. */
async function restPost(
  env: ContextLoaderEnv,
  auth: McpAuth | undefined,
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const doFetch = (token: string) => {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...languageHeaders() };
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
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const result = await createMcpSession(env, auth).callTool(
    "get_kn_detail",
    withBknContext(
      { kn_id: env.knId, response_format: "json" },
      scope?.nextContext(),
    ),
  );

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  if (!result.ok || result.isError || result.rpcError) {
    throw new Error(result.rpcError?.message || result.text || "get_kn_detail failed");
  }

  const fromStructured = knDetailFromMcpPayload(result.structured, env.knId);
  if (fromStructured) {
    return fromStructured;
  }

  try {
    const fromText = knDetailFromMcpPayload(parsePrecisionSafeJSON(result.text), env.knId);
    if (fromText) {
      return fromText;
    }
  } catch {
    // JSON response requested; fall through to the normalized error below.
  }

  throw new Error("get_kn_detail did not return knowledge network detail");
}

export async function fetchKnDetailRestLegacy(
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
    withBknContext({ kn_id: env.knId }, scope?.nextContext()),
    signal,
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Failed to fetch knowledge network detail (${response.status})`);
  }
  const data = parsePrecisionSafeJSON(text) as Partial<KnDetail> & Record<string, unknown>;
  return {
    id: data.id ?? env.knId,
    name: data.name,
    comment: typeof data.comment === "string" ? data.comment : undefined,
    object_types: Array.isArray(data.object_types) ? data.object_types : [],
    concept_groups: Array.isArray(data.concept_groups) ? data.concept_groups : [],
    relation_types: parseRelationTypes(data.relation_types ?? data.relations),
  };
}

/** Fetches object-type details through MCP so metric tools can choose real metric_id values. */
export async function fetchMcpObjectTypes(
  session: McpSession,
  knId: string,
  ids: string[],
  scope?: BknCallScope,
): Promise<KnObjectType[]> {
  const result = await session.callTool(
    "get_object_types",
    withBknContext({ kn_id: knId, ids, response_format: "json" }, scope?.nextContext()),
  );
  if (!result.ok || result.isError || result.rpcError) {
    throw new Error(result.rpcError?.message || result.text || "Failed to fetch object-type details");
  }
  const fromStructured = objectTypesFromMcpPayload(result.structured);
  if (fromStructured) return fromStructured;
  try {
    const fromText = objectTypesFromMcpPayload(JSON.parse(result.text) as unknown);
    if (fromText) return fromText;
  } catch {
    // JSON response was requested; use the normalized error below if parsing still fails.
  }
  throw new Error("get_object_types did not return object_types");
}

function objectTypesFromMcpPayload(payload: unknown): KnObjectType[] | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.object_types)) return record.object_types as KnObjectType[];
  const data = record.data;
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).object_types)) {
    return (data as Record<string, unknown>).object_types as KnObjectType[];
  }
  return null;
}

/**
 * Fetches sample rows for one object type through query_object_instance.
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
    withBknContext({ limit, need_total: false, properties: [] }, scope?.nextContext()),
    signal,
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Failed to query object instances (${response.status})`);
  }
  const data = parsePrecisionSafeJSON(text) as { datas?: unknown };
  return Array.isArray(data.datas) ? (data.datas as Record<string, unknown>[]) : [];
}

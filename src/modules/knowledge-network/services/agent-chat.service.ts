/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Knowledge Network experience Agent chat, orchestrated in the frontend.
 *
 * Hybrid approach: Vercel AI SDK handles multi-step tool loops and streaming;
 * tool execution reuses the ContextLoader session-level MCP client.
 * Models go through the Model Factory OpenAI-compatible gateway.
 * Conversation context is cached in the frontend and replayed each turn.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { jsonSchema, stepCountIs, streamText, tool, type ModelMessage, type ToolSet } from "ai";

import {
  isRetryableStatus,
  normalizeAgentError,
  parseModelFactoryEnvelope,
  MF_RETRYABLE_CODES,
  type NormalizedAgentError,
} from "@/modules/knowledge-network/services/agent-error";
import {
  isPlatformManagedTool,
  type TurnOutcome,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import {
  createMcpSession,
  type BknCallScope,
  type BknContext,
  type ContextLoaderEnv,
  type McpSession,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

/** Model Factory OpenAI-compatible prefix, aligned with model-api-guide. */
export const MODEL_API_PATH = "/api/mf-model-api/v1";

/**
 * Tunable Agent chat parameters. Stored in localStorage and applied live by the UI.
 */
export type AgentConfig = {
  /** Tool-step cap; normal runs stop when the model returns the final answer. */
  maxSteps: number;
  /** Between-step eviction: keep this many recent full tool results; 0 disables eviction. */
  keepToolResults: number;
  /** Result character cap for data tools such as run_sql and query_*; 0 disables truncation. */
  dataToolCap: number;
  /** Result character cap for schema/discovery tools; 0 disables truncation. */
  schemaToolCap: number;
  /** Number of recent turns retained in multi-turn history. */
  maxHistoryMessages: number;
  /** Per-turn history text character cap. */
  maxTurnChars: number;
  /** Max output tokens per step, including reasoning; 0 uses the model default. */
  maxOutputTokens: number;
};

/** Default tool set for the base-data pane: table/SQL capabilities only. */
export const BASE_DATA_TOOL_NAMES = ["list_resources", "describe_resource", "run_sql"];

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxSteps: 40,
  keepToolResults: 3,
  dataToolCap: 8000,
  schemaToolCap: 24000,
  maxHistoryMessages: 16,
  maxTurnChars: 4000,
  maxOutputTokens: 16384,
};

/** Schema/discovery tools are large but bounded, so they use the wider schemaToolCap. */
const SCHEMA_TOOLS = new Set([
  "get_kn_detail",
  "search_schema",
  "describe_resource",
  "list_resources",
  "find_skills",
  "get_action_info",
]);

function capToolResult(text: string, toolName: string, cfg: AgentConfig): string {
  const limit = SCHEMA_TOOLS.has(toolName) ? cfg.schemaToolCap : cfg.dataToolCap;
  if (limit <= 0 || text.length <= limit) return text;
  const dropped = text.length - limit;
  return (
    text.slice(0, limit) +
    `\n\n...[Result too long; about ${dropped} characters were truncated. Query again with narrower filters, a smaller LIMIT, and only necessary fields. Do not scan whole tables or repeat already retrieved information.]`
  );
}

/**
 * Formats the currently effective result caps for the system prompt. The values
 * must reflect live settings rather than hardcoded defaults.
 */
export function formatToolResultLimits(cfg: AgentConfig): string {
  const parts: string[] = [];
  if (cfg.dataToolCap > 0) parts.push(`data tools such as run_sql and query_*: about ${cfg.dataToolCap} characters`);
  if (cfg.schemaToolCap > 0) {
    parts.push(`schema/discovery tools such as search_schema, describe_resource, and list_resources: about ${cfg.schemaToolCap} characters`);
  }
  if (!parts.length) return "";
  return (
    `## Tool Result Length Limits\nA single tool result beyond the cap will be truncated and the overflow is lost: ${parts.join("; ")}. ` +
    "Push filtering and aggregation into queries, split into small batches when needed, and do not treat truncated results as complete data."
  );
}

/** Query constraints appended to large-result tool descriptions. */
const TOOL_HINTS: Record<string, string> = {
  run_sql:
    " Important: use SQL for aggregation/counting/sorting/grouping with LIMIT, select only necessary columns, and avoid SELECT * or full table scans. Large results will be truncated.",
  query_object_instance:
    " Important: use precise filters, a small limit, and properties for necessary fields only. Large results will be truncated.",
  query_instance_subgraph: " Important: use the smallest practical limit. Large results will be truncated.",
  list_resources: " Important: filter by catalog_id/type and use small paged limits. Large results will be truncated.",
  search_schema:
    " Recommendation: use a precise query and keep max_concepts at or below 10 by default. Large results will be truncated. schema_brief defaults to true; pass schema_brief=false only when full field definitions are needed.",
  get_action_info:
    " Important: obtain real instance identifiers from _instance_identity returned by query_object_instance or query_instance_subgraph, then provide nonempty _instance_identities. Never invent instance identifiers.",
  execute_action:
    " Important: provide nonempty _instance_identities and dynamic_params. Conversational execution cannot scan empty instances; targets must come from upstream _instance_identity values.",
};

/** Common default arguments for all tools; model-provided values win. */
const GLOBAL_ARG_DEFAULTS: Record<string, unknown> = { response_format: "toon" };

/** Default arguments injected when the model does not provide explicit values. */
const TOOL_ARG_DEFAULTS: Record<string, Record<string, unknown>> = {
  // Brief summaries cover most discovery flows and save tokens.
  search_schema: { schema_brief: true },
};

/** Final MCP arguments combine common defaults, tool defaults, model input, locked kn_id, and managed context. */
export function effectiveToolArgs(
  name: string,
  input: unknown,
  knId: string,
  bknContext?: BknContext,
): Record<string, unknown> {
  const args: Record<string, unknown> = {
    ...GLOBAL_ARG_DEFAULTS,
    ...TOOL_ARG_DEFAULTS[name],
    ...(input && typeof input === "object" ? (input as Record<string, unknown>) : {}),
    kn_id: knId,
  };
  // Platform context is trusted identity data and must not be overwritten by model output.
  if (bknContext) args.bkn_context = bknContext;
  return args;
}

/**
 * Removes `bkn_context` from tool input schemas. The backend includes it in
 * business tools, but true values are injected by execute and should not be
 * invented by the model.
 */
function stripBknContextSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties;
  if (!properties || typeof properties !== "object" || !("bkn_context" in properties)) return schema;
  const nextProperties = { ...(properties as Record<string, unknown>) };
  delete nextProperties.bkn_context;
  const next: Record<string, unknown> = { ...schema, properties: nextProperties };
  if (Array.isArray(schema.required)) {
    next.required = schema.required.filter((name) => name !== "bkn_context");
  }
  return next;
}

function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toolGuardError(code: string, message: string, requiredFields: string[]): string {
  return JSON.stringify({
    error: {
      code,
      message,
      required_fields: requiredFields,
      retryable: false,
    },
  });
}

/**
 * Blocks high-risk business tools when missing fields would broaden the call
 * from an instance-level intent into broad recall, broad query, or execution.
 */
export function guardAgentToolArgs(name: string, args: Record<string, unknown>): string | null {
  if (name === "get_action_info") {
    const missing = [
      ...(typeof args.at_id === "string" && args.at_id.trim() ? [] : ["at_id"]),
      ...(isNonEmptyArray(args._instance_identities) ? [] : ["_instance_identities"]),
    ];
    if (missing.length) {
      return toolGuardError(
        "missing_action_recall_scope",
        "get_action_info 需要 at_id 和非空 _instance_identities。请先让用户选择目标实例，或先查询候选实例并使用返回的 _instance_identity。",
        missing,
      );
    }
  }

  if (name === "execute_action") {
    const hasDynamicParams = Object.prototype.hasOwnProperty.call(args, "dynamic_params") && isPlainObject(args.dynamic_params);
    const missing = [
      ...(typeof args.at_id === "string" && args.at_id.trim() ? [] : ["at_id"]),
      ...(isNonEmptyArray(args._instance_identities) ? [] : ["_instance_identities"]),
      ...(hasDynamicParams ? [] : ["dynamic_params"]),
    ];
    if (missing.length) {
      return toolGuardError(
        "unsafe_action_call",
        "execute_action 已被客户端拦截：缺少目标实例或 dynamic_params。请先确认执行对象和动态参数，再重新调用本工具。",
        missing,
      );
    }
  }

  return null;
}

/**
 * Evicts old tool-result payloads between steps while preserving toolCallId/toolName pairs.
 */
function evictOldToolResults(messages: ModelMessage[], keep: number): ModelMessage[] {
  if (keep <= 0) return messages;
  const toolPositions = messages.reduce<number[]>((acc, m, i) => {
    if (m.role === "tool") acc.push(i);
    return acc;
  }, []);
  if (toolPositions.length <= keep) return messages;
  const evict = new Set(toolPositions.slice(0, toolPositions.length - keep));
  return messages.map((m, i) => {
    if (!evict.has(i) || m.role !== "tool" || !Array.isArray(m.content)) return m;
    const content = m.content.map((part) =>
      part.type === "tool-result"
        ? {
            type: "tool-result" as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            output: { type: "text" as const, value: "[Older tool result omitted to save context]" },
          }
        : part,
    );
    return { ...m, content };
  });
}

export type AgentChatRole = "user" | "assistant";

/** Chat history item persisted to localStorage. Tool steps are excluded. */
export type AgentChatTurn = { role: AgentChatRole; content: string };

/** Streaming chunk event emitted to the UI. */
export type AgentChunk =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool-call"; id: string; name: string; args: unknown }
  | { type: "tool-result"; id: string; result: string }
  | { type: "tool-error"; id: string; error: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; totalTokens: number }
  /** Current run failed. error is user-facing; raw details stay in detail for collapsed UI. */
  | { type: "error"; error: string; detail?: string; retryable?: boolean }
  | { type: "finish" };

/** Wraps any error as an error chunk. */
function errorChunk(error: unknown): Extract<AgentChunk, { type: "error" }> {
  const normalized: NormalizedAgentError = normalizeAgentError(error);
  return { type: "error", error: normalized.message, detail: normalized.detail, retryable: normalized.retryable };
}

/**
 * Managed lifecycle dead ends: missing context or terminal interaction state.
 * Their payloads contain required_action, which would otherwise become a loop instruction.
 */
const LIFECYCLE_DEAD_END_CODES = new Set(["conversation_required", "interaction_terminal"]);

/**
 * Replaces lifecycle dead-end errors with a terminal message the model cannot act on.
 *
 * Lifecycle tools are now taken over by managedLifecycleTool, but this guard
 * handles payloads that still reach the model and would otherwise be retried
 * until the stopWhen limit.
 */
export function sanitizeLifecycleError(text: string): string {
  let code = "";
  try {
    const parsed: unknown = JSON.parse(text);
    const error = parsed && typeof parsed === "object" ? (parsed as { error?: { code?: unknown } }).error : undefined;
    if (error && typeof error.code === "string") code = error.code;
  } catch {
    return text;
  }
  if (!LIFECYCLE_DEAD_END_CODES.has(code)) return text;
  return JSON.stringify({
    error: {
      code,
      message:
        "The managed context for this turn is unavailable. Retrying this tool or switching tools will not recover it. " +
        "Stop tool calls and tell the user that data cannot be retrieved right now.",
    },
  });
}

/**
 * Per-turn interaction interface required by the tool loop: context plus finish.
 * It is structurally compatible with BknTurn.
 */
export type AgentTurnScope = BknCallScope & {
  finish: (outcome: TurnOutcome, answer: string) => Promise<void>;
};

/** Model outcome to client-side turn outcome mapping. */
const MODEL_FINISH_OUTCOMES: Record<string, TurnOutcome> = {
  completed: "completed",
  failed: "failed",
  cancelled: "canceled",
  canceled: "canceled",
};

function textOf(input: unknown, key: string): string {
  if (!input || typeof input !== "object") return "";
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/**
 * Converts MCP tools/list definitions to an AI SDK tool set.
 * inputSchema uses the MCP JSON Schema, and execute goes through the shared MCP session.
 */
export type AgentToolsOptions = {
  /** resource_id set bound to the current KN; list_resources is scoped to it when provided. */
  resourceScope?: readonly string[] | null;
  /** Reuses the lifecycle client's MCP session to avoid another initialize handshake. */
  session?: McpSession;
  /**
   * Managed interaction for this turn. Tool calls read context from it, and
   * bkn_finish_interaction finishes through it. Null means lifecycle tools pass through.
   */
  turn?: AgentTurnScope | null;
};

export function buildAgentTools(
  mcpTools: McpToolDef[],
  env: ContextLoaderEnv,
  knId: string,
  cfg: AgentConfig,
  tokenProvider: AgentTokenProvider,
  options: AgentToolsOptions = {},
): ToolSet {
  const { resourceScope, turn = null } = options;
  const session = options.session ?? createMcpSession(env, tokenProvider);
  const scopeSet = resourceScope && resourceScope.length ? new Set(resourceScope) : null;
  const tools: ToolSet = {};
  const call = async (name: string, args: Record<string, unknown>): Promise<string> => {
    const res = await session.callTool(name, args);
    return res.isError ? sanitizeLifecycleError(res.text) : res.text;
  };
  for (const def of mcpTools) {
    if (!def.name) continue;
    // Lifecycle tools remain visible to the model, but execution is bound to this client turn.
    if (turn && isPlatformManagedTool(def.name)) {
      const managed = managedLifecycleTool(def, turn);
      if (managed) {
        tools[def.name] = managed;
        continue;
      }
    }
    const schema =
      def.inputSchema && typeof def.inputSchema === "object"
        ? stripBknContextSchema(def.inputSchema as Record<string, unknown>)
        : { type: "object", properties: {} };
    const scopedList = scopeSet !== null && def.name === "list_resources";
    tools[def.name] = tool({
      description:
        (def.description ?? def.name) +
        (TOOL_HINTS[def.name] ?? "") +
        (scopedList ? " Results are scoped to data tables bound to the current knowledge network by default." : ""),
      inputSchema: jsonSchema(schema),
      execute: async (input: unknown): Promise<string> => {
        const bknContext = turn?.nextContext();
        if (scopedList && scopeSet) return listResourcesScoped(call, input, knId, scopeSet, cfg, bknContext);
        const args = effectiveToolArgs(def.name, input, knId, bknContext);
        const guardError = guardAgentToolArgs(def.name, args);
        if (guardError) throw new Error(guardError);
        return capToolResult(await call(def.name, args), def.name, cfg);
      },
    });
  }
  return tools;
}

/**
 * Whether this platform tool is taken over when the current turn is managed.
 *
 * This is narrower than isPlatformManagedTool: only start/finish change the
 * execution path. Trace read tools still pass through to the backend.
 */
export function isTakenOverLifecycleTool(name: string): boolean {
  return name === "bkn_start_interaction" || name === "bkn_finish_interaction";
}

/**
 * Binds a managed lifecycle tool to the current client turn, or returns null for pass-through.
 *
 * - `bkn_start_interaction` returns the already-opened turn instead of opening another one.
 * - `bkn_finish_interaction` goes through the turn finish path.
 *
 * Backend inputSchema is preserved. Takeover changes execution routing, not the
 * tool shape visible to the model.
 */
function managedLifecycleTool(def: McpToolDef, turn: AgentTurnScope) {
  if (!isTakenOverLifecycleTool(def.name)) return null;
  const describe = (extra: string) => `${def.description ?? def.name} ${extra}`;
  // Preserve backend schema; fall back to an empty object only when absent.
  const backendSchema =
    def.inputSchema && typeof def.inputSchema === "object"
      ? (def.inputSchema as Record<string, unknown>)
      : { type: "object", properties: {} };
  if (def.name === "bkn_start_interaction") {
    return tool({
      description: describe("Studio already opened this turn; calling it returns current interaction IDs instead of opening another turn."),
      inputSchema: jsonSchema(backendSchema),
      // Accept arguments such as question, but do not use them to open another turn.
      execute: (): Promise<string> =>
        Promise.resolve(JSON.stringify({ ...turn.nextContext(), execution_status: "active" })),
    });
  }
  if (def.name === "bkn_finish_interaction") {
    const finish = turn.finish;
    return tool({
      description: describe("Call it after the answer is done to finish this turn; Studio also finishes the turn if it is not called."),
      inputSchema: jsonSchema(backendSchema),
      execute: async (input: unknown): Promise<string> => {
        const raw = textOf(input, "outcome");
        const outcome = MODEL_FINISH_OUTCOMES[raw];
        // Some backend outcomes, such as handed_off, have no client action here.
        if (!outcome) {
          return JSON.stringify({
            error: {
              code: "unsupported_outcome",
              message: `Studio-managed interactions only support completed / failed / cancelled; received ${raw || "empty value"}.`,
            },
          });
        }
        await finish(outcome, textOf(input, "answer") || textOf(input, "reason"));
        return JSON.stringify({ ...turn.nextContext(), execution_status: outcome === "canceled" ? "canceled" : outcome });
      },
    });
  }
  return null;
}

/**
 * Scopes list_resources to the current KN by forcing JSON, fetching enough rows,
 * and filtering by resource_id values from KnDetail.
 */
async function listResourcesScoped(
  call: (name: string, args: Record<string, unknown>) => Promise<string>,
  input: unknown,
  knId: string,
  scopeSet: Set<string>,
  cfg: AgentConfig,
  bknContext: BknContext | undefined,
): Promise<string> {
  const args = {
    ...effectiveToolArgs("list_resources", input, knId, bknContext),
    response_format: "json",
    offset: 0,
    limit: Math.max(scopeSet.size + 5, 200),
  };
  const text = await call("list_resources", args);
  try {
    const parsed = JSON.parse(text) as { entries?: Array<{ resource_id?: string }> };
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter((e) => typeof e.resource_id === "string" && scopeSet.has(e.resource_id))
      : [];
    return capToolResult(JSON.stringify({ entries, total_count: entries.length }), "list_resources", cfg);
  } catch {
    // If the format is unexpected, for example TOON, return the original result.
    return capToolResult(text, "list_resources", cfg);
  }
}

/** Auth provider: getToken reads a fresh token per request, refresh handles 401. */
export type AgentTokenProvider = { getToken: () => string; refresh: () => Promise<string | null> };

/** Backoff delays for busy retries in ms; array length is max retry count. */
const RETRY_DELAYS_MS = [400, 1200];

/** Adds jitter to avoid synchronized retries from multiple panels. */
function withJitter(ms: number): number {
  return Math.round(ms * (0.85 + Math.random() * 0.3));
}

function sleep(ms: number, signal: AbortSignal | null | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Whether this response should be retried. Besides status codes, the Model
 * Factory may return 200 with its own busy error envelope.
 */
async function isRetryableResponse(response: Response): Promise<boolean> {
  if (isRetryableStatus(response.status)) return true;
  if (!response.ok) return false;
  // Only peek when the response is explicitly JSON. Peeking unknown streams can
  // buffer the whole response and break token-by-token streaming.
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return false;
  try {
    const mf = parseModelFactoryEnvelope(await response.clone().text());
    return mf?.code !== undefined && MF_RETRYABLE_CODES.has(String(mf.code));
  } catch {
    return false;
  }
}

/** Network fetch failures are retryable; AbortError is handled by the caller signal. */
function isRetryableFetchError(error: unknown): boolean {
  return error instanceof TypeError;
}

/**
 * Authenticated compatibility fetch for the Model Factory gateway:
 * - uses a fresh Authorization token per request and retries once after 401;
 * - retries busy responses and connection failures with backoff;
 * - normalizes assistant `content: null` and strips replayed reasoning_content.
 */
export function makeAuthedFetch(provider: AgentTokenProvider): typeof fetch {
  const run = (input: RequestInfo | URL, init: RequestInit | undefined, token: string): Promise<Response> => {
    let body = init?.body;
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body) as { messages?: Array<Record<string, unknown>> };
        if (Array.isArray(parsed.messages)) {
          for (const m of parsed.messages) {
            if (m && m.content === null) m.content = "";
            if (m && "reasoning_content" in m) delete m.reasoning_content;
          }
          body = JSON.stringify(parsed);
        }
      } catch {
        /* Leave non-JSON bodies unchanged. */
      }
    }
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers, body });
  };
  const runWithAuthRetry = async (input: RequestInfo | URL, init: RequestInit | undefined): Promise<Response> => {
    let response = await run(input, init, provider.getToken());
    if (response.status === 401) {
      const fresh = await provider.refresh().catch(() => null);
      if (fresh) {
        void response.body?.cancel().catch(() => undefined);
        response = await run(input, init, fresh);
      }
    }
    return response;
  };

  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const signal = init?.signal;
    let response: Response | null = null;
    let failure: unknown = null;

    for (let attempt = 0; ; attempt++) {
      try {
        response = await runWithAuthRetry(input, init);
        failure = null;
      } catch (error) {
        // User stop throws AbortError and should not be retried as a network issue.
        if (signal?.aborted) throw error;
        response = null;
        failure = error;
      }
      if (attempt >= RETRY_DELAYS_MS.length || signal?.aborted) break;
      const retry = response ? await isRetryableResponse(response) : isRetryableFetchError(failure);
      if (!retry) break;
      // Close discarded response bodies so connections are released.
      void response?.body?.cancel().catch(() => undefined);
      await sleep(withJitter(RETRY_DELAYS_MS[attempt]), signal);
      if (signal?.aborted) break;
    }

    if (!response) throw failure;
    return response;
  });
}

/** Creates a Model Factory OpenAI-compatible model with authenticated fetch. */
function createChatModel(env: ContextLoaderEnv, modelName: string, tokenProvider: AgentTokenProvider) {
  const baseURL = `${env.base.replace(/\/+$/, "")}${MODEL_API_PATH}`;
  const provider = createOpenAICompatible({
    name: "mf-model-api",
    baseURL,
    fetch: makeAuthedFetch(tokenProvider),
  });
  return provider(modelName);
}

/* ============================ Template Marker Leak Filter ============================ */

/**
 * Streaming fallback for inference backends missing tool-call or reasoning
 * parsers. Leaked template markers are routed away from the final answer and
 * leaked tool calls become failed tool cards.
 */
const LEAK_OPENERS = ["<think>", "<tool_call>", "<function="] as const;
const LEAK_FN_CLOSERS = ["</function>", "</tool_call>"] as const;

/**
 * Final-answer boundary markers. Without a reasoning parser, unmarked reasoning
 * can leak into the answer, so the prompt makes the boundary explicit.
 */
export const ANSWER_OPEN = "<answer>";
const ANSWER_CLOSE = "</answer>";

/**
 * Output contract. It must be appended by the system prompt, not baked into the
 * editable default prompt, because saved prompt state takes precedence.
 */
export function formatOutputContract(evidenceHint: string): string {
  return (
    "## Output Rules (must follow)\n" +
    `- Wrap the final answer entirely between ${ANSWER_OPEN} and ${ANSWER_CLOSE}; content outside the tags is treated as reasoning and hidden from the user.\n` +
    `- Inside ${ANSWER_OPEN}, write only user-facing results. Do not include self-narration or deliberation.\n` +
    `- Use two concise parts: first one sentence with the conclusion, then one evidence line explaining how the data was obtained (${evidenceHint}).\n` +
    "- Answer in the current conversation language. Keep it concise, professional, and Markdown-friendly."
  );
}

const LEAK_ALL_MARKS = [
  "<think>",
  "</think>",
  "<tool_call>",
  "</tool_call>",
  "<function=",
  "</function>",
  ANSWER_OPEN,
  ANSWER_CLOSE,
];

const LEAK_ERROR_MSG =
  "The model output a tool call as plain text, so the call was not executed. This usually means the inference backend lacks a tool-call parser, such as vLLM --enable-auto-tool-choice with --tool-call-parser and matching --reasoning-parser. Fix the model integration or switch to a model that can call tools correctly.";

export type LeakFilterOptions = {
  /**
   * The system prompt contains the `<answer>` contract. Only then route text
   * outside tags to reasoning; otherwise custom prompts would break streaming.
   */
  expectAnswerTag?: boolean;
};

export function createLeakFilter(onChunk: (chunk: AgentChunk) => void, options: LeakFilterOptions = {}) {
  const expectAnswerTag = options.expectAnswerTag ?? false;
  let buf = "";
  let mode: "normal" | "think" | "fn" = "normal";
  let fnRaw = "";
  let fnSeq = 0;
  let sawAnswer = false;
  let inAnswer = false;
  /** Content routed before `<answer>`; replayed as text if the model ignores the contract. */
  let provisional = "";

  // Hold a tail that may be a partial marker crossing delta boundaries.
  const holdLen = (s: string): number => {
    const max = Math.min(s.length, 12);
    for (let n = max; n > 0; n--) {
      const tail = s.slice(s.length - n);
      if (LEAK_ALL_MARKS.some((m) => m.length > n && m.startsWith(tail))) return n;
    }
    return 0;
  };

  const emitText = (delta: string) => {
    if (delta) onChunk({ type: "text", delta });
  };
  const emitReasoning = (delta: string) => {
    if (delta) onChunk({ type: "reasoning", delta });
  };
  /** Candidate answer text; before `<answer>`, route to reasoning and keep a backup. */
  const emitBody = (delta: string) => {
    if (!delta) return;
    if (!expectAnswerTag || inAnswer) {
      emitText(delta);
      return;
    }
    provisional += delta;
    emitReasoning(delta);
  };
  const reportLeakedCall = (raw: string) => {
    const name =
      /<function=([\w.-]+)/.exec(raw)?.[1] ?? /"name"\s*:\s*"([\w.-]+)"/.exec(raw)?.[1] ?? "unknown_tool";
    const id = `leaked-${++fnSeq}`;
    onChunk({ type: "tool-call", id, name, args: { leakedRawOutput: raw.slice(0, 2000) } });
    onChunk({ type: "tool-error", id, error: LEAK_ERROR_MSG });
  };

  const process = () => {
    for (;;) {
      if (mode === "normal") {
        let idx = -1;
        let marker = "";
        for (const m of [...LEAK_OPENERS, "</think>", ANSWER_OPEN, ANSWER_CLOSE]) {
          const i = buf.indexOf(m);
          if (i !== -1 && (idx === -1 || i < idx)) {
            idx = i;
            marker = m;
          }
        }
        if (idx === -1) {
          const hold = holdLen(buf);
          emitBody(buf.slice(0, buf.length - hold));
          buf = buf.slice(buf.length - hold);
          return;
        }
        emitBody(buf.slice(0, idx));
        buf = buf.slice(idx + marker.length);
        if (marker === "<think>") mode = "think";
        else if (marker === ANSWER_OPEN) {
          sawAnswer = true;
          inAnswer = true;
        } else if (marker === ANSWER_CLOSE) {
          // After closing, the model may keep narrating; that is not answer text.
          inAnswer = false;
        } else if (marker === "</think>") {
          /* Drop standalone closing tags. */
        } else {
          mode = "fn";
          fnRaw = marker;
        }
        continue;
      }
      if (mode === "think") {
        const i = buf.indexOf("</think>");
        if (i === -1) {
          const hold = holdLen(buf);
          emitReasoning(buf.slice(0, buf.length - hold));
          buf = buf.slice(buf.length - hold);
          return;
        }
        emitReasoning(buf.slice(0, i));
        buf = buf.slice(i + "</think>".length);
        mode = "normal";
        continue;
      }
      // Function block: collect until a closing marker.
      let close = -1;
      let closer = "";
      for (const c of LEAK_FN_CLOSERS) {
        const i = buf.indexOf(c);
        if (i !== -1 && (close === -1 || i < close)) {
          close = i;
          closer = c;
        }
      }
      if (close === -1) {
        const hold = holdLen(buf);
        fnRaw += buf.slice(0, buf.length - hold);
        buf = buf.slice(buf.length - hold);
        if (fnRaw.length > 20000) {
          // Prevent unbounded collection; report and reset when too long.
          reportLeakedCall(fnRaw);
          fnRaw = "";
          mode = "normal";
        }
        return;
      }
      fnRaw += buf.slice(0, close + closer.length);
      buf = buf.slice(close + closer.length);
      reportLeakedCall(fnRaw);
      fnRaw = "";
      mode = "normal";
    }
  };

  return {
    feed(delta: string) {
      buf += delta;
      process();
    },
    flush() {
      if (mode === "fn" && (fnRaw || buf)) reportLeakedCall(fnRaw + buf);
      else if (mode === "think") emitReasoning(buf);
      else emitBody(buf);
      // If the model never emits <answer>, replay routed content as text so the
      // turn still has an answer. Compliant models keep normal streaming.
      if (expectAnswerTag && !sawAnswer && provisional) emitText(provisional);
      buf = "";
      fnRaw = "";
      provisional = "";
      mode = "normal";
    },
  };
}

/**
 * Runs one Agent chat turn. streamText drives the Model Factory and tool loop,
 * while fullStream chunks are forwarded to onChunk.
 */
export async function runAgentChat(params: {
  env: ContextLoaderEnv;
  modelName: string;
  system: string;
  history: AgentChatTurn[];
  tools: ToolSet;
  config: AgentConfig;
  tokenProvider: AgentTokenProvider;
  signal?: AbortSignal;
  onChunk: (chunk: AgentChunk) => void;
}): Promise<void> {
  const { env, modelName, system, history, tools, config, tokenProvider, signal, onChunk } = params;
  const messages: ModelMessage[] = history.map((turn) => ({ role: turn.role, content: turn.content }));

  try {
    const result = streamText({
      model: createChatModel(env, modelName, tokenProvider),
      system,
      messages,
      tools,
      stopWhen: stepCountIs(config.maxSteps),
      // Retries are handled by makeAuthedFetch; disable SDK retries to avoid multiplication.
      maxRetries: 0,
      ...(config.maxOutputTokens > 0 ? { maxOutputTokens: config.maxOutputTokens } : {}),
      // Evict older tool results before each step to avoid context growth.
      prepareStep: ({ messages: stepMessages }) => ({ messages: evictOldToolResults(stepMessages, config.keepToolResults) }),
      abortSignal: signal,
    });

    let gotText = false;
    // If this run already reported an error, do not run fallback finalization.
    let errored = false;
    // Enable tag routing only when the prompt contains the <answer> contract.
    const expectAnswerTag = system.includes(ANSWER_OPEN);
    // Filter leaked template markers; only true answer text counts as gotText.
    const leakFilter = createLeakFilter((chunk) => {
      if (chunk.type === "text" && chunk.delta.trim()) gotText = true;
      onChunk(chunk);
    }, { expectAnswerTag });
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta":
          if (part.text) leakFilter.feed(part.text);
          break;
        case "reasoning-delta":
          if (part.text) onChunk({ type: "reasoning", delta: part.text });
          break;
        case "tool-call":
          onChunk({ type: "tool-call", id: part.toolCallId, name: part.toolName, args: part.input });
          break;
        case "tool-result":
          onChunk({
            type: "tool-result",
            id: part.toolCallId,
            result: typeof part.output === "string" ? part.output : JSON.stringify(part.output, null, 2),
          });
          break;
        case "tool-error": {
          const normalized = normalizeAgentError(part.error);
          onChunk({
            type: "tool-error",
            id: part.toolCallId,
            // Tool cards are collapsed, so include both the message and raw details.
            error: normalized.detail ? `${normalized.message}\n\n${normalized.detail}` : normalized.message,
          });
          break;
        }
        case "finish": {
          const u = part.totalUsage;
          onChunk({
            type: "usage",
            inputTokens: u?.inputTokens ?? 0,
            outputTokens: u?.outputTokens ?? 0,
            totalTokens: u?.totalTokens ?? (u?.inputTokens ?? 0) + (u?.outputTokens ?? 0),
          });
          break;
        }
        case "error":
          errored = true;
          onChunk(errorChunk(part.error));
          break;
        default:
          break;
      }
    }
    leakFilter.flush();

    // If the tool loop hits the cap without a final answer, force a final text-only response.
    if (!gotText && !errored && !signal?.aborted) {
      const resp = await result.response;
      const finalResult = streamText({
        model: createChatModel(env, modelName, tokenProvider),
        system:
          system +
          "\n\nTool-call limit reached or finalization required. Based on the information already obtained, answer directly in the current conversation language without calling more tools. " +
          (expectAnswerTag ? `Wrap the final answer entirely between ${ANSWER_OPEN} and ${"</answer>"}.` : "") +
          "）",
        messages: [...messages, ...(resp.messages as ModelMessage[])],
        ...(config.maxOutputTokens > 0 ? { maxOutputTokens: config.maxOutputTokens } : {}),
        maxRetries: 0,
        abortSignal: signal,
      });
      const finalFilter = createLeakFilter(onChunk, { expectAnswerTag });
      for await (const part of finalResult.fullStream) {
        if (part.type === "text-delta" && part.text) finalFilter.feed(part.text);
        else if (part.type === "reasoning-delta" && part.text) onChunk({ type: "reasoning", delta: part.text });
        else if (part.type === "finish") {
          const u = part.totalUsage;
          onChunk({
            type: "usage",
            inputTokens: u?.inputTokens ?? 0,
            outputTokens: u?.outputTokens ?? 0,
            totalTokens: u?.totalTokens ?? (u?.inputTokens ?? 0) + (u?.outputTokens ?? 0),
          });
        } else if (part.type === "error") onChunk(errorChunk(part.error));
      }
      finalFilter.flush();
    }
    onChunk({ type: "finish" });
  } catch (error) {
    if (signal?.aborted) {
      onChunk({ type: "finish" });
      return;
    }
    onChunk(errorChunk(error));
    onChunk({ type: "finish" });
  }
}

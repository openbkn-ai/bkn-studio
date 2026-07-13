/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 知识网络「立即体验 · Agent 对话」—— 前端编排的真实工具调用循环。
 *
 * 混合方案：用 Vercel AI SDK（streamText + tools）跑 LLM 多步工具循环 + 流式；
 * 工具执行复用 context-loader 的会话级 MCP 客户端（initialize 一次、复用 session、注入锁定 kn_id）。
 * 大模型走「模型工厂」OpenAI 兼容网关 /api/mf-model-api/v1/chat/completions（与 agent-retrieval 同 Bearer）。
 * 对话上下文全在前端缓存（无后端会话），每轮把全量 messages 重发模型。
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { jsonSchema, stepCountIs, streamText, tool, type ModelMessage, type ToolSet } from "ai";

import {
  createMcpSession,
  type ContextLoaderEnv,
  type McpSession,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

/** 模型工厂 OpenAI 兼容前缀（与 model-api-guide.getModelApiBaseUrl 一致）。 */
export const MODEL_API_PATH = "/api/mf-model-api/v1";

/**
 * Agent 对话可调参数。前端 localStorage 存、UI 实时改，无需重新部署调参。
 */
export type AgentConfig = {
  /** 工具步数上限（防跑飞兜底；正常由模型出最终答复自动停）。 */
  maxSteps: number;
  /** 步间驱逐：每步保留最近几个工具结果全文，更早的换占位（0=不驱逐）。 */
  keepToolResults: number;
  /** 数据类工具（run_sql / query_*）结果字符上限——逼聚合（0=不截断）。 */
  dataToolCap: number;
  /** schema/发现类工具（get_kn_detail / search_schema / describe / list_resources …）结果字符上限——放宽（0=不截断）。 */
  schemaToolCap: number;
  /** 多轮历史保留最近条数。 */
  maxHistoryMessages: number;
  /** 单轮历史文本字符上限。 */
  maxTurnChars: number;
  /** 单步最大输出 token（含思考）。推理模型（deepseek 等）思考多，需调大否则答案被截；0=模型默认。 */
  maxOutputTokens: number;
};

/** 「仅基础数据」对比面板的默认工具集：纯表/SQL 层能力，无知识网络语义。 */
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

/** schema/发现类工具：结果天生大但有界且模型理解必需 → 用 schemaToolCap（更宽）；其余用 dataToolCap（逼聚合）。 */
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
    `\n\n…[结果过长，已截断约 ${dropped} 字符。请改用更精确的过滤条件 / 更小的 LIMIT / 只取必要字段重新查询，不要拉全表；已获得的信息不要重复查询]`
  );
}

/** 大结果工具的查询约束，追加到工具 description，逼模型在查询里就缩小结果。 */
const TOOL_HINTS: Record<string, string> = {
  run_sql:
    " 【重要】用 SQL 完成聚合/计数/排序/分组并配 LIMIT、只取需要的列；禁止 SELECT * 或拉全表。结果过大会被截断。",
  query_object_instance:
    " 【重要】用 filters 精确过滤 + 小 limit + properties 只取必要字段；不要返回大结果集。结果过大会被截断。",
  query_instance_subgraph: " 【重要】用尽量小的 limit；结果过大会被截断。",
  list_resources: " 【重要】用 catalog_id/type 过滤 + 小 limit 分页；结果过大会被截断。",
  search_schema:
    " 建议：用精确的 query，max_concepts 默认不超过 10；结果过大会被截断。schema_brief 默认 true（只返回概要），需要完整字段定义时显式传 schema_brief=false。",
};

/** 所有工具通用的默认 arguments：TOON 紧凑文本比 JSON 省大量 token（模型显式传值优先）。 */
const GLOBAL_ARG_DEFAULTS: Record<string, unknown> = { response_format: "toon" };

/** 模型未显式传参时注入的默认 arguments（模型显式传值优先）。 */
const TOOL_ARG_DEFAULTS: Record<string, Record<string, unknown>> = {
  // brief 概要即可支撑绝大多数探索，省 token；要完整 schema 让模型显式关。
  search_schema: { schema_brief: true },
};

/** 实际发给 MCP 的最终 arguments = 通用默认 ← 工具默认 ← 模型入参 ← 锁定 kn_id。UI 工具卡片也用它展示真实请求。 */
export function effectiveToolArgs(name: string, input: unknown, knId: string): Record<string, unknown> {
  return {
    ...GLOBAL_ARG_DEFAULTS,
    ...TOOL_ARG_DEFAULTS[name],
    ...(input && typeof input === "object" ? (input as Record<string, unknown>) : {}),
    kn_id: knId,
  };
}

/**
 * 步间驱逐旧工具结果：每步前只保留最近 keep 个工具结果的全文，更早的把内容替换成占位，
 * 但**保留 toolCallId / toolName 配对**（OpenAI 要求每个 tool_call 都有对应 tool 响应）。keep<=0 不驱逐。
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
            output: { type: "text" as const, value: "[旧工具结果已省略以节省上下文]" },
          }
        : part,
    );
    return { ...m, content };
  });
}

export type AgentChatRole = "user" | "assistant";

/** 缓存进 localStorage 的对话历史项（仅文本，工具步骤不进历史，仅用于重发上下文）。 */
export type AgentChatTurn = { role: AgentChatRole; content: string };

/** 流式推给 UI 的增量事件。 */
export type AgentChunk =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool-call"; id: string; name: string; args: unknown }
  | { type: "tool-result"; id: string; result: string }
  | { type: "tool-error"; id: string; error: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; totalTokens: number }
  | { type: "error"; error: string }
  | { type: "finish" };

/**
 * 把 MCP tools/list 的工具定义转成 AI SDK 工具集：
 * - inputSchema 直接用 MCP 的 JSON Schema（jsonSchema() 包装）。
 * - execute 走会话级 MCP 客户端，并强制注入锁定 kn_id（模型不可改）。
 * 返回工具集 + 共享的 MCP 会话（复用同一 session）。
 */
export function buildAgentTools(
  mcpTools: McpToolDef[],
  env: ContextLoaderEnv,
  knId: string,
  cfg: AgentConfig,
  tokenProvider: AgentTokenProvider,
  /** 当前知识网络绑定的 resource_id 集（KnDetail 的 data_source）。传入则默认把 list_resources 限定到本网络的数据表。 */
  resourceScope?: readonly string[] | null,
): ToolSet {
  const session = createMcpSession(env, tokenProvider);
  const scopeSet = resourceScope && resourceScope.length ? new Set(resourceScope) : null;
  const tools: ToolSet = {};
  for (const def of mcpTools) {
    if (!def.name) continue;
    const schema =
      def.inputSchema && typeof def.inputSchema === "object"
        ? (def.inputSchema as Record<string, unknown>)
        : { type: "object", properties: {} };
    const scopedList = scopeSet !== null && def.name === "list_resources";
    tools[def.name] = tool({
      description:
        (def.description ?? def.name) +
        (TOOL_HINTS[def.name] ?? "") +
        (scopedList ? " 返回结果已默认限定为当前知识网络绑定的数据表（其他 catalog 的表不会出现）。" : ""),
      inputSchema: jsonSchema(schema),
      execute: async (input: unknown): Promise<string> => {
        if (scopedList && scopeSet) return listResourcesScoped(session, input, knId, scopeSet, cfg);
        const args = effectiveToolArgs(def.name, input, knId);
        const res = await session.callTool(def.name, args);
        return capToolResult(res.text, def.name, cfg);
      },
    });
  }
  return tools;
}

/**
 * list_resources 限定到当前知识网络：强制 json + 一次取全（offset 0、大 limit——网络内表集很小，
 * 分页无意义），再按 KnDetail 的 resource_id 集过滤，只留本网络绑定的数据表。
 */
async function listResourcesScoped(
  session: McpSession,
  input: unknown,
  knId: string,
  scopeSet: Set<string>,
  cfg: AgentConfig,
): Promise<string> {
  const args = {
    ...effectiveToolArgs("list_resources", input, knId),
    response_format: "json",
    offset: 0,
    limit: Math.max(scopeSet.size + 5, 200),
  };
  const res = await session.callTool("list_resources", args);
  try {
    const parsed = JSON.parse(res.text) as { entries?: Array<{ resource_id?: string }> };
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter((e) => typeof e.resource_id === "string" && scopeSet.has(e.resource_id))
      : [];
    return capToolResult(JSON.stringify({ entries, total_count: entries.length }), "list_resources", cfg);
  } catch {
    // 非预期格式（如仍是 TOON）时不阻断，原样返回。
    return capToolResult(res.text, "list_resources", cfg);
  }
}

/** 鉴权 provider：getToken 每请求取新鲜 token（OAuth 会续期），refresh 在 401 时刷新。 */
export type AgentTokenProvider = { getToken: () => string; refresh: () => Promise<string | null> };

/**
 * 模型工厂网关的鉴权 + 兼容性 fetch：
 * - 每请求用 provider.getToken() 的新鲜 token 设 Authorization；401 时 refresh 后重试一次（OAuth 自动续期，
 *   解决长对话/长循环跨过 token 过期而断掉的问题）。
 * - 兼容其严格 router：assistant 消息 `content: null` 归一为 ""，剥掉回灌的 `reasoning_content`。
 */
function makeAuthedFetch(provider: AgentTokenProvider): typeof fetch {
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
        /* 非 JSON body 原样放行 */
      }
    }
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers, body });
  };
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let response = await run(input, init, provider.getToken());
    if (response.status === 401) {
      const fresh = await provider.refresh().catch(() => null);
      if (fresh) response = await run(input, init, fresh);
    }
    return response;
  });
}

/** 构造模型工厂 OpenAI 兼容大模型实例（新鲜 token + 401 刷新 + 兼容性 fetch）。 */
function createChatModel(env: ContextLoaderEnv, modelName: string, tokenProvider: AgentTokenProvider) {
  const baseURL = `${env.base.replace(/\/+$/, "")}${MODEL_API_PATH}`;
  const provider = createOpenAICompatible({
    name: "mf-model-api",
    baseURL,
    fetch: makeAuthedFetch(tokenProvider),
  });
  return provider(modelName);
}

/* ============================ 模板标记泄漏过滤（后端 parser 缺失兜底） ============================ */

/**
 * 推理后端没配 tool-call / reasoning parser 时，模型会把 <think>…</think> 与
 * <function=…>/<tool_call> 模板标记当**纯文本**吐出来（调用根本没被执行）。
 * 这里做流式兜底：think 内容改道到思考区；泄漏的调用块拦截成一张失败的工具卡，
 * 并说明根因，不再污染答案正文。代价：正文里若真要引用这些标记原文会被误拦（可接受）。
 */
const LEAK_OPENERS = ["<think>", "<tool_call>", "<function="] as const;
const LEAK_FN_CLOSERS = ["</function>", "</tool_call>"] as const;
const LEAK_ALL_MARKS = ["<think>", "</think>", "<tool_call>", "</tool_call>", "<function=", "</function>"];

const LEAK_ERROR_MSG =
  "模型把工具调用当文本输出，调用未真正执行——通常是该模型的推理后端未配置 tool-call parser" +
  "（如 vLLM 的 --enable-auto-tool-choice --tool-call-parser，配套 --reasoning-parser）。" +
  "请修正模型接入配置，或换用可正常调用工具的模型。";

export function createLeakFilter(onChunk: (chunk: AgentChunk) => void) {
  let buf = "";
  let mode: "normal" | "think" | "fn" = "normal";
  let fnRaw = "";
  let fnSeq = 0;

  // 结尾若可能是某个标记的前缀，先兜住不发（跨 delta 的半个标签）。
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
  const reportLeakedCall = (raw: string) => {
    const name =
      /<function=([\w.-]+)/.exec(raw)?.[1] ?? /"name"\s*:\s*"([\w.-]+)"/.exec(raw)?.[1] ?? "未知工具";
    const id = `leaked-${++fnSeq}`;
    onChunk({ type: "tool-call", id, name, args: { 泄漏的原始输出: raw.slice(0, 2000) } });
    onChunk({ type: "tool-error", id, error: LEAK_ERROR_MSG });
  };

  const process = () => {
    for (;;) {
      if (mode === "normal") {
        let idx = -1;
        let marker = "";
        for (const m of [...LEAK_OPENERS, "</think>"]) {
          const i = buf.indexOf(m);
          if (i !== -1 && (idx === -1 || i < idx)) {
            idx = i;
            marker = m;
          }
        }
        if (idx === -1) {
          const hold = holdLen(buf);
          emitText(buf.slice(0, buf.length - hold));
          buf = buf.slice(buf.length - hold);
          return;
        }
        emitText(buf.slice(0, idx));
        buf = buf.slice(idx + marker.length);
        if (marker === "<think>") mode = "think";
        else if (marker === "</think>") {
          /* 落单的闭合标签直接丢弃 */
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
      // fn：收集到闭合标签为止
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
          // 防收集无限膨胀：超长直接上报重置
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
      else emitText(buf);
      buf = "";
      fnRaw = "";
      mode = "normal";
    },
  };
}

/**
 * 跑一轮 Agent 对话：streamText 驱动模型工厂 + 工具循环，遍历 fullStream 把增量事件推给 onChunk。
 * history 含本轮最新 user 消息（最后一项）。tools 由 buildAgentTools 预构造。
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
      ...(config.maxOutputTokens > 0 ? { maxOutputTokens: config.maxOutputTokens } : {}),
      // 每步前驱逐旧工具结果，避免单轮多步累积撑爆上下文。
      prepareStep: ({ messages: stepMessages }) => ({ messages: evictOldToolResults(stepMessages, config.keepToolResults) }),
      abortSignal: signal,
    });

    let gotText = false;
    // 文本经泄漏过滤器：真实正文才算 gotText，泄漏的调用块会变成失败工具卡。
    const leakFilter = createLeakFilter((chunk) => {
      if (chunk.type === "text" && chunk.delta.trim()) gotText = true;
      onChunk(chunk);
    });
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
        case "tool-error":
          onChunk({
            type: "tool-error",
            id: part.toolCallId,
            error: part.error instanceof Error ? part.error.message : String(part.error),
          });
          break;
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
          onChunk({ type: "error", error: part.error instanceof Error ? part.error.message : String(part.error) });
          break;
        default:
          break;
      }
    }
    leakFilter.flush();

    // 跑满工具轮次仍没出最终答复（最后一步还在调工具）→ 强制基于已有信息收尾作答，不再调工具。
    if (!gotText && !signal?.aborted) {
      const resp = await result.response;
      const finalResult = streamText({
        model: createChatModel(env, modelName, tokenProvider),
        system:
          system +
          "\n\n（已达到工具调用上限或需要收尾：请基于以上已获得的信息，直接用中文给出最终答复，不要再调用任何工具。）",
        messages: [...messages, ...(resp.messages as ModelMessage[])],
        ...(config.maxOutputTokens > 0 ? { maxOutputTokens: config.maxOutputTokens } : {}),
        abortSignal: signal,
      });
      const finalFilter = createLeakFilter(onChunk);
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
        } else if (part.type === "error")
          onChunk({ type: "error", error: part.error instanceof Error ? part.error.message : String(part.error) });
      }
      finalFilter.flush();
    }
    onChunk({ type: "finish" });
  } catch (error) {
    if (signal?.aborted) {
      onChunk({ type: "finish" });
      return;
    }
    onChunk({ type: "error", error: error instanceof Error ? error.message : String(error) });
    onChunk({ type: "finish" });
  }
}

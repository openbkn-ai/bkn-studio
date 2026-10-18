/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Browser-side model calls through the Model Factory OpenAI-compatible gateway, used for
 * single generations such as suggested questions and metric drafting. Knowledge-network
 * smart Q&A runs in BKN Agent instead; see bkn-agent-execution.service.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { stepCountIs, streamText, type ModelMessage, type ToolSet } from "ai";

import { getRuntimeConfig } from "@/framework/runtime/config";
import {
  isRetryableStatus,
  normalizeAgentError,
  parseModelFactoryEnvelope,
  MF_RETRYABLE_CODES,
  type NormalizedAgentError,
} from "@/modules/knowledge-network/services/agent-error";
import type { ContextLoaderEnv } from "@/modules/knowledge-network/services/context-loader.service";

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

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxSteps: 40,
  keepToolResults: 3,
  dataToolCap: 8000,
  schemaToolCap: 24000,
  maxHistoryMessages: 16,
  maxTurnChars: 4000,
  maxOutputTokens: 16384,
};

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
  return {
    type: "error",
    error: normalized.message,
    detail: normalized.detail,
    retryable: normalized.retryable,
  };
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
  const run = (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    token: string,
  ): Promise<Response> => {
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
    headers.set("Accept-Language", getRuntimeConfig().locale);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers, body });
  };
  const runWithAuthRetry = async (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
  ): Promise<Response> => {
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

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
  };
}

/** Creates a Model Factory OpenAI-compatible model with authenticated fetch. */
export function createChatModel(
  env: ContextLoaderEnv,
  modelName: string,
  tokenProvider: AgentTokenProvider,
) {
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

export function createLeakFilter(
  onChunk: (chunk: AgentChunk) => void,
  options: LeakFilterOptions = {},
) {
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
      /<function=([\w.-]+)/.exec(raw)?.[1] ??
      /"name"\s*:\s*"([\w.-]+)"/.exec(raw)?.[1] ??
      "unknown_tool";
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
  const messages: ModelMessage[] = history.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

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
      prepareStep: ({ messages: stepMessages }) => ({
        messages: evictOldToolResults(stepMessages, config.keepToolResults),
      }),
      abortSignal: signal,
    });

    let gotText = false;
    // If this run already reported an error, do not run fallback finalization.
    let errored = false;
    // Enable tag routing only when the prompt contains the <answer> contract.
    const expectAnswerTag = system.includes(ANSWER_OPEN);
    // Filter leaked template markers; only true answer text counts as gotText.
    const leakFilter = createLeakFilter(
      (chunk) => {
        if (chunk.type === "text" && chunk.delta.trim()) gotText = true;
        onChunk(chunk);
      },
      { expectAnswerTag },
    );
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta":
          if (part.text) leakFilter.feed(part.text);
          break;
        case "reasoning-delta":
          if (part.text) onChunk({ type: "reasoning", delta: part.text });
          break;
        case "tool-call":
          onChunk({
            type: "tool-call",
            id: part.toolCallId,
            name: part.toolName,
            args: part.input,
          });
          break;
        case "tool-result":
          onChunk({
            type: "tool-result",
            id: part.toolCallId,
            result:
              typeof part.output === "string" ? part.output : JSON.stringify(part.output, null, 2),
          });
          break;
        case "tool-error": {
          const normalized = normalizeAgentError(part.error);
          onChunk({
            type: "tool-error",
            id: part.toolCallId,
            // Tool cards are collapsed, so include both the message and raw details.
            error: normalized.detail
              ? `${normalized.message}\n\n${normalized.detail}`
              : normalized.message,
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
          (expectAnswerTag
            ? `Wrap the final answer entirely between ${ANSWER_OPEN} and ${"</answer>"}.`
            : "") +
          "）",
        messages: [...messages, ...(resp.messages as ModelMessage[])],
        ...(config.maxOutputTokens > 0 ? { maxOutputTokens: config.maxOutputTokens } : {}),
        maxRetries: 0,
        abortSignal: signal,
      });
      const finalFilter = createLeakFilter(onChunk, { expectAnswerTag });
      for await (const part of finalResult.fullStream) {
        if (part.type === "text-delta" && part.text) finalFilter.feed(part.text);
        else if (part.type === "reasoning-delta" && part.text)
          onChunk({ type: "reasoning", delta: part.text });
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

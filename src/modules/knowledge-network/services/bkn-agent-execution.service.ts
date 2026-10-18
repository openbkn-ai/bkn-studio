/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Client for the BKN Agent user execution API. The model/tool loop runs on the server;
 * the browser submits a question, renders the SSE events, and can stop or recover a run.
 * Contract: docs/api/bkn-agent/bkn-agent.yaml in bkn-foundry (#2173).
 */

import i18n from "@/app/locales/i18n";
import {
  makeAuthedFetch,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import type { NormalizedAgentError } from "@/modules/knowledge-network/services/agent-error";

export const BKN_AGENT_EXECUTIONS_PATH = "/api/bkn-agent/v1/executions";

/** Fixed built-in Agent for Studio smart Q&A; its configuration is shared and server-side. */
export const SMART_QA_AGENT_ID = "studio_smart_qa";

export type ExecutionStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type TerminalStatus = "succeeded" | "failed" | "cancelled";

export type ExecutionUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type ExecutionEvent =
  | { type: "meta"; runId: string; threadId: string }
  | { type: "token"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_started"; id: string; name: string; input: unknown }
  | {
      type: "tool_finished";
      id: string;
      name: string;
      status: "succeeded" | "failed";
      output: unknown;
      error?: unknown;
      /** unavailable: the call did not go through; error: the tool returned one. */
      errorKind?: "unavailable" | "error";
      durationMs?: number;
    }
  | { type: "usage"; usage: ExecutionUsage | null }
  | { type: "result"; answer: string }
  | {
      type: "terminal";
      status: TerminalStatus;
      code?: string;
      /** The server's localized text for the code. */
      detail?: string;
      /** The upstream service's own error, when it gave one. */
      upstream?: UpstreamError;
      runId?: string;
    };

export type UpstreamError = { code?: string; message?: string };

export type ExecutionRecord = {
  run_id: string;
  thread_id: string;
  status: ExecutionStatus;
  result?: { answer?: string } | null;
  error?: { code?: string; detail?: string; upstream?: UpstreamError } | null;
};

/** HTTP-level rejection before a stream starts, carrying the server's localized envelope. */
export class BknAgentExecutionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "BknAgentExecutionError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Maps one SSE frame to a typed event; unknown or malformed frames are ignored. */
export function parseExecutionFrame(frame: string): ExecutionEvent | null {
  let name = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  if (dataLines.length === 0) return null;
  let data: Record<string, unknown> | null;
  try {
    data = asRecord(JSON.parse(dataLines.join("\n")));
  } catch {
    return null;
  }
  if (!data) return null;
  switch (name) {
    case "meta":
      return { type: "meta", runId: str(data.run_id) ?? "", threadId: str(data.thread_id) ?? "" };
    case "token":
      return typeof data.content === "string" ? { type: "token", content: data.content } : null;
    case "reasoning":
      return typeof data.content === "string" ? { type: "reasoning", content: data.content } : null;
    case "tool_started":
      return {
        type: "tool_started",
        id: str(data.tool_call_id) ?? "",
        name: str(data.name) ?? "",
        input: data.input,
      };
    case "tool_finished":
      return {
        type: "tool_finished",
        id: str(data.tool_call_id) ?? "",
        name: str(data.name) ?? "",
        status: data.status === "failed" ? "failed" : "succeeded",
        output: data.output,
        error: data.error,
        errorKind:
          data.error_kind === "unavailable"
            ? "unavailable"
            : data.status === "failed"
              ? "error"
              : undefined,
        durationMs: typeof data.duration_ms === "number" ? data.duration_ms : undefined,
      };
    case "usage":
      return {
        type: "usage",
        usage: data.available ? asRecord(data.usage) : null,
      };
    case "result":
      return { type: "result", answer: str(asRecord(data.content)?.answer) ?? "" };
    case "terminal": {
      const status = data.status;
      const error = asRecord(data.error);
      const upstream = asRecord(error?.upstream);
      return {
        type: "terminal",
        status: status === "succeeded" || status === "cancelled" ? status : "failed",
        code: str(error?.code),
        detail: str(error?.detail),
        upstream: upstream
          ? { code: str(upstream.code), message: str(upstream.message) }
          : undefined,
        runId: str(data.run_id),
      };
    }
    default:
      return null;
  }
}

async function rejection(response: Response): Promise<BknAgentExecutionError> {
  const text = await response.text().catch(() => "");
  let envelope: Record<string, unknown> | null = null;
  try {
    envelope = asRecord(JSON.parse(text));
  } catch {
    /* Non-JSON gateway pages fall back to the status text. */
  }
  const code = str(envelope?.code);
  const message =
    str(envelope?.description) ??
    str(envelope?.message) ??
    (response.statusText || `HTTP ${response.status}`);
  return new BknAgentExecutionError(message, response.status, code, text || undefined);
}

/**
 * New idempotency key per send. randomUUID needs a secure context, and plain-HTTP
 * deployments exist, so fall back to getRandomValues.
 */
export function newClientRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export type StartExecutionParams = {
  base: string;
  tokenProvider: AgentTokenProvider;
  knId: string;
  message: string;
  /** Idempotency key: reuse it only to retry the same request. */
  clientRequestId: string;
  threadId?: string;
  signal?: AbortSignal;
  onEvent: (event: ExecutionEvent) => void;
};

/**
 * Starts one execution and streams its events until the connection closes. Returns the
 * terminal event, or null when the stream ended without one (for example a dropped
 * connection); callers then read the committed state with getExecution.
 */
export async function startExecution(
  params: StartExecutionParams,
): Promise<Extract<ExecutionEvent, { type: "terminal" }> | null> {
  const fetchFn = makeAuthedFetch(params.tokenProvider);
  const response = await fetchFn(`${params.base}${BKN_AGENT_EXECUTIONS_PATH}`, {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: SMART_QA_AGENT_ID,
      message: params.message,
      client_request_id: params.clientRequestId,
      ...(params.threadId ? { thread_id: params.threadId } : {}),
      context: { kn_id: params.knId },
    }),
    signal: params.signal,
  });
  if (!response.ok) throw await rejection(response);
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal: Extract<ExecutionEvent, { type: "terminal" }> | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    const frames = buffer.split("\n\n");
    buffer = done ? "" : (frames.pop() ?? "");
    for (const frame of frames) {
      const event = parseExecutionFrame(frame);
      if (!event) continue;
      if (event.type === "terminal") terminal = event;
      params.onEvent(event);
    }
    if (done) return terminal;
  }
}

type RunParams = { base: string; tokenProvider: AgentTokenProvider; runId: string };

async function runRequest(
  { base, tokenProvider, runId }: RunParams,
  suffix: "" | "/cancel",
): Promise<ExecutionRecord> {
  const response = await makeAuthedFetch(tokenProvider)(
    `${base}${BKN_AGENT_EXECUTIONS_PATH}/${encodeURIComponent(runId)}${suffix}`,
    { method: suffix ? "POST" : "GET", headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw await rejection(response);
  return (await response.json()) as ExecutionRecord;
}

/** Reads the committed state and final result of a run. */
export function getExecution(params: RunParams): Promise<ExecutionRecord> {
  return runRequest(params, "");
}

/** Requests a stop; the returned state is what the server has actually committed. */
export function cancelExecution(params: RunParams): Promise<ExecutionRecord> {
  return runRequest(params, "/cancel");
}

/** Terminal codes worth a dedicated message; anything else uses the generic failure text. */
const TERMINAL_MESSAGE_KEYS: Record<string, string> = {
  "BknAgent.Chat.Timeout": "knowledgeNetwork.agentChat.execution.errors.timeout",
  "BknAgent.Model.Unavailable": "knowledgeNetwork.agentChat.execution.errors.modelUnavailable",
  "BknAgent.Model.Rejected": "knowledgeNetwork.agentChat.execution.errors.modelRejected",
  "BknAgent.Execution.Unavailable": "knowledgeNetwork.agentChat.execution.errors.unavailable",
  "BknAgent.Execution.Forbidden": "knowledgeNetwork.agentChat.execution.errors.forbidden",
};

const RETRYABLE_TERMINAL_CODES = new Set([
  "BknAgent.Chat.Timeout",
  "BknAgent.Model.Unavailable",
  "BknAgent.Chat.Failed",
  "BknAgent.Execution.Failed",
  "BknAgent.Execution.Unavailable",
]);

/** User-facing error for a failed terminal event. */
export function terminalError(
  code: string | undefined,
  context: { detail?: string; upstream?: UpstreamError; runId?: string } = {},
): NormalizedAgentError {
  const known = code ? TERMINAL_MESSAGE_KEYS[code] : undefined;
  const base = known
    ? i18n.t(known)
    : (context.detail ?? i18n.t("knowledgeNetwork.agentChat.execution.errors.failed"));
  // The upstream's own message says what actually failed (for example the model
  // service cannot reach its database); keep it beside the category.
  const message = context.upstream?.message
    ? i18n.t("knowledgeNetwork.agentChat.execution.errors.withCause", {
        message: base,
        cause: context.upstream.message,
      })
    : base;
  const lines = [
    code && `code: ${code}`,
    context.upstream?.code && `upstream: ${context.upstream.code}`,
    context.runId && `run_id: ${context.runId}`,
  ].filter(Boolean);
  return {
    message,
    detail: lines.length ? lines.join("\n") : undefined,
    retryable: !code || RETRYABLE_TERMINAL_CODES.has(code),
  };
}

/** User-facing error for a request rejected before or while streaming. */
export function executionRequestError(error: unknown): NormalizedAgentError {
  if (error instanceof BknAgentExecutionError) {
    // A draft or missing built-in Agent surfaces as not found; explain the admin step.
    if (error.status === 404 && error.code === "BknAgent.NotFound") {
      return {
        message: i18n.t("knowledgeNetwork.agentChat.execution.errors.agentNotReady"),
        detail: error.detail,
        retryable: false,
      };
    }
    if (error.code === "BknAgent.Thread.Busy") {
      return {
        message: i18n.t("knowledgeNetwork.agentChat.execution.errors.threadBusy"),
        detail: error.detail,
        retryable: true,
      };
    }
    return {
      message: error.message,
      detail: error.detail,
      retryable: error.status >= 500 || error.status === 429,
    };
  }
  return {
    message: i18n.t("knowledgeNetwork.agentChat.execution.errors.network"),
    detail: error instanceof Error ? error.message : String(error),
    retryable: true,
  };
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import {
  BknAgentExecutionError,
  getExecution,
  newClientRequestId,
  startExecution,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";

/**
 * Cypher generation runs on BKN Agent: the built-in `cypher_generation` reads the network's
 * schema, tries each candidate with run_cypher and answers with the complete query that ran, in
 * a cypher fence. Its model, Prompt and tools are configured on the server.
 */
export const CYPHER_GENERATION_AGENT_ID = "cypher_generation";

/** Wording for the failures a caller can do something about; the rest keep the server's text. */
export type CypherAgentTexts = {
  notReady: string;
  forbidden: string;
  busy: string;
  timeout: string;
  failed: string;
  network: string;
};

export type CypherGeneration = {
  /** The query to run, or "" when the answer held none. */
  query: string;
  /** The answer as the Agent wrote it. */
  answer: string;
  /** Pass back to ask the same Agent to fix this query with what it already knows. */
  threadId: string;
};

/**
 * Pulls the query out of the Agent's answer: the last fenced block, else everything from the
 * first MATCH. The query is kept as written — it is the one the Agent already ran.
 */
export function extractCypherQuery(text: string): string {
  const fences = [...text.matchAll(/```[ \t]*(?:cypher|sql)?[ \t]*\n?([\s\S]*?)```/gi)];
  let body = fences.length > 0 ? fences[fences.length - 1][1] : text;
  const start = body.search(/\b(MATCH|OPTIONAL\s+MATCH)\b/i);
  if (start < 0) return "";
  if (fences.length === 0) body = body.slice(start);
  return body
    .trim()
    .replace(/;+\s*$/, "")
    .trim();
}

/** A generation that failed; `notReady` means the Agent is not published, so retrying won't help. */
export class CypherAgentError extends Error {
  constructor(
    message: string,
    readonly notReady = false,
  ) {
    super(message);
    this.name = "CypherAgentError";
  }
}

function rejection(error: unknown, texts: CypherAgentTexts): CypherAgentError {
  // A draft or missing built-in Agent is not found on the public surface.
  if (
    error instanceof BknAgentExecutionError &&
    error.status === 404 &&
    error.code === "BknAgent.NotFound"
  )
    return new CypherAgentError(texts.notReady, true);
  return new CypherAgentError(rejectionMessage(error, texts));
}

function rejectionMessage(error: unknown, texts: CypherAgentTexts): string {
  if (error instanceof BknAgentExecutionError) {
    if (error.status === 403) return texts.forbidden;
    if (error.code === "BknAgent.Thread.Busy") return texts.busy;
    return error.message;
  }
  return texts.network;
}

function terminalMessage(code: string | undefined, texts: CypherAgentTexts): string {
  if (code === "BknAgent.Chat.Timeout") return texts.timeout;
  if (code === "BknAgent.Execution.Forbidden") return texts.forbidden;
  return code ? `${texts.failed} (${code})` : texts.failed;
}

export type CypherAgentParams = {
  base: string;
  tokenProvider: AgentTokenProvider;
  knId: string;
  message: string;
  /** Continue an earlier generation, e.g. to fix the query it gave. */
  threadId?: string;
  signal?: AbortSignal;
  /** Called with each tool the Agent starts, so the page can show it is still working. */
  onTool?: (name: string) => void;
  /** Called once the run has an id, so the caller can cancel it on the server. */
  onRun?: (runId: string) => void;
};

/** One turn of the Cypher Agent: its answer as written and the thread to continue. */
async function runCypherAgent(
  params: CypherAgentParams,
  texts: CypherAgentTexts,
): Promise<{ answer: string; threadId: string }> {
  // Filled from the stream's events.
  const run: { id: string; threadId: string; answer: string | null } = {
    id: "",
    threadId: params.threadId ?? "",
    answer: null,
  };
  let terminal: Awaited<ReturnType<typeof startExecution>>;
  try {
    terminal = await startExecution({
      base: params.base,
      tokenProvider: params.tokenProvider,
      agentId: CYPHER_GENERATION_AGENT_ID,
      knId: params.knId,
      message: params.message,
      clientRequestId: newClientRequestId(),
      threadId: params.threadId,
      signal: params.signal,
      onEvent: (event) => {
        if (event.type === "meta") {
          run.id = event.runId;
          run.threadId = event.threadId || run.threadId;
          params.onRun?.(event.runId);
        } else if (event.type === "tool_started") params.onTool?.(event.name);
        else if (event.type === "result") run.answer = event.answer;
      },
    });
  } catch (error) {
    if (params.signal?.aborted) throw error;
    throw rejection(error, texts);
  }
  if (!terminal && run.id) {
    // The stream ended without its terminal; the committed run says how it went.
    const record = await getExecution({
      base: params.base,
      tokenProvider: params.tokenProvider,
      runId: run.id,
    }).catch(() => null);
    if (record?.status === "succeeded") run.answer = record.result?.answer ?? "";
    else if (record)
      throw new CypherAgentError(terminalMessage(record.error?.code ?? undefined, texts));
  }
  if (terminal && terminal.status !== "succeeded")
    throw new CypherAgentError(terminalMessage(terminal.code, texts));
  if (run.answer === null) throw new CypherAgentError(texts.network);
  return { answer: run.answer, threadId: run.threadId };
}

/** Asks the Agent for a query; it answers with one it already ran. */
export async function generateCypher(
  params: CypherAgentParams,
  texts: CypherAgentTexts,
): Promise<CypherGeneration> {
  const { answer, threadId } = await runCypherAgent(params, texts);
  return { query: extractCypherQuery(answer), answer, threadId };
}

/**
 * The request to explain a query, and why it failed when it did. The Agent's Prompt answers a
 * message that asks to explain a query in business terms instead of writing a new one.
 */
export function explainMessage(
  query: string,
  texts: { request: string; error: string; schema: string },
  error?: string,
  /** The labels, relation types and properties the query names, so the Agent need not look. */
  schema?: string,
): string {
  const lines = [`${texts.request}\n\`\`\`cypher\n${query}\n\`\`\``];
  if (error) lines.push(`${texts.error}${error}`);
  if (schema) lines.push(`${texts.schema}\n${schema}`);
  return lines.join("\n");
}

/** Asks the same Agent to explain a query; the answer is shown as written. */
export async function explainCypher(
  params: CypherAgentParams,
  texts: CypherAgentTexts,
): Promise<{ answer: string; threadId: string }> {
  return runCypherAgent(params, texts);
}

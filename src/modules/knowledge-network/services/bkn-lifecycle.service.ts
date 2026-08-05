/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  createMcpSession,
  type BknContext,
  type ContextLoaderEnv,
  type McpAuth,
  type McpSession,
} from "@/modules/knowledge-network/services/context-loader.service";

export type TurnOutcome = "completed" | "failed" | "canceled";

export type BknTurn = {
  conversationId: string;
  interactionId: string;
  nextContext(): BknContext;
  complete(answer: string): Promise<void>;
  fail(reason: string): Promise<void>;
  cancel(reason: string): Promise<void>;
  finish(outcome: TurnOutcome, answer: string): Promise<void>;
};

export type BknLifecycle = {
  session: McpSession;
  conversationId(): string | null;
  unsupported(): boolean;
  beginTurn(question: string): Promise<BknTurn | null>;
  reset(): void;
};

/** Persist only the server-issued conversation ID, never a client-created identity. */
export type ConversationStore = {
  read(): string | null;
  write(conversationId: string): void;
  clear(): void;
};

export type BknLifecycleOptions = { conversationStore: ConversationStore };

export function lifecycleEnv(base: string, knId: string): ContextLoaderEnv {
  return { base, token: "", knId };
}

export function localConversationStore(storageKey: string): ConversationStore {
  return {
    read() {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    write(conversationId) {
      try {
        localStorage.setItem(storageKey, conversationId);
      } catch {
        // Storage is an optimization; the in-memory ID remains valid.
      }
    },
    clear() {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore unavailable storage.
      }
    },
  };
}

export function memoryConversationStore(): ConversationStore {
  let value: string | null = null;
  return {
    read: () => value,
    write: (conversationId) => {
      value = conversationId;
    },
    clear: () => {
      value = null;
    },
  };
}

export class BknLifecycleError extends Error {
  readonly code: string;
  readonly requiredAction: string;

  constructor(tool: string, code: string, message: string, requiredAction: string) {
    super(message || `${tool} failed (${code || "unknown"})`);
    this.name = "BknLifecycleError";
    this.code = code;
    this.requiredAction = requiredAction;
  }
}

type LifecycleErrorPayload = { code?: unknown; message?: unknown; required_action?: unknown };

function isToolMissing(rpcError: { code?: number; message?: string } | undefined): boolean {
  if (!rpcError) return false;
  const message = (rpcError.message ?? "").toLowerCase();
  return message.includes("tool not found") || message.includes("unknown tool");
}

function lifecycleErrorOf(tool: string, structured: unknown, fallbackText: string): BknLifecycleError {
  const envelope = structured && typeof structured === "object" ? (structured as Record<string, unknown>) : {};
  const error = (envelope.error ?? {}) as LifecycleErrorPayload;
  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : fallbackText;
  return new BknLifecycleError(tool, code, message, typeof error.required_action === "string" ? error.required_action : "");
}

async function callLifecycleTool(
  session: McpSession,
  tool: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await session.callTool(tool, args);
  if (isToolMissing(result.rpcError)) {
    throw new BknLifecycleError(tool, "lifecycle_not_supported", `${tool} is not registered`, "");
  }
  if (result.isError || !result.ok) throw lifecycleErrorOf(tool, result.structured, result.text);
  if (!result.structured || typeof result.structured !== "object") {
    throw new BknLifecycleError(tool, "lifecycle_malformed", `${tool} did not return structured content`, "");
  }
  return result.structured as Record<string, unknown>;
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

export function createBknLifecycle(
  env: ContextLoaderEnv,
  auth: McpAuth | undefined,
  options: BknLifecycleOptions,
): BknLifecycle {
  return createBknLifecycleOn(createMcpSession(env, auth), options);
}

export function createBknLifecycleOn(session: McpSession, options: BknLifecycleOptions): BknLifecycle {
  const { conversationStore } = options;
  let conversationId = conversationStore.read();
  let notSupported = false;
  let previousTurnSettled: Promise<void> = Promise.resolve();

  return {
    session,
    conversationId: () => conversationId,
    unsupported: () => notSupported,
    reset() {
      conversationId = null;
      conversationStore.clear();
    },
    async beginTurn(question: string) {
      const waitFor = previousTurnSettled;
      let release = () => undefined as void;
      previousTurnSettled = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        await waitFor;
        const args: Record<string, unknown> = { question };
        if (conversationId) args.conversation_id = conversationId;
        const state = await callLifecycleTool(session, "bkn_start_interaction", args);
        const startedConversationId = stringField(state, "conversation_id");
        const interactionId = stringField(state, "interaction_id");
        if (!startedConversationId || !interactionId) {
          throw new BknLifecycleError("bkn_start_interaction", "lifecycle_malformed", "bkn_start_interaction did not return authority IDs", "");
        }
        conversationId = startedConversationId;
        conversationStore.write(startedConversationId);
        return createTurn(session, startedConversationId, interactionId, release);
      } catch (error) {
        if (error instanceof BknLifecycleError && error.code === "lifecycle_not_supported") {
          notSupported = true;
          release();
          return null;
        }
        release();
        throw error;
      }
    },
  };
}

function createTurn(
  session: McpSession,
  conversationId: string,
  interactionId: string,
  release: () => void,
): BknTurn {
  let terminated = false;

  async function terminate(outcome: "completed" | "failed" | "cancelled", value?: string): Promise<void> {
    if (terminated) return;
    terminated = true;
    const args: Record<string, unknown> = { interaction_id: interactionId, outcome };
    if (outcome === "completed") args.answer = value ?? "";
    else args.reason = value || (outcome === "cancelled" ? "stopped_by_user" : "agent_error");
    try {
      await callLifecycleTool(session, "bkn_finish_interaction", args);
    } finally {
      release();
    }
  }

  return {
    conversationId,
    interactionId,
    nextContext: () => ({ conversation_id: conversationId, interaction_id: interactionId }),
    complete: (answer) => terminate("completed", answer),
    fail: (reason) => terminate("failed", reason),
    cancel: (reason) => terminate("cancelled", reason),
    finish(outcome, answer) {
      if (outcome === "canceled") return terminate("cancelled");
      if (outcome === "failed") return terminate("failed");
      return terminate("completed", answer);
    },
  };
}

export async function withManagedTurn<T>(
  lifecycle: BknLifecycle,
  question: string,
  run: (turn: BknTurn | null) => Promise<T>,
  describeAnswer: (value: T) => string = () => "ok",
): Promise<T> {
  const turn = await lifecycle.beginTurn(question);
  if (!turn) return run(null);
  let outcome: TurnOutcome = "completed";
  let answer = "";
  try {
    const value = await run(turn);
    answer = describeAnswer(value);
    return value;
  } catch (error) {
    outcome = "failed";
    throw error;
  } finally {
    await turn.finish(outcome, answer).catch(() => undefined);
  }
}

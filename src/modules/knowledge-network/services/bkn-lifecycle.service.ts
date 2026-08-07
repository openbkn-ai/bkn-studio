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
import i18n from "@/app/locales/i18n";

/**
 * Managed lifecycle tools driven by this client, kept for docs and tests.
 *
 * This is not the filtering list; filtering is prefix-based via isPlatformManagedTool.
 */
export const LIFECYCLE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "bkn_start_interaction",
  "bkn_finish_interaction",
]);

/**
 * Platform-managed tool prefix. Lifecycle and provenance tools all start with `bkn_`
 * while business tools do not.
 */
const PLATFORM_TOOL_PREFIX = "bkn_";

/**
 * Whether a tool is platform-managed and should be hidden from the model.
 *
 * Prefix matching is intentional because platform tool names move with backend changes.
 * An allow-list would miss new tools and let the model call them directly.
 */
export function isPlatformManagedTool(name: string): boolean {
  return name.startsWith(PLATFORM_TOOL_PREFIX);
}

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

/** Stores only server-issued conversation IDs; no client identity is generated. */
export type ConversationStore = {
  read(): string | null;
  write(conversationId: string): void;
  clear(): void;
};

export type BknLifecycleOptions = { conversationStore: ConversationStore };

export function lifecycleEnv(base: string, knId: string): ContextLoaderEnv {
  return { base, token: "", knId };
}

export function localConversationStore(storageKey: string, legacyStorageKey?: string): ConversationStore {
  let legacyCleared = false;
  const clearLegacy = () => {
    if (legacyCleared || !legacyStorageKey) return;
    legacyCleared = true;
    try {
      localStorage.removeItem(legacyStorageKey);
    } catch {
      // Ignore unavailable localStorage.
    }
  };
  return {
    read() {
      try {
        clearLegacy();
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    write(conversationId) {
      try {
        localStorage.setItem(storageKey, conversationId);
      } catch {
        // The in-memory ID remains valid if localStorage is unavailable.
      }
    },
    clear() {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore unavailable localStorage.
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
    super(message || i18n.t("knowledgeNetwork.contextLoaderPanel.lifecycleErrors.toolFailed", { tool, code: code || i18n.t("knowledgeNetwork.contextLoaderPanel.lifecycleErrors.unknownError") }));
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
  const fallback = fallbackText || i18n.t("knowledgeNetwork.contextLoaderPanel.lifecycleErrors.callFailed", { tool });
  const message = typeof error.message === "string" ? error.message : fallback;
  const visibleMessage = code === "interaction_in_progress" ? STUCK_INTERACTION_HINT : message;
  return new BknLifecycleError(tool, code, visibleMessage, typeof error.required_action === "string" ? error.required_action : "");
}

const STUCK_INTERACTION_HINT = i18n.t("knowledgeNetwork.contextLoaderPanel.lifecycleErrors.stuckInteraction");

function shouldStartNewConversation(error: unknown): boolean {
  return error instanceof BknLifecycleError && (error.code === "conversation_not_found" || error.code === "interaction_in_progress");
}

async function callLifecycleTool(
  session: McpSession,
  tool: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await session.callTool(tool, args);
  if (isToolMissing(result.rpcError)) {
    throw new BknLifecycleError(tool, "lifecycle_not_supported", i18n.t("knowledgeNetwork.contextLoaderPanel.lifecycleErrors.toolNotRegistered", { tool }), "");
  }
  if (result.isError || !result.ok) throw lifecycleErrorOf(tool, result.structured, result.text);
  if (!result.structured || typeof result.structured !== "object") {
    throw new BknLifecycleError(tool, "lifecycle_malformed", i18n.t("knowledgeNetwork.contextLoaderPanel.lifecycleErrors.malformedToolResult", { tool }), "");
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
        if (notSupported) {
          release();
          return null;
        }
        const startInteraction = (currentConversationId: string | null) => {
          const args: Record<string, unknown> = { question };
          if (currentConversationId) args.conversation_id = currentConversationId;
          return callLifecycleTool(session, "bkn_start_interaction", args);
        };
        let state: Record<string, unknown>;
        try {
          state = await startInteraction(conversationId);
        } catch (error) {
          if (!conversationId || !shouldStartNewConversation(error)) throw error;
          conversationId = null;
          conversationStore.clear();
          state = await startInteraction(null);
        }
        const startedConversationId = stringField(state, "conversation_id");
        const interactionId = stringField(state, "interaction_id");
        if (!startedConversationId || !interactionId) {
          throw new BknLifecycleError("bkn_start_interaction", "lifecycle_malformed", i18n.t("knowledgeNetwork.contextLoaderPanel.lifecycleErrors.missingTurnIds"), "");
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

type FinishOutcome = "completed" | "failed" | "cancelled";

function createTurn(
  session: McpSession,
  conversationId: string,
  interactionId: string,
  release: () => void,
): BknTurn {
  let terminated = false;

  async function terminate(outcome: FinishOutcome, value?: string): Promise<void> {
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

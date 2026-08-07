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

/**
 * Managed lifecycle tools driven by this client, kept explicit for docs and tests.
 *
 * This is not the filtering list; filtering uses the prefix in isPlatformManagedTool.
 */
export const LIFECYCLE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "bkn_start_interaction",
  "bkn_finish_interaction",
]);

/**
 * Platform-side tool prefix. Lifecycle and trace tools use `bkn_`, while
 * business tools do not.
 */
const PLATFORM_TOOL_PREFIX = "bkn_";

/**
 * Whether this tool is managed by the platform side.
 *
 * Prefix matching is deliberate because the platform tool surface changes with
 * backend releases and an explicit list would drift.
 *
 * Matching does not hide the tool. buildAgentTools decides whether to bind
 * start/finish to the current client turn or pass other trace tools through.
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

/** Persists only server-issued conversation IDs; no client identity is generated. */
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
        // The in-memory ID remains valid when localStorage is unavailable.
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
  /** `interaction_in_progress` includes the stuck interaction id, enough for beginTurn reclamation. */
  readonly currentInteractionId: string;

  constructor(tool: string, code: string, message: string, requiredAction: string, currentInteractionId = "") {
    super(message || `${tool} failed (${code || "unknown error"})`);
    this.name = "BknLifecycleError";
    this.code = code;
    this.requiredAction = requiredAction;
    this.currentInteractionId = currentInteractionId;
  }
}

type LifecycleErrorPayload = {
  code?: unknown;
  message?: unknown;
  required_action?: unknown;
  current_interaction_id?: unknown;
};

function isToolMissing(rpcError: { code?: number; message?: string } | undefined): boolean {
  if (!rpcError) return false;
  const message = (rpcError.message ?? "").toLowerCase();
  return message.includes("tool not found") || message.includes("unknown tool");
}

function lifecycleErrorOf(tool: string, structured: unknown, fallbackText: string): BknLifecycleError {
  const envelope = structured && typeof structured === "object" ? (structured as Record<string, unknown>) : {};
  const error = (envelope.error ?? {}) as LifecycleErrorPayload;
  const code = typeof error.code === "string" ? error.code : "";
  const fallback = fallbackText || `${tool} call failed`;
  const message = typeof error.message === "string" ? error.message : fallback;
  const visibleMessage = code === "interaction_in_progress" ? STUCK_INTERACTION_HINT : message;
  return new BknLifecycleError(
    tool,
    code,
    visibleMessage,
    typeof error.required_action === "string" ? error.required_action : "",
    typeof error.current_interaction_id === "string" ? error.current_interaction_id : "",
  );
}

/** Shown only when reclamation also fails; normally beginTurn handles this. */
const STUCK_INTERACTION_HINT = "The current conversation still has an unfinished interaction and automatic recovery failed. Clear the chat and retry.";

function shouldStartNewConversation(error: unknown): boolean {
  return error instanceof BknLifecycleError && (error.code === "conversation_not_found" || error.code === "interaction_in_progress");
}

/**
 * Finishes a stale active interaction from the previous turn so this conversation
 * can start a new turn. Returns false if reclamation fails.
 *
 * This covers refreshes, closed tabs, and failed finish requests. Reclaimed turns
 * are marked cancelled because they did not complete normally.
 */
async function reclaimStuckInteraction(session: McpSession, error: unknown): Promise<boolean> {
  if (!(error instanceof BknLifecycleError) || error.code !== "interaction_in_progress") return false;
  if (error.requiredAction !== "bkn_finish_interaction" || !error.currentInteractionId) return false;
  try {
    await callLifecycleTool(session, "bkn_finish_interaction", {
      interaction_id: error.currentInteractionId,
      outcome: "cancelled",
      reason: "reclaimed by client: previous turn did not finish",
    });
    return true;
  } catch {
    // Let the caller start a new conversation; do not mask the original error.
    return false;
  }
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
  // Whether the previous turn lacked lifecycle support; report only, not a short circuit.
  let notSupported = false;
  let previousTurnSettled: Promise<void> = Promise.resolve();
  /**
   * Whether this instance successfully started a turn. Stale interaction
   * reclamation only runs while false to avoid interrupting another tab.
   */
  let startedAnyTurn = false;

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
        // Do not short-circuit on notSupported. Lifecycle support is deployment
        // state and may appear after backend upgrades or restarts while the page is open.
        const startInteraction = (currentConversationId: string | null) => {
          const args: Record<string, unknown> = { question };
          if (currentConversationId) args.conversation_id = currentConversationId;
          return callLifecycleTool(session, "bkn_start_interaction", args);
        };
        let state: Record<string, unknown>;
        try {
          state = await startInteraction(conversationId);
        } catch (error) {
          if (!conversationId) throw error;
          // Prefer backend-directed reclamation before starting a new conversation.
          //
          // Reclaim only before this instance has started any turn; after that,
          // a collision is more likely concurrent usage than stale state.
          if (!startedAnyTurn && (await reclaimStuckInteraction(session, error))) {
            state = await startInteraction(conversationId);
          } else {
            if (!shouldStartNewConversation(error)) throw error;
            conversationId = null;
            conversationStore.clear();
            state = await startInteraction(null);
          }
        }
        const startedConversationId = stringField(state, "conversation_id");
        const interactionId = stringField(state, "interaction_id");
        if (!startedConversationId || !interactionId) {
          throw new BknLifecycleError("bkn_start_interaction", "lifecycle_malformed", "bkn_start_interaction did not return conversation or interaction ID", "");
        }
        conversationId = startedConversationId;
        conversationStore.write(startedConversationId);
        notSupported = false;
        startedAnyTurn = true;
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

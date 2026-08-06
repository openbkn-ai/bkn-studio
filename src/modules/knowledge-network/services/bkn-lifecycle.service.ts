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
 * 本客户端自己驱动的受管生命周期工具，供文档与测试对照。
 *
 * 注意：这**不是**过滤名单——过滤按前缀走，见 isPlatformManagedTool。
 */
export const LIFECYCLE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "bkn_start_interaction",
  "bkn_finish_interaction",
]);

/**
 * 平台侧工具前缀。生命周期与业务溯源工具一律 `bkn_` 开头（bkn_start_interaction /
 * bkn_finish_interaction / bkn_causality / bkn_get_receipt / bkn_retry_operation …），
 * 业务工具一律不带前缀（search_schema / run_sql / query_object_instance …）。
 */
const PLATFORM_TOOL_PREFIX = "bkn_";

/**
 * 这个工具是不是平台侧管账的、不该给模型看见的。
 *
 * 按前缀判而不是列名单：平台侧工具集随后端演进反复变动（#618 期间一度扩到十余个
 * 溯源工具，之后又裁回 bkn_start_interaction / bkn_finish_interaction 两个）。
 * 列名单必漏，漏了模型就会去调。
 * 实测模型真会调：一轮里连调两次 bkn_start_interaction，被 permission_denied 挡下。
 * 挡不下的话更糟——模型另开一条交互会撞上 Core 的 active interaction 唯一约束。
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

/** 只持久化服务端下发的 conversation ID，不生成客户端身份。 */
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
      // 忽略不可用的 localStorage。
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
        // localStorage 不可用时，内存中的 ID 仍然有效。
      }
    },
    clear() {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // 忽略不可用的 localStorage。
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
    super(message || `${tool} 失败（${code || "未知错误"}）`);
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
  const fallback = fallbackText || `${tool} 调用失败`;
  const message = typeof error.message === "string" ? error.message : fallback;
  const visibleMessage = code === "interaction_in_progress" ? STUCK_INTERACTION_HINT : message;
  return new BknLifecycleError(tool, code, visibleMessage, typeof error.required_action === "string" ? error.required_action : "");
}

const STUCK_INTERACTION_HINT = "当前会话仍有未结束的交互。请清空对话后重试。";

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
    throw new BknLifecycleError(tool, "lifecycle_not_supported", `${tool} 未注册`, "");
  }
  if (result.isError || !result.ok) throw lifecycleErrorOf(tool, result.structured, result.text);
  if (!result.structured || typeof result.structured !== "object") {
    throw new BknLifecycleError(tool, "lifecycle_malformed", `${tool} 未返回结构化内容`, "");
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
  // 「上一轮是否不支持生命周期」——只作报告用,不作短路用。见 beginTurn。
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
        // 这里刻意不因为 notSupported 短路。「服务端没有生命周期工具」是部署态而非
        // 会话态:页面开着的时候后端升级/重启,工具就补上了。之前一次失败就永久置位,
        // 于是这个标签页余生所有业务调用都不带 bkn_context,每一条都稳定 conversation_required——
        // 而那个错误的 required_action 又把模型推回 bkn_start_interaction。代价只是不支持
        // 的部署上每轮多打一次必败的调用,换回可恢复性。
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
          throw new BknLifecycleError("bkn_start_interaction", "lifecycle_malformed", "bkn_start_interaction 未返回会话或交互 ID", "");
        }
        conversationId = startedConversationId;
        conversationStore.write(startedConversationId);
        notSupported = false;
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

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * BKN Trace 受管生命周期客户端 —— Context Loader 调用的前置协议边界。
 *
 * 除 `bkn_*` 外的全部 MCP `tools/call` 与 REST `/kn/*` POST 都必须携带
 * `bkn_context{conversation_id, interaction_id}`，缺了直接返回 `conversation_required`
 * 且下游调用次数为 0。两个 id 都不能前端自造，只能问 Core 要：
 *
 *   会话（conversation）—— 一条对话的身份，清空对话才换；首轮由 Core 分配，之后回传复用。
 *   交互（interaction）—— 一轮问答，发送时开、出答案/停止/出错时终结。
 *
 * 生命周期只由 MCP 工具暴露（agent-retrieval 没有对应 REST 路由），所以 REST 调试台也要
 * 先走一遍 MCP 才能拿到上下文。契约实测（2026-08-05，foundry #618 之后）只剩两个工具：
 *
 *   bkn_start_interaction  {question*, conversation_id?, agent_name?}
 *     → {interaction_id, conversation_id, execution_status:"active"}
 *   bkn_finish_interaction {interaction_id*, outcome*, answer?, reason?}
 *     → {interaction_id, conversation_id, execution_status, evidence_status}
 *
 * 租约、终结清单（expected_operations / expected_receipts）、operation_key 全部收回 facade
 * 内部，调用方不再参与 —— 老契约那套 `bkn_create_conversation` + 三个终结工具已下线。
 */

import {
  createMcpSession,
  type BknContext,
  type ContextLoaderEnv,
  type McpAuth,
  type McpSession,
} from "@/modules/knowledge-network/services/context-loader.service";

/** 一轮交互的收尾结果。注意线上入参枚举是 `cancelled`（双 l），见 WIRE_OUTCOME。 */
export type TurnOutcome = "completed" | "failed" | "canceled";

/** 前端枚举 → `bkn_finish_interaction.outcome` 的线上拼写。 */
const WIRE_OUTCOME: Record<TurnOutcome, string> = {
  completed: "completed",
  failed: "failed",
  canceled: "cancelled",
};

export type BknTurn = {
  conversationId: string;
  interactionId: string;
  /** 本轮的受管上下文，随每次业务调用一起发出。 */
  context(): BknContext;
  /** 正常收尾（answer 为本轮最终答复，Core 会存为 interaction artifact）。 */
  complete(answer: string): Promise<void>;
  /** 执行失败收尾。 */
  fail(reason: string): Promise<void>;
  /** 用户中途停止收尾。 */
  cancel(reason: string): Promise<void>;
  /** 按结果分派到 complete / fail / cancel。 */
  finish(outcome: TurnOutcome, answer: string): Promise<void>;
};

export type BknLifecycle = {
  /** 与业务调用共用的 MCP 会话（复用同一个 Mcp-Session-Id，少一次握手）。 */
  session: McpSession;
  /** 当前会话 id；还没开过交互时为 null。 */
  conversationId(): string | null;
  /** 后端不支持受管生命周期（老版本 Context Loader）时为 true，此时不注入 bkn_context。 */
  unsupported(): boolean;
  /**
   * 开一轮交互。后端不支持时返回 null，调用方按旧行为继续。
   * 同一条会话同时只允许一个 active interaction（Core 的
   * `uq_bkn_trace_interaction_active` 唯一约束），因此并发调用会自动排队，
   * 等上一轮终结后才真正开新的一轮。
   */
  beginTurn(question: string): Promise<BknTurn | null>;
  /** 丢弃当前会话（清空对话）：下一轮会开一条全新 conversation。 */
  reset(): void;
};

export type BknLifecycleOptions = {
  /**
   * 会话 id 的存放处。新契约没有 `external_conversation_key` 之类的幂等键，
   * 「刷新页面还是同一条对话」只能靠前端把 Core 分配的 conversation_id 存下来。
   */
  conversationStore: ConversationStore;
  /** 写进 Trace 的调用方显示名（Core 只在首轮登记，之后传同值即可）。 */
  agentName?: string;
};

/** 会话 id 的读写。localStorage 实现见 localConversationStore。 */
export type ConversationStore = {
  /** 还没有会话时返回 null。 */
  read(): string | null;
  write(id: string): void;
  clear(): void;
};

/**
 * 生命周期客户端的稳定身份：只认 base + kn。
 *
 * `env.token` 仅是 auth provider 缺席时的兜底——MCP 会话每次请求都用
 * `auth.getToken()` 现取，所以 OAuth 续期换掉 env 的对象身份时**不该**重建客户端：
 * 重建会丢掉串行闸门，让并发的两轮同时开交互，撞上「一条会话只能有一个 active
 * interaction」；顺带还会多打一次 initialize 握手。调用方用它把 useMemo 的依赖
 * 收敛到真正稳定的标识上。
 */
export function lifecycleEnv(base: string, knId: string): ContextLoaderEnv {
  return { base, token: "", knId };
}

/** 随机 id：优先 crypto.randomUUID，测试环境/老浏览器兜底。 */
export function randomLifecycleId(): string {
  const cryptoRef: Crypto | undefined = typeof crypto === "undefined" ? undefined : crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * localStorage 版会话存放处。只在 clear（清空对话）时丢弃，
 * 因此刷新页面仍会接回同一条 conversation —— 这正是「不清空就一直同一个 id」。
 */
export function localConversationStore(storageKey: string): ConversationStore {
  let cached: string | null = null;
  return {
    read() {
      if (cached) return cached;
      try {
        cached = localStorage.getItem(storageKey);
      } catch {
        /* localStorage 不可用时退化为内存态 */
      }
      return cached;
    },
    write(id: string) {
      cached = id;
      try {
        localStorage.setItem(storageKey, id);
      } catch {
        /* 忽略：内存态仍能保证本次会话内稳定 */
      }
    },
    clear() {
      cached = null;
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* 忽略 */
      }
    },
  };
}

/** 进程内会话存放处：刷新即换新会话，适合一次性面板。 */
export function memoryConversationStore(): ConversationStore {
  let value: string | null = null;
  return {
    read: () => value,
    write(id: string) {
      value = id;
    },
    clear() {
      value = null;
    },
  };
}

/** 生命周期调用失败：带 Core 的稳定错误码与 required_action，便于界面给出下一步。 */
export class BknLifecycleError extends Error {
  readonly code: string;
  readonly requiredAction: string;
  /** `interaction_in_progress` 时 Core 回带的在途交互 id，用于回收。 */
  readonly currentInteractionId: string;

  constructor(
    tool: string,
    code: string,
    message: string,
    requiredAction: string,
    currentInteractionId = "",
  ) {
    super(message || `${tool} 失败（${code || "unknown"}）`);
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

/**
 * 会话里还挂着一轮没终结的交互，且自动回收也没能收掉。正常路径不会走到这儿——本地闸门会
 * 排队，回收逻辑还会替上一轮收尾——只有回收本身也失败时才出现。用户的出路是清空对话换一条
 * 全新 conversation，卡住的那轮留给 Core 的租约回收。
 */
const STUCK_INTERACTION_HINT = "当前会话还有一轮未结束的交互没能正常收尾。点「清空」开一条新对话即可继续；卡住的那轮会由服务端租约自动回收。";

function lifecycleErrorOf(tool: string, structured: unknown, fallbackText: string): BknLifecycleError {
  const envelope = structured && typeof structured === "object" ? (structured as Record<string, unknown>) : {};
  const error = (envelope.error ?? {}) as LifecycleErrorPayload;
  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : fallbackText;
  return new BknLifecycleError(
    tool,
    code,
    code === "interaction_in_progress" ? STUCK_INTERACTION_HINT : message,
    typeof error.required_action === "string" ? error.required_action : "",
    typeof error.current_interaction_id === "string" ? error.current_interaction_id : "",
  );
}

/**
 * 后端没注册生命周期工具（升级前的 Context Loader）时的识别。
 * 这类部署同时也不会强制 bkn_context，降级回旧行为是安全的；
 * 但只认协议级 "工具不存在"，业务错误不能走这条路，否则会把真实的生命周期故障吞掉。
 */
function isToolMissing(rpcError: { code?: number; message?: string } | undefined): boolean {
  if (!rpcError) return false;
  const message = (rpcError.message ?? "").toLowerCase();
  return message.includes("tool not found") || message.includes("unknown tool");
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
  if (result.isError || !result.ok) {
    throw lifecycleErrorOf(tool, result.structured, result.text);
  }
  if (!result.structured || typeof result.structured !== "object") {
    throw new BknLifecycleError(tool, "lifecycle_malformed", `${tool} 未返回结构化状态`, "");
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

/** 同上但复用调用方给的 MCP 会话（也是测试注入点）。 */
export function createBknLifecycleOn(session: McpSession, options: BknLifecycleOptions): BknLifecycle {
  const { conversationStore, agentName } = options;
  let notSupported = false;
  /**
   * 上一轮交互的终结闸门。会话内只能有一个 active interaction，抢跑的第二轮会被 Core
   * 的唯一约束顶掉 —— 用户手快连发、数据浏览器同时展开两张卡都会走到这条路上。
   */
  let previousTurnSettled: Promise<void> = Promise.resolve();

  function startArgs(question: string): Record<string, unknown> {
    const args: Record<string, unknown> = { question };
    // 首轮不带 conversation_id，由 Core 分配；之后回传拿回同一条会话。
    const known = conversationStore.read();
    if (known) args.conversation_id = known;
    if (agentName) args.agent_name = agentName;
    return args;
  }

  /**
   * 开交互，并处理两类可自愈的失败：
   *
   *   resource_not_disclosed —— 存下来的 conversation_id 在当前账户/部署下已不可见
   *     （后端换库、换租户、会话被清理）。丢掉它重开一条，而不是让面板从此打不开。
   *   interaction_in_progress —— 会话里挂着一轮没收尾的交互。走到这儿说明本地闸门是空的
   *     （beginTurn 已经排过队），所以那一轮必定是泄漏的：刷新页面打断了 finish 的多半就是它。
   *     用 Core 回带的 current_interaction_id 替它收尾再重开；收不掉才把出路提示抛给用户。
   */
  async function startInteraction(question: string): Promise<Record<string, unknown>> {
    try {
      return await callLifecycleTool(session, "bkn_start_interaction", startArgs(question));
    } catch (error) {
      if (!(error instanceof BknLifecycleError)) throw error;
      if (error.code === "resource_not_disclosed") {
        conversationStore.clear();
        return callLifecycleTool(session, "bkn_start_interaction", startArgs(question));
      }
      if (error.code === "interaction_in_progress" && error.currentInteractionId) {
        await callLifecycleTool(session, "bkn_finish_interaction", {
          interaction_id: error.currentInteractionId,
          outcome: WIRE_OUTCOME.canceled,
          reason: "reclaimed_by_client",
        });
        return callLifecycleTool(session, "bkn_start_interaction", startArgs(question));
      }
      throw error;
    }
  }

  return {
    session,
    conversationId: () => conversationStore.read(),
    unsupported: () => notSupported,
    reset() {
      conversationStore.clear();
    },
    async beginTurn(question: string) {
      if (notSupported) return null;
      const waitFor = previousTurnSettled;
      let release = () => undefined as void;
      previousTurnSettled = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        // 闸门只会 resolve、不会 reject（终结失败也照样放行），所以这里不会串联失败。
        await waitFor;
        if (notSupported) {
          release();
          return null;
        }
        const state = await startInteraction(question);
        const conversationId = stringField(state, "conversation_id");
        if (conversationId) conversationStore.write(conversationId);
        return createTurn(session, conversationId, stringField(state, "interaction_id"), release);
      } catch (error) {
        release();
        if (error instanceof BknLifecycleError && error.code === "lifecycle_not_supported") {
          notSupported = true;
          return null;
        }
        throw error;
      }
    },
  };
}

function createTurn(
  session: McpSession,
  conversationId: string,
  interactionId: string,
  /** 终结后放行下一轮（成败都放行，否则一次收尾失败会让整条会话再也开不出交互）。 */
  release: () => void,
): BknTurn {
  let terminated = false;

  async function terminate(outcome: TurnOutcome, answer?: string, reason?: string): Promise<void> {
    // 终结只做一次：重复调用会撞 Core 的 terminal_conflict，而调用方在
    // 「停止后又出错」这类路径上很容易两次都触发。
    if (terminated) return;
    terminated = true;
    const args: Record<string, unknown> = {
      interaction_id: interactionId,
      outcome: WIRE_OUTCOME[outcome],
    };
    // schema 是 additionalProperties:false，空串也别塞。
    if (answer) args.answer = answer;
    if (reason) args.reason = reason;
    try {
      await callLifecycleTool(session, "bkn_finish_interaction", args);
    } finally {
      release();
    }
  }

  return {
    conversationId,
    interactionId,
    context: () => ({ conversation_id: conversationId, interaction_id: interactionId }),
    complete: (answer: string) => terminate("completed", answer),
    fail: (reason: string) => terminate("failed", undefined, reason || "agent_error"),
    cancel: (reason: string) => terminate("canceled", undefined, reason || "stopped_by_user"),
    finish(outcome, answer) {
      if (outcome === "canceled") return terminate("canceled", undefined, "stopped_by_user");
      if (outcome === "failed") return terminate("failed", undefined, "agent_error");
      return terminate("completed", answer);
    },
  };
}

/**
 * 一次性受管调用：开一轮交互跑 run，无论成败都收尾。
 * 给「数据浏览器加载」「调试台点一次发送」这类非对话的业务调用用 —— 它们同样受强制拦截，
 * 只是没有多轮语义。后端不支持生命周期时 turn 为 null，run 按旧行为直接发。
 */
export async function withManagedTurn<T>(
  lifecycle: BknLifecycle,
  question: string,
  run: (turn: BknTurn | null) => Promise<T>,
  /** 写进 Trace 的本轮「答复」摘要；这类调用没有自然语言答案，给一句能读的即可。 */
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
    // 收尾失败不能盖掉业务错误：交互会由 Core 的租约回收兜底。
    await turn.finish(outcome, answer).catch(() => undefined);
  }
}

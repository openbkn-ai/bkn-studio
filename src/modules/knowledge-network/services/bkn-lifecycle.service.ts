/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * BKN Trace 3.0 受管生命周期客户端 —— Context Loader 调用的前置协议边界。
 *
 * 契约见 bkn-foundry `adp/context-loader/agent-retrieval/TRACE.md`：REST `/kn/*` POST 与
 * 除 `bkn_*` 外的全部 MCP `tools/call` 都必须携带 `bkn_context`（conversation_id +
 * interaction_id + operation_key），缺任一字段返回稳定错误码且下游调用次数为 0。
 * 三个 id 都不能前端自造，必须问 Core 要：
 *
 *   会话（conversation）—— 一条对话的身份，清空对话才换；页面刷新按 external_conversation_key 幂等复用。
 *   交互（interaction）—— 一轮问答，发送时开、出答案/停止/出错时终结。
 *   操作（operation）—— 一轮里的每次工具调用，由 operation_key 在交互内去重。
 *
 * 生命周期只由 MCP 工具暴露（agent-retrieval 没有对应 REST 路由），所以 REST 调试台也要
 * 先走一遍 MCP 才能拿到上下文。
 */

import {
  createMcpSession,
  type BknContext,
  type BknReceiptRef,
  type ContextLoaderEnv,
  type McpAuth,
  type McpSession,
} from "@/modules/knowledge-network/services/context-loader.service";

/** 终结清单版本，与 Core `completion_manifest_version` 对应。 */
const MANIFEST_VERSION = "1";

/**
 * 受管生命周期工具。tools/list 会把它们和业务工具一起返回，但它们是**平台侧管账的**，
 * 由前端 lifecycle 驱动（beginTurn / finish），绝不能出现在给模型的工具集里：
 * 模型自己调 bkn_start_interaction 会另开一条交互，跟前端已开的那条撞上 Core 的
 * active interaction 唯一约束；即使被 permission_denied 挡住，也白烧掉工具步数、
 * 把失败调用塞进 Trace，还给模型喂一堆和问题无关的报错。
 */
export const LIFECYCLE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "bkn_create_conversation",
  "bkn_start_interaction",
  "bkn_complete_interaction",
  "bkn_fail_interaction",
  "bkn_cancel_interaction",
]);

/**
 * 交互租约时长。终结时租约必须还没过期，否则 Core 判 `terminal_conflict`；
 * 一轮 Agent 对话可以跑满 40 步工具，按分钟级留足。
 */
const DEFAULT_LEASE_SECONDS = 1800;

/**
 * 成功终结时给证据组装留的收敛窗口。Context Loader 目前只能把 Receipt 完成为
 * `evidence_durability=pending`（3.0 Evidence Producer 未落地），而带 pending 回执的
 * 成功交互必须在清单里给出 assembler_deadline，否则永远停在 assembling ——
 * 现在没有 assembler 在跑，看不出差别，但 #544 上线后有它才会自动收敛。
 */
const ASSEMBLER_DEADLINE_MS = 5 * 60 * 1000;

/** 一轮交互的收尾原因（Core 只存字符串，不校验枚举）。 */
export type TurnOutcome = "completed" | "failed" | "canceled";

export type BknTurn = {
  conversationId: string;
  interactionId: string;
  /** 取下一次业务调用的受管上下文；operation_key 在本轮内唯一。 */
  nextContext(toolName: string): BknContext;
  /** 记下一次业务调用的回执；终结时要把本轮全部 operation/receipt 列进清单。 */
  recordReceipt(receipt: BknReceiptRef | undefined): void;
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
  /** 当前会话 id；还没建立时为 null。 */
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
  /** 丢弃当前会话（清空对话）：下一轮会建一条全新 conversation。 */
  reset(): void;
};

export type BknLifecycleOptions = {
  /**
   * 会话身份键。同一个键 `bkn_create_conversation` 幂等复用同一条 conversation，
   * 所以它决定了「什么时候还算同一条对话」：刷新页面复用，清空对话换新。
   */
  externalKeyStore: ExternalKeyStore;
  /** 单轮即弃的场景（如调试台一次点击）传 true，交给 Core 按 one-shot 语义收敛。 */
  oneShot?: boolean;
  leaseSeconds?: number;
};

/** 会话身份键的读写。localStorage 实现见 localExternalKeyStore。 */
export type ExternalKeyStore = {
  read(): string;
  /** 换一把新键（清空对话）。 */
  rotate(): void;
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
 * localStorage 版会话身份键。键值只在 rotate（清空对话）时更换，
 * 因此刷新页面仍会命中同一条 conversation —— 这正是「不清空就一直同一个 id」。
 */
export function localExternalKeyStore(storageKey: string): ExternalKeyStore {
  let cached: string | null = null;
  return {
    read() {
      if (cached) return cached;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          cached = stored;
          return stored;
        }
      } catch {
        /* localStorage 不可用时退化为内存键 */
      }
      const fresh = randomLifecycleId();
      cached = fresh;
      try {
        localStorage.setItem(storageKey, fresh);
      } catch {
        /* 忽略：内存键仍能保证本次会话内稳定 */
      }
      return fresh;
    },
    rotate() {
      cached = null;
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* 忽略 */
      }
    },
  };
}

/** 进程内会话身份键：刷新即换新会话，适合一次性面板。 */
export function memoryExternalKeyStore(): ExternalKeyStore {
  let value = randomLifecycleId();
  return {
    read: () => value,
    rotate() {
      value = randomLifecycleId();
    },
  };
}

/** 生命周期调用失败：带 Core 的稳定错误码与 required_action，便于界面给出下一步。 */
export class BknLifecycleError extends Error {
  readonly code: string;
  readonly requiredAction: string;

  constructor(tool: string, code: string, message: string, requiredAction: string) {
    super(message || `${tool} 失败（${code || "unknown"}）`);
    this.name = "BknLifecycleError";
    this.code = code;
    this.requiredAction = requiredAction;
  }
}

type LifecycleErrorPayload = { code?: unknown; message?: unknown; required_action?: unknown };

/**
 * 会话里还挂着一轮没终结的交互。正常路径不会走到这儿（本地闸门会排队），只有上一轮的
 * 终结真的没送达 Core 时才出现——例如业务调用的响应丢在网络上，前端拿不到回执，
 * 清单缺一条，终结被判 closure_manifest_invalid。
 *
 * 这时前端救不回来：补齐清单需要按 interaction 列出已登记的 operation，而受管接口
 * 只允许按 id 查（TRACE.md 第三节：第三方 Agent 只能查询 Operation/Receipt）。
 * 但用户有出路——清空对话会换一条全新 conversation，卡住的那轮留给 Core 的租约回收。
 * 所以这里把出路写进报错，别让人对着「已有进行中的交互」干等 30 分钟租约。
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

function numberField(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === "number" ? value : 0;
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
  const { externalKeyStore, oneShot = false, leaseSeconds = DEFAULT_LEASE_SECONDS } = options;
  let conversationId: string | null = null;
  let notSupported = false;
  /**
   * 上一轮交互的终结闸门。会话内只能有一个 active interaction，抢跑的第二轮会被 Core
   * 的唯一约束顶掉 —— 用户手快连发、数据浏览器同时展开两张卡都会走到这条路上。
   */
  let previousTurnSettled: Promise<void> = Promise.resolve();

  async function ensureConversation(): Promise<string | null> {
    if (notSupported) return null;
    if (conversationId) return conversationId;
    try {
      // ensure-current 按 external_conversation_key 幂等：刷新页面拿回同一条会话，
      // 会话已关闭则由 Core 开新 generation，前端不需要自己判断该 create 还是 resume。
      const state = await callLifecycleTool(session, "bkn_create_conversation", {
        external_conversation_key: externalKeyStore.read(),
        idempotency_key: randomLifecycleId(),
        one_shot: oneShot,
      });
      conversationId = stringField(state, "conversation_id") || null;
      return conversationId;
    } catch (error) {
      if (error instanceof BknLifecycleError && error.code === "lifecycle_not_supported") {
        notSupported = true;
        return null;
      }
      throw error;
    }
  }

  return {
    session,
    conversationId: () => conversationId,
    unsupported: () => notSupported,
    reset() {
      conversationId = null;
      externalKeyStore.rotate();
    },
    async beginTurn(question: string) {
      const waitFor = previousTurnSettled;
      let release = () => undefined as void;
      previousTurnSettled = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        // 闸门只会 resolve、不会 reject（终结失败也照样放行），所以这里不会串联失败。
        await waitFor;
        const currentConversation = await ensureConversation();
        if (!currentConversation) {
          release();
          return null;
        }
        const state = await callLifecycleTool(session, "bkn_start_interaction", {
          conversation_id: currentConversation,
          idempotency_key: randomLifecycleId(),
          question,
          lease_seconds: leaseSeconds,
        });
        return createTurn(session, currentConversation, state, release);
      } catch (error) {
        release();
        throw error;
      }
    },
  };
}

function createTurn(
  session: McpSession,
  conversationId: string,
  state: Record<string, unknown>,
  /** 终结后放行下一轮（成败都放行，否则一次收尾失败会让整条会话再也开不出交互）。 */
  release: () => void,
): BknTurn {
  const interactionId = stringField(state, "interaction_id");
  const leaseToken = stringField(state, "lease_token");
  const leaseEpoch = numberField(state, "lease_epoch");
  const receipts: BknReceiptRef[] = [];
  let operationSeq = 0;
  let terminated = false;

  async function terminate(tool: string, reason: string, answer?: string): Promise<void> {
    // 终结只做一次：重复调用会撞 Core 的 terminal_conflict，而调用方在
    // 「停止后又出错」这类路径上很容易两次都触发。
    if (terminated) return;
    terminated = true;
    // 清单必须一条不漏地列出本轮登记过的 operation / receipt，且 required 与 Core 侧一致，
    // 数量对不上直接 closure_manifest_invalid。
    const args: Record<string, unknown> = {
      interaction_id: interactionId,
      terminal_idempotency_key: randomLifecycleId(),
      lease_token: leaseToken,
      lease_epoch: leaseEpoch,
      completion_manifest_version: MANIFEST_VERSION,
      completion_reason: reason,
      expected_operations: receipts.map((r) => ({ operation_id: r.operationId, required: r.required })),
      expected_receipts: receipts.map((r) => ({ receipt_id: r.receiptId, required: r.required })),
    };
    // answer 只在 complete 的 schema 里声明；cancel / fail 传了会撞
    // additionalProperties: false。
    if (answer !== undefined) {
      args.answer = answer;
      args.assembler_deadline = new Date(Date.now() + ASSEMBLER_DEADLINE_MS).toISOString();
    }
    try {
      await callLifecycleTool(session, tool, args);
    } finally {
      release();
    }
  }

  return {
    conversationId,
    interactionId,
    nextContext(toolName: string) {
      operationSeq += 1;
      return {
        conversation_id: conversationId,
        interaction_id: interactionId,
        operation_key: `${toolName}#${operationSeq}`,
      };
    },
    recordReceipt(receipt) {
      // 同一 operation 的重放会回同一个 receipt，去重后清单才不会多算。
      if (!receipt || receipts.some((r) => r.operationId === receipt.operationId)) return;
      receipts.push(receipt);
    },
    complete: (answer: string) => terminate("bkn_complete_interaction", "answer_returned", answer),
    fail: (reason: string) => terminate("bkn_fail_interaction", reason || "agent_error"),
    cancel: (reason: string) => terminate("bkn_cancel_interaction", reason || "stopped_by_user"),
    finish(outcome, answer) {
      if (outcome === "canceled") return terminate("bkn_cancel_interaction", "stopped_by_user");
      if (outcome === "failed") return terminate("bkn_fail_interaction", "agent_error");
      return terminate("bkn_complete_interaction", "answer_returned", answer);
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

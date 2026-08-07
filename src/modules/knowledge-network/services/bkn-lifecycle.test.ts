/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import {
  createBknLifecycleOn,
  memoryConversationStore,
  withManagedTurn,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import type { McpSession, McpToolCallResult } from "@/modules/knowledge-network/services/context-loader.service";

type Call = { name: string; args: Record<string, unknown> };

function fakeSession(overrides: Record<string, () => McpToolCallResult> = {}) {
  const calls: Call[] = [];
  let interactionSeq = 0;
  const session: McpSession = {
    callTool(name, args) {
      calls.push({ name, args });
      const override = overrides[name];
      if (override) return Promise.resolve(override());
      if (name === "bkn_start_interaction") {
        interactionSeq += 1;
        const conversationId = typeof args.conversation_id === "string" ? args.conversation_id : "conv_1";
        return Promise.resolve({
          ok: true,
          text: "started",
          latencyMs: 1,
          isError: false,
          structured: {
            interaction_id: `int_${interactionSeq}`,
            conversation_id: conversationId,
            execution_status: "active",
          },
        });
      }
      if (name === "bkn_finish_interaction") {
        return Promise.resolve({
          ok: true,
          text: "finished",
          latencyMs: 1,
          isError: false,
          structured: { interaction_id: args.interaction_id, conversation_id: "conv_1", execution_status: "completed" },
        });
      }
      return Promise.resolve({ ok: true, text: "ok", latencyMs: 1, isError: false, structured: {} });
    },
  };
  return { session, calls };
}

const options = () => ({ conversationStore: memoryConversationStore() });

describe("createBknLifecycle", () => {
  it("starts the first interaction without a conversation and reuses the authority ID", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());

    const first = await lifecycle.beginTurn("first question");
    await first?.complete("first answer");
    const second = await lifecycle.beginTurn("second question");

    expect(calls[0]).toEqual({ name: "bkn_start_interaction", args: { question: "first question" } });
    expect(calls[2]).toEqual({
      name: "bkn_start_interaction",
      args: { question: "second question", conversation_id: "conv_1" },
    });
    expect(second?.conversationId).toBe(first?.conversationId);
  });

  it("uses only bkn_start_interaction and bkn_finish_interaction", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());
    const turn = await lifecycle.beginTurn("question");

    expect(turn?.nextContext()).toEqual({ conversation_id: "conv_1", interaction_id: "int_1" });
    await turn?.complete("answer");

    expect(calls).toEqual([
      { name: "bkn_start_interaction", args: { question: "question" } },
      { name: "bkn_finish_interaction", args: { interaction_id: "int_1", outcome: "completed", answer: "answer" } },
    ]);
  });

  it("maps cancellation and failure to the unified finish outcome", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());

    const canceled = await lifecycle.beginTurn("cancel");
    await canceled?.cancel("user stopped");
    const failed = await lifecycle.beginTurn("fail");
    await failed?.fail("model error");

    expect(calls.filter((call) => call.name === "bkn_finish_interaction").map((call) => call.args)).toEqual([
      { interaction_id: "int_1", outcome: "cancelled", reason: "user stopped" },
      { interaction_id: "int_2", outcome: "failed", reason: "model error" },
    ]);
  });

  it("degrades only when bkn_start_interaction is unavailable", async () => {
    const { session, calls } = fakeSession({
      bkn_start_interaction: () => ({
        ok: false,
        text: "tool not found",
        latencyMs: 1,
        isError: true,
        rpcError: { code: -32602, message: "tool not found: bkn_start_interaction" },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(lifecycle.beginTurn("question")).resolves.toBeNull();
    await expect(lifecycle.beginTurn("another question")).resolves.toBeNull();
    expect(lifecycle.unsupported()).toBe(true);
    // 每轮都重试：不支持是部署态，不该在会话里被latch住。
    expect(calls).toHaveLength(2);
  });

  /**
   * 页面开着的时候后端升级/重启，bkn_start_interaction 就补上了。之前第一次失败即永久降级，
   * 该标签页余下所有业务调用都不带 bkn_context，每一条都稳定 conversation_required。
   */
  it("recovers on the next turn once the deployment gains the lifecycle tools", async () => {
    let attempts = 0;
    const { session } = fakeSession({
      bkn_start_interaction: () => {
        attempts += 1;
        if (attempts === 1) {
          return {
            ok: false,
            text: "tool not found",
            latencyMs: 1,
            isError: true,
            rpcError: { code: -32602, message: "tool not found: bkn_start_interaction" },
          };
        }
        return {
          ok: true,
          text: "started",
          latencyMs: 1,
          isError: false,
          structured: { interaction_id: "int_9", conversation_id: "conv_9", execution_status: "active" },
        };
      },
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(lifecycle.beginTurn("before the upgrade")).resolves.toBeNull();
    const recovered = await lifecycle.beginTurn("after the upgrade");

    expect(recovered?.nextContext()).toEqual({ conversation_id: "conv_9", interaction_id: "int_9" });
    expect(lifecycle.unsupported()).toBe(false);
  });

  it("starts a new conversation when a persisted conversation is no longer usable", async () => {
    let starts = 0;
    const { session, calls } = fakeSession({
      bkn_start_interaction: () => {
        starts += 1;
        if (starts === 1) {
          return {
            ok: false,
            text: "conversation not found",
            latencyMs: 1,
            isError: true,
            structured: { error: { code: "conversation_not_found", message: "conversation not found" } },
          };
        }
        return {
          ok: true,
          text: "started",
          latencyMs: 1,
          isError: false,
          structured: { interaction_id: "int_2", conversation_id: "conv_2", execution_status: "active" },
        };
      },
    });
    const store = { read: () => "stale_conv", write: vi.fn(), clear: vi.fn() };
    const lifecycle = createBknLifecycleOn(session, { conversationStore: store });

    await expect(lifecycle.beginTurn("question")).resolves.toMatchObject({ conversationId: "conv_2", interactionId: "int_2" });
    expect(calls).toEqual([
      { name: "bkn_start_interaction", args: { question: "question", conversation_id: "stale_conv" } },
      { name: "bkn_start_interaction", args: { question: "question" } },
    ]);
    expect(store.clear).toHaveBeenCalledOnce();
    expect(store.write).toHaveBeenCalledWith("conv_2");
  });

  /**
   * 上一轮没走完（刷新、关标签页、收尾请求自己失败）会在 Core 上留下一条 active
   * interaction，而一条 conversation 只允许一个。后端把卡住的那条 id 回带在错误里，
   * 客户端照着 required_action 回收即可，不必让用户清空对话。
   */
  it("回收上一轮残留的活跃交互，然后在同一条会话上继续", async () => {
    let starts = 0;
    const { session, calls } = fakeSession({
      bkn_start_interaction: () => {
        starts += 1;
        if (starts === 1) {
          return {
            ok: false,
            text: "in progress",
            latencyMs: 1,
            isError: true,
            structured: {
              error: {
                code: "interaction_in_progress",
                message: "the conversation already has an active interaction",
                required_action: "bkn_finish_interaction",
                current_interaction_id: "int_stuck",
              },
            },
          };
        }
        return {
          ok: true,
          text: "started",
          latencyMs: 1,
          isError: false,
          structured: { interaction_id: "int_9", conversation_id: "conv_live", execution_status: "active" },
        };
      },
    });
    const store = { read: () => "conv_live", write: vi.fn(), clear: vi.fn() };
    const lifecycle = createBknLifecycleOn(session, { conversationStore: store });

    await expect(lifecycle.beginTurn("question")).resolves.toMatchObject({ conversationId: "conv_live", interactionId: "int_9" });
    expect(calls).toEqual([
      { name: "bkn_start_interaction", args: { question: "question", conversation_id: "conv_live" } },
      {
        name: "bkn_finish_interaction",
        // cancelled 而非 completed：那一轮确实没答完，不该在 Trace 上记成正常结束。
        args: { interaction_id: "int_stuck", outcome: "cancelled", reason: "reclaimed by client: previous turn did not finish" },
      },
      { name: "bkn_start_interaction", args: { question: "question", conversation_id: "conv_live" } },
    ]);
    // 会话没被丢掉，用户的对话历史在 Trace 上仍然连着。
    expect(store.clear).not.toHaveBeenCalled();
  });

  it("本实例已经开过交互后不再回收，避免掐掉另一个标签页正在跑的那一轮", async () => {
    // conversation 键只按 kn + 面板取，同一个网络在另一个标签页里开着时，那边正在跑的
    // 交互从这里看跟"残留"完全一样。本实例成功开过之后再撞上，更可能是并发而不是残留。
    let starts = 0;
    const { session, calls } = fakeSession({
      bkn_start_interaction: () => {
        starts += 1;
        if (starts === 2) {
          return {
            ok: false,
            text: "in progress",
            latencyMs: 1,
            isError: true,
            structured: {
              error: {
                code: "interaction_in_progress",
                message: "the conversation already has an active interaction",
                required_action: "bkn_finish_interaction",
                current_interaction_id: "int_other_tab",
              },
            },
          };
        }
        return {
          ok: true,
          text: "started",
          latencyMs: 1,
          isError: false,
          structured: { interaction_id: `int_${starts}`, conversation_id: `conv_${starts}`, execution_status: "active" },
        };
      },
    });
    const lifecycle = createBknLifecycleOn(session, options());

    const first = await lifecycle.beginTurn("第一轮");
    await first?.complete("答复");
    await expect(lifecycle.beginTurn("第二轮")).resolves.toMatchObject({ conversationId: "conv_3" });

    // 没有替别人 finish：只有本轮自己那次 complete。
    expect(calls.filter((call) => call.name === "bkn_finish_interaction").map((call) => call.args.interaction_id)).toEqual([
      "int_1",
    ]);
  });

  it("回收失败时退回换新会话，不把用户卡死", async () => {
    let starts = 0;
    const { session, calls } = fakeSession({
      bkn_start_interaction: () => {
        starts += 1;
        if (starts === 1) {
          return {
            ok: false,
            text: "in progress",
            latencyMs: 1,
            isError: true,
            structured: {
              error: {
                code: "interaction_in_progress",
                message: "the conversation already has an active interaction",
                required_action: "bkn_finish_interaction",
                current_interaction_id: "int_stuck",
              },
            },
          };
        }
        return {
          ok: true,
          text: "started",
          latencyMs: 1,
          isError: false,
          structured: { interaction_id: "int_2", conversation_id: "conv_new", execution_status: "active" },
        };
      },
      bkn_finish_interaction: () => ({
        ok: false,
        text: "cannot finish",
        latencyMs: 1,
        isError: true,
        structured: { error: { code: "terminal_conflict", message: "cannot finish" } },
      }),
    });
    const store = { read: () => "conv_stuck", write: vi.fn(), clear: vi.fn() };
    const lifecycle = createBknLifecycleOn(session, { conversationStore: store });

    await expect(lifecycle.beginTurn("question")).resolves.toMatchObject({ conversationId: "conv_new" });
    expect(calls.map((call) => call.name)).toEqual([
      "bkn_start_interaction",
      "bkn_finish_interaction",
      "bkn_start_interaction",
    ]);
    expect(calls.at(-1)?.args).toEqual({ question: "question" });
    expect(store.clear).toHaveBeenCalledOnce();
  });

  it("releases the next turn when finish fails", async () => {
    const { session } = fakeSession({
      bkn_finish_interaction: () => ({
        ok: false,
        text: "finish failed",
        latencyMs: 1,
        isError: true,
        structured: { error: { code: "terminal_conflict", message: "finish failed" } },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());
    const first = await lifecycle.beginTurn("first");

    await expect(first?.complete("answer")).rejects.toMatchObject({ code: "terminal_conflict" });
    await expect(lifecycle.beginTurn("second")).resolves.not.toBeNull();
  });
});

describe("withManagedTurn", () => {
  it("finishes failed business calls with the unified terminal", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(withManagedTurn(lifecycle, "load", () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(calls.at(-1)).toEqual({
      name: "bkn_finish_interaction",
      args: { interaction_id: "int_1", outcome: "failed", reason: "agent_error" },
    });
  });
});

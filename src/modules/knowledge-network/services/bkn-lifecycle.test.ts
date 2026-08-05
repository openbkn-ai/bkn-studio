/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  createBknLifecycleOn,
  memoryConversationStore,
  withManagedTurn,
  type ConversationStore,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import type { McpSession, McpToolCallResult } from "@/modules/knowledge-network/services/context-loader.service";

type Call = { name: string; args: Record<string, unknown> };

/**
 * 假的 Core，照 foundry #618 之后的契约建模：
 * 首轮不带 conversation_id 由后端分配，之后回传复用；一条会话同时只准一个 active interaction。
 */
function fakeSession(overrides: Record<string, () => McpToolCallResult | null> = {}) {
  const calls: Call[] = [];
  /** 已分配的会话 → 在途交互 id（null = 空闲）。 */
  const active = new Map<string, string | null>();
  let conversationSeq = 0;
  let interactionSeq = 0;
  const ok = (structured: unknown): McpToolCallResult => ({
    ok: true,
    text: "managed lifecycle state updated",
    latencyMs: 1,
    structured,
    isError: false,
  });
  const failed = (structured: unknown, text: string): McpToolCallResult => ({
    ok: true,
    text,
    latencyMs: 1,
    structured,
    isError: true,
  });
  const session: McpSession = {
    callTool(name, args) {
      calls.push({ name, args });
      // override 返回 null = 这一次交还给默认实现（用于「只让第一次失败」这类场景）。
      const overridden = overrides[name]?.();
      if (overridden) return Promise.resolve(overridden);
      if (name === "bkn_start_interaction") {
        let conversationId = typeof args.conversation_id === "string" ? args.conversation_id : "";
        if (conversationId && !active.has(conversationId)) {
          return Promise.resolve(
            failed(
              { error: { code: "resource_not_disclosed", message: "request was not found in the authorized scope" } },
              "resource_not_disclosed",
            ),
          );
        }
        if (!conversationId) {
          conversationSeq += 1;
          conversationId = `conv_${conversationSeq}`;
          active.set(conversationId, null);
        }
        const inFlight = active.get(conversationId);
        if (inFlight) {
          return Promise.resolve(
            failed(
              {
                error: {
                  code: "interaction_in_progress",
                  message: "the conversation already has an active interaction",
                  required_action: "bkn_finish_interaction",
                  current_interaction_id: inFlight,
                },
              },
              "interaction_in_progress",
            ),
          );
        }
        interactionSeq += 1;
        const interactionId = `int_${interactionSeq}`;
        active.set(conversationId, interactionId);
        return Promise.resolve(
          ok({ interaction_id: interactionId, conversation_id: conversationId, execution_status: "active" }),
        );
      }
      if (name === "bkn_finish_interaction") {
        const interactionId = String(args.interaction_id);
        for (const [conversationId, inFlight] of active) {
          if (inFlight === interactionId) active.set(conversationId, null);
        }
        return Promise.resolve(ok({ interaction_id: interactionId, execution_status: "completed" }));
      }
      return Promise.resolve({ ok: true, text: "rows", latencyMs: 1, isError: false });
    },
  };
  return { session, calls };
}

const options = () => ({ conversationStore: memoryConversationStore() });

describe("createBknLifecycle", () => {
  it("keeps one conversation across turns and only rotates it on reset", async () => {
    const { session } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());

    const first = await lifecycle.beginTurn("第一问");
    await first?.complete("答一");
    const second = await lifecycle.beginTurn("第二问");
    await second?.complete("答二");

    // 不清空对话就一直是同一条会话；每轮问答各自一条交互。
    expect(first?.conversationId).toBe(second?.conversationId);
    expect(first?.interactionId).not.toBe(second?.interactionId);

    await second?.complete("答二");
    lifecycle.reset();
    const third = await lifecycle.beginTurn("清空后再问");
    expect(third?.conversationId).not.toBe(first?.conversationId);
  });

  it("asks for a conversation only on the first turn and reuses the assigned id", async () => {
    const { session, calls } = fakeSession();
    const store = memoryConversationStore();
    const lifecycle = createBknLifecycleOn(session, { conversationStore: store, agentName: "bkn-studio · test" });

    const first = await lifecycle.beginTurn("第一问");
    await first!.complete("答一");
    await lifecycle.beginTurn("第二问");

    const starts = calls.filter((call) => call.name === "bkn_start_interaction");
    // 首轮不带 conversation_id（新契约由 Core 分配），第二轮回传它拿回同一条会话。
    expect(starts[0].args).not.toHaveProperty("conversation_id");
    expect(starts[0].args.agent_name).toBe("bkn-studio · test");
    expect(starts[1].args.conversation_id).toBe(first!.conversationId);
    expect(store.read()).toBe(first!.conversationId);
  });

  it("shares one context across every tool call in a turn", async () => {
    const { session } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());
    const turn = await lifecycle.beginTurn("问");

    // operation_key 已收回 facade 内部（后端按入参哈希自己算），前端只带这两个 id。
    expect(turn!.context()).toEqual({
      conversation_id: turn!.conversationId,
      interaction_id: turn!.interactionId,
    });
    expect(turn!.context()).toEqual(turn!.context());
  });

  it("sends the wire outcome spelling and only the fields the schema declares", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());

    const completed = await lifecycle.beginTurn("问一");
    await completed!.complete("答");
    const canceled = await lifecycle.beginTurn("问二");
    await canceled!.cancel("stopped_by_user");

    const [done, stopped] = calls.filter((call) => call.name === "bkn_finish_interaction");
    expect(done.args).toEqual({ interaction_id: completed!.interactionId, outcome: "completed", answer: "答" });
    // 入参枚举是 cancelled（双 l），出参才是 canceled；additionalProperties:false，answer 不能带。
    expect(stopped.args).toEqual({
      interaction_id: canceled!.interactionId,
      outcome: "cancelled",
      reason: "stopped_by_user",
    });
  });

  it("terminates a turn only once", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());
    const turn = await lifecycle.beginTurn("问");

    await turn!.cancel("stopped_by_user");
    // 「停止后又抛错」的路径会两次触发收尾；第二次撞 Core 的 terminal_conflict。
    await turn!.fail("agent_error");

    expect(calls.filter((call) => call.name.endsWith("_interaction")).map((call) => call.name)).toEqual([
      "bkn_start_interaction",
      "bkn_finish_interaction",
    ]);
  });

  it("degrades to no managed context when the backend has no lifecycle tools", async () => {
    const { session, calls } = fakeSession({
      bkn_start_interaction: () => ({
        ok: true,
        text: "",
        latencyMs: 1,
        isError: false,
        rpcError: { code: -32602, message: "tool not found: bkn_start_interaction" },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(lifecycle.beginTurn("问")).resolves.toBeNull();
    expect(lifecycle.unsupported()).toBe(true);

    // 判定为不支持后不再重试握手，业务调用按旧行为直接发。
    await expect(lifecycle.beginTurn("再问")).resolves.toBeNull();
    expect(calls.filter((call) => call.name === "bkn_start_interaction")).toHaveLength(1);
  });

  it("surfaces the stable lifecycle error code instead of a generic failure", async () => {
    const { session } = fakeSession({
      bkn_start_interaction: () => ({
        ok: true,
        text: "quota_exhausted: interaction quota exhausted",
        latencyMs: 1,
        isError: true,
        structured: {
          error: {
            code: "quota_exhausted",
            message: "interaction quota exhausted",
            required_action: "wait_and_retry",
          },
        },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(lifecycle.beginTurn("问")).rejects.toMatchObject({
      code: "quota_exhausted",
      requiredAction: "wait_and_retry",
    });
  });

  it("drops a stored conversation the backend no longer discloses and opens a fresh one", async () => {
    const { session, calls } = fakeSession();
    const store: ConversationStore = memoryConversationStore();
    // 后端换库/换租户后，存下来的会话 id 已不在授权范围内。
    store.write("conv_from_another_deploy");
    const lifecycle = createBknLifecycleOn(session, { conversationStore: store });

    const turn = await lifecycle.beginTurn("问");

    expect(turn!.conversationId).toBe("conv_1");
    expect(store.read()).toBe("conv_1");
    const starts = calls.filter((call) => call.name === "bkn_start_interaction");
    expect(starts.map((call) => call.args.conversation_id)).toEqual(["conv_from_another_deploy", undefined]);
  });

  it("reclaims a leaked interaction instead of leaving the conversation stuck", async () => {
    const { session, calls } = fakeSession();
    const store = memoryConversationStore();
    // 上一次页面在 finish 之前被刷掉：会话里的那轮永远留在 active，只有租约能回收。
    const leaked = createBknLifecycleOn(session, { conversationStore: store });
    const abandoned = await leaked.beginTurn("被打断的一问");

    const lifecycle = createBknLifecycleOn(session, { conversationStore: store });
    const turn = await lifecycle.beginTurn("刷新后再问");

    // 本地闸门是空的，所以在途那轮必定是泄漏的：替它收尾再开新的一轮。
    const reclaim = calls.find(
      (call) => call.name === "bkn_finish_interaction" && call.args.reason === "reclaimed_by_client",
    );
    expect(reclaim?.args).toMatchObject({ interaction_id: abandoned!.interactionId, outcome: "cancelled" });
    expect(turn!.conversationId).toBe(abandoned!.conversationId);
    expect(turn!.interactionId).not.toBe(abandoned!.interactionId);
  });

  it("tells the user how to escape when the stuck turn cannot be reclaimed", async () => {
    const { session } = fakeSession({
      bkn_start_interaction: () => ({
        ok: true,
        text: "interaction_in_progress: the conversation already has an active interaction",
        latencyMs: 1,
        isError: true,
        // 没回带 current_interaction_id 就无从回收，只能把出路交给用户。
        structured: {
          error: {
            code: "interaction_in_progress",
            message: "the conversation already has an active interaction",
            required_action: "bkn_finish_interaction",
          },
        },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(lifecycle.beginTurn("问")).rejects.toMatchObject({
      code: "interaction_in_progress",
      message: expect.stringContaining("清空") as unknown as string,
    });
  });

  it("queues a second turn until the first one is terminated", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());

    const first = await lifecycle.beginTurn("第一问");
    const secondPending = lifecycle.beginTurn("第二问");
    await Promise.resolve();

    // 会话内只能有一个 active interaction；抢跑的第二轮会被 Core 的唯一约束顶掉。
    expect(calls.filter((call) => call.name === "bkn_start_interaction")).toHaveLength(1);

    await first!.complete("答一");
    const second = await secondPending;
    expect(second!.interactionId).not.toBe(first!.interactionId);
    expect(calls.filter((call) => call.name === "bkn_start_interaction")).toHaveLength(2);
  });

  it("still lets the next turn start after a terminal call fails", async () => {
    let terminals = 0;
    const { session } = fakeSession({
      bkn_finish_interaction: () => {
        terminals += 1;
        // 只让第一次收尾失败；之后交还默认实现，好让回收那一步真的把在途交互清掉。
        if (terminals > 1) return null;
        return {
          ok: false,
          text: "terminal conflict",
          latencyMs: 1,
          isError: true,
          structured: { error: { code: "terminal_conflict", message: "terminal conflict" } },
        };
      },
    });
    const lifecycle = createBknLifecycleOn(session, options());

    const first = await lifecycle.beginTurn("第一问");
    await expect(first!.complete("答")).rejects.toMatchObject({ code: "terminal_conflict" });

    // 收尾失败若不放行闸门，整条会话此后再也开不出交互。
    await expect(lifecycle.beginTurn("第二问")).resolves.not.toBeNull();
  });
});

describe("withManagedTurn", () => {
  it("terminates the interaction even when the business call throws", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(
      withManagedTurn(lifecycle, "加载", () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");

    // 不终结的交互会一直挂在 active，直到 Core 租约回收，期间开不出下一轮。
    expect(calls.find((call) => call.name === "bkn_finish_interaction")?.args).toMatchObject({
      outcome: "failed",
      reason: "agent_error",
    });
  });

  it("does not let a failing terminal call mask the business result", async () => {
    const { session } = fakeSession({
      bkn_finish_interaction: () => ({
        ok: false,
        text: "terminal conflict",
        latencyMs: 1,
        isError: true,
        structured: { error: { code: "terminal_conflict", message: "terminal conflict" } },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(withManagedTurn(lifecycle, "加载", () => Promise.resolve("data"))).resolves.toBe("data");
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  createBknLifecycleOn,
  memoryExternalKeyStore,
  withManagedTurn,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import type { McpSession, McpToolCallResult } from "@/modules/knowledge-network/services/context-loader.service";

type Call = { name: string; args: Record<string, unknown> };

/** 假的 Core：conversation 按 external_conversation_key 幂等，interaction 递增。 */
function fakeSession(overrides: Record<string, () => McpToolCallResult> = {}) {
  const calls: Call[] = [];
  const conversations = new Map<string, string>();
  let interactionSeq = 0;
  const ok = (structured: unknown): McpToolCallResult => ({
    ok: true,
    text: "managed lifecycle state updated",
    latencyMs: 1,
    structured,
    isError: false,
  });
  const session: McpSession = {
    callTool(name, args) {
      calls.push({ name, args });
      const override = overrides[name];
      if (override) return Promise.resolve(override());
      if (name === "bkn_create_conversation") {
        const key = String(args.external_conversation_key);
        if (!conversations.has(key)) conversations.set(key, `conv_${conversations.size + 1}`);
        return Promise.resolve(ok({ conversation_id: conversations.get(key), status: "active" }));
      }
      if (name === "bkn_start_interaction") {
        interactionSeq += 1;
        return Promise.resolve(
          ok({
            interaction_id: `int_${interactionSeq}`,
            conversation_id: args.conversation_id,
            lease_token: `lease_${interactionSeq}`,
            lease_epoch: 1,
          }),
        );
      }
      if (name.startsWith("bkn_")) return Promise.resolve(ok({ interaction_id: args.interaction_id }));
      // 业务工具：回一张受管回执。
      return Promise.resolve({
        ok: true,
        text: "rows",
        latencyMs: 1,
        isError: false,
        structured: {
          bkn_receipt: {
            operation_id: `op_${calls.length}`,
            receipt_id: `rcp_${calls.length}`,
            required: true,
          },
        },
      });
    },
  };
  return { session, calls };
}

const options = () => ({ externalKeyStore: memoryExternalKeyStore() });

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

    lifecycle.reset();
    const third = await lifecycle.beginTurn("清空后再问");
    expect(third?.conversationId).not.toBe(first?.conversationId);
  });

  it("gives every tool call a distinct operation_key under the same interaction", async () => {
    const { session } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());
    const turn = await lifecycle.beginTurn("问");

    const first = turn!.nextContext("run_sql");
    const second = turn!.nextContext("run_sql");

    expect(first.conversation_id).toBe(second.conversation_id);
    expect(first.interaction_id).toBe(second.interaction_id);
    // operation_key 在交互内唯一，否则第二次调用会被 Core 当成第一次的重放。
    expect(first.operation_key).not.toBe(second.operation_key);
  });

  it("lists every recorded operation and receipt in the closure manifest", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());
    const turn = await lifecycle.beginTurn("问");

    turn!.recordReceipt({ operationId: "op_a", receiptId: "rcp_a", required: true });
    turn!.recordReceipt({ operationId: "op_b", receiptId: "rcp_b", required: true });
    // 同一 operation 的重放回同一张回执，清单里不能重复计数。
    turn!.recordReceipt({ operationId: "op_a", receiptId: "rcp_a", required: true });
    await turn!.complete("答");

    const terminal = calls.find((call) => call.name === "bkn_complete_interaction")!;
    expect(terminal.args.expected_operations).toEqual([
      { operation_id: "op_a", required: true },
      { operation_id: "op_b", required: true },
    ]);
    expect(terminal.args.expected_receipts).toEqual([
      { receipt_id: "rcp_a", required: true },
      { receipt_id: "rcp_b", required: true },
    ]);
    expect(terminal.args).toMatchObject({
      lease_token: "lease_1",
      lease_epoch: 1,
      completion_manifest_version: "1",
      answer: "答",
    });
    // 带 pending 回执的成功交互要给收敛窗口，否则永远停在 assembling。
    expect(terminal.args.assembler_deadline).toEqual(expect.any(String));
  });

  it("omits answer and assembler_deadline on the non-success terminals", async () => {
    const { session, calls } = fakeSession();
    const lifecycle = createBknLifecycleOn(session, options());
    const turn = await lifecycle.beginTurn("问");

    await turn!.cancel("stopped_by_user");

    // cancel / fail 的 schema 没有这两个字段，additionalProperties: false 会直接拒。
    const terminal = calls.find((call) => call.name === "bkn_cancel_interaction")!;
    expect(terminal.args).not.toHaveProperty("answer");
    expect(terminal.args).not.toHaveProperty("assembler_deadline");
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
      "bkn_cancel_interaction",
    ]);
  });

  it("degrades to no managed context when the backend has no lifecycle tools", async () => {
    const { session, calls } = fakeSession({
      bkn_create_conversation: () => ({
        ok: true,
        text: "",
        latencyMs: 1,
        isError: false,
        rpcError: { code: -32602, message: "tool not found: bkn_create_conversation" },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(lifecycle.beginTurn("问")).resolves.toBeNull();
    expect(lifecycle.unsupported()).toBe(true);

    // 判定为不支持后不再重试握手，业务调用按旧行为直接发。
    await expect(lifecycle.beginTurn("再问")).resolves.toBeNull();
    expect(calls.filter((call) => call.name === "bkn_create_conversation")).toHaveLength(1);
  });

  it("surfaces the stable lifecycle error code instead of a generic failure", async () => {
    const { session } = fakeSession({
      bkn_start_interaction: () => ({
        ok: true,
        text: "conversation_not_found: conversation is unknown",
        latencyMs: 1,
        isError: true,
        structured: {
          error: {
            code: "conversation_not_found",
            message: "conversation is unknown",
            required_action: "create_conversation",
          },
        },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(lifecycle.beginTurn("问")).rejects.toMatchObject({
      code: "conversation_not_found",
      requiredAction: "create_conversation",
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
    const { session } = fakeSession({
      bkn_complete_interaction: () => ({
        ok: false,
        text: "closure manifest invalid",
        latencyMs: 1,
        isError: true,
        structured: { error: { code: "closure_manifest_invalid", message: "closure manifest invalid" } },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    const first = await lifecycle.beginTurn("第一问");
    await expect(first!.complete("答")).rejects.toMatchObject({ code: "closure_manifest_invalid" });

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
    expect(calls.map((call) => call.name)).toContain("bkn_fail_interaction");
  });

  it("does not let a failing terminal call mask the business result", async () => {
    const { session } = fakeSession({
      bkn_complete_interaction: () => ({
        ok: false,
        text: "closure manifest invalid",
        latencyMs: 1,
        isError: true,
        structured: { error: { code: "closure_manifest_invalid", message: "closure manifest invalid" } },
      }),
    });
    const lifecycle = createBknLifecycleOn(session, options());

    await expect(withManagedTurn(lifecycle, "加载", () => Promise.resolve("data"))).resolves.toBe("data");
  });
});

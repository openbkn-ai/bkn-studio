/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { buildAgentTools, DEFAULT_AGENT_CONFIG } from "@/modules/knowledge-network/services/agent-chat.service";
import type {
  McpSession,
  McpToolCallResult,
  McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

const env = { base: "https://platform.example.com", token: "token-1", knId: "kn-demo" };
const tokenProvider = { getToken: () => "token-1", refresh: () => Promise.resolve("token-1") };

/** Backend-provided business-tool schema: Context Loader has added bkn_context to properties and required. */
const runSql: McpToolDef = {
  name: "run_sql",
  description: "执行 SQL",
  inputSchema: {
    type: "object",
    properties: {
      kn_id: { type: "string" },
      sql: { type: "string" },
      bkn_context: { type: "object", properties: { conversation_id: { type: "string" } } },
    },
    required: ["kn_id", "sql", "bkn_context"],
  },
};

/** Schema copied from the real response shape: interception must not change how the model sees the tool. */
const startInteraction: McpToolDef = {
  name: "bkn_start_interaction",
  description: "开始交互",
  inputSchema: {
    type: "object",
    properties: { question: { type: "string" }, conversation_id: { type: "string" } },
    required: ["question"],
  },
};

const finishInteraction: McpToolDef = {
  name: "bkn_finish_interaction",
  description: "结束交互",
  inputSchema: {
    type: "object",
    properties: {
      interaction_id: { type: "string" },
      outcome: { type: "string", enum: ["completed", "failed", "cancelled", "handed_off"] },
      answer: { type: "string" },
      reason: { type: "string" },
    },
    required: ["interaction_id", "outcome"],
  },
};

/** Managed lifecycle tools supplied alongside other tools by the backend's tools/list response. */
const lifecycleTools: McpToolDef[] = [startInteraction, finishInteraction];

/** Structurally equivalent to the BknTurn passed by ChatPane. */
function managedTurn() {
  return {
    nextContext: () => ({ conversation_id: "conv_1", interaction_id: "int_1" }),
    finish: vi.fn<(outcome: "completed" | "failed" | "canceled", answer: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

function stubSession(result?: Partial<McpToolCallResult>) {
  const callTool = vi.fn<McpSession["callTool"]>().mockResolvedValue({
    ok: true,
    text: "rows",
    latencyMs: 1,
    isError: false,
    ...result,
  });
  return { callTool } satisfies McpSession;
}

function schemaOf(tool: unknown): Record<string, unknown> {
  const inputSchema = (tool as { inputSchema: { jsonSchema: Record<string, unknown> } }).inputSchema;
  return inputSchema.jsonSchema;
}

function runTool(tool: unknown, input: unknown): Promise<string> {
  const execute = (tool as { execute: (input: unknown, options: unknown) => Promise<string> }).execute;
  return execute(input, { toolCallId: "call-1", messages: [] });
}

describe("buildAgentTools", () => {
  it("生命周期工具照常给模型，不从工具表里拿掉", () => {
    // The prior filtered version asserted that only run_sql remained, leaving the model unable to
    // finish this interaction round. Now intercept the tools while binding execution to the client turn.
    const session = stubSession();
    const tools = buildAgentTools(
      [startInteraction, runSql, finishInteraction],
      env,
      "kn-demo",
      DEFAULT_AGENT_CONFIG,
      tokenProvider,
      { session, turn: managedTurn() },
    );

    expect(Object.keys(tools).sort()).toEqual(["bkn_finish_interaction", "bkn_start_interaction", "run_sql"]);
  });

  it("hides bkn_context from the model", () => {
    const session = stubSession();
    const tools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, { session });

    const schema = schemaOf(tools.run_sql);
    // If the model can see this field, it invents conversation/interaction IDs that do not exist in Core.
    expect(schema.properties).not.toHaveProperty("bkn_context");
    expect(schema.required).toEqual(["kn_id", "sql"]);
  });

  it("没有受管交互时生命周期工具直通后端，能力不打折", () => {
    const session = stubSession();
    const tools = buildAgentTools([...lifecycleTools, runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session,
    });

    expect(Object.keys(tools)).toEqual(["bkn_start_interaction", "bkn_finish_interaction", "run_sql"]);
  });

  /**
   * A loop observed in production: the model calls bkn_start_interaction, the backend creates an
   * unknown conversation, and business-call bkn_context belongs to the client's current turn. The
   * mismatch produces conversation_required, whose required_action points back to bkn_start_interaction,
   * causing the model to start another interaction. With interception, start no longer reaches the
   * backend and returns this turn's interaction instead.
   */
  it("接管 bkn_start_interaction：返回本轮交互，不向后端多开一条", async () => {
    const session = stubSession();
    const tools = buildAgentTools([...lifecycleTools, runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session,
      turn: managedTurn(),
    });

    const out = await runTool(tools.bkn_start_interaction, { question: "模型自己想开一轮" });

    expect(JSON.parse(out)).toEqual({ conversation_id: "conv_1", interaction_id: "int_1", execution_status: "active" });
    expect(session.callTool).not.toHaveBeenCalled();
  });

  it("接管 bkn_finish_interaction：走客户端的终结路径，不向后端直发", async () => {
    const session = stubSession();
    const turn = managedTurn();
    const tools = buildAgentTools([...lifecycleTools, runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session,
      turn,
    });

    const out = await runTool(tools.bkn_finish_interaction, { outcome: "completed", answer: "答完了" });

    expect(turn.finish).toHaveBeenCalledWith("completed", "答完了");
    expect(JSON.parse(out)).toMatchObject({ interaction_id: "int_1", execution_status: "completed" });
    expect(session.callTool).not.toHaveBeenCalled();
  });

  it("接管不改工具形状：后端 schema 原样透传给模型", () => {
    // Interception changes where a call lands, not what the tool looks like. Removing parameters
    // or enum values from the schema silently removes capabilities the model no longer knows exist.
    const tools = buildAgentTools(lifecycleTools, env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session: stubSession(),
      turn: managedTurn(),
    });

    // This implementation does not need question because the turn already exists, but it remains part of the backend contract.
    expect(schemaOf(tools.bkn_start_interaction).properties).toHaveProperty("question");
    expect(schemaOf(tools.bkn_start_interaction).required).toEqual(["question"]);
    // handed_off is rejected at runtime, but the schema must not pretend it does not exist.
    const outcome = (schemaOf(tools.bkn_finish_interaction).properties as Record<string, { enum?: string[] }>).outcome;
    expect(outcome.enum).toContain("handed_off");
  });

  it("接管的 bkn_finish_interaction 拒绝客户端没有语义的 outcome", async () => {
    const turn = managedTurn();
    const tools = buildAgentTools(lifecycleTools, env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session: stubSession(),
      turn,
    });

    const out = await runTool(tools.bkn_finish_interaction, { outcome: "handed_off" });

    expect(JSON.parse(out)).toMatchObject({ error: { code: "unsupported_outcome" } });
    expect(turn.finish).not.toHaveBeenCalled();
  });

  it("injects the turn context and locked kn_id into the real call", async () => {
    const session = stubSession();
    const tools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session,
      turn: managedTurn(),
    });

    await runTool(tools.run_sql, { sql: "SELECT 1", kn_id: "模型编的网络" });

    expect(session.callTool).toHaveBeenCalledWith(
      "run_sql",
      expect.objectContaining({
        sql: "SELECT 1",
        // kn_id and bkn_context are platform identity values; use locked values regardless of model input.
        kn_id: "kn-demo",
        bkn_context: { conversation_id: "conv_1", interaction_id: "int_1" },
      }),
    );
  });

  it("sends no managed context when the backend has no lifecycle", async () => {
    const session = stubSession();
    const tools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, { session });

    await runTool(tools.run_sql, { sql: "SELECT 1" });

    // Older Context Loader versions neither recognize nor require this field; sending an empty shell would make the request diverge from the schema.
    expect(session.callTool.mock.calls[0][1]).not.toHaveProperty("bkn_context");
  });

  it("strips required_action from lifecycle dead-end errors before they reach the model", async () => {
    const session = stubSession({
      isError: true,
      ok: false,
      text: JSON.stringify({
        error: {
          code: "conversation_required",
          message: "conversation_id is required",
          required_action: "bkn_start_interaction",
          retryable: false,
        },
      }),
    });
    const tools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, { session });

    const result = await runTool(tools.run_sql, { sql: "SELECT 1" });

    // Feeding the backend's next required action back to the model would fuel a loop.
    expect(result).not.toContain("required_action");
    expect(result).not.toContain("bkn_start_interaction");
    expect(result).toContain("conversation_required");
    expect(result).toContain("Stop tool calls");
  });

  it("同样处理已终结交互，并且不碰普通业务错误", async () => {
    const terminal = stubSession({
      isError: true,
      ok: false,
      text: JSON.stringify({ error: { code: "interaction_terminal", required_action: "start_interaction" } }),
    });
    const terminalTools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session: terminal,
    });
    expect(await runTool(terminalTools.run_sql, { sql: "SELECT 1" })).not.toContain("required_action");

    const plain = stubSession({
      isError: true,
      ok: false,
      text: JSON.stringify({ error: { code: "sql_error", message: "no such table: foo" } }),
    });
    const plainTools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session: plain,
    });
    // Pass business errors through unchanged so the model can correctly revise SQL and retry.
    expect(await runTool(plainTools.run_sql, { sql: "SELECT 1" })).toContain("no such table: foo");
  });
});

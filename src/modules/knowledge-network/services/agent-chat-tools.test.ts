/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { buildAgentTools, DEFAULT_AGENT_CONFIG } from "@/modules/knowledge-network/services/agent-chat.service";
import type {
  BknCallScope,
  McpSession,
  McpToolCallResult,
  McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

const env = { base: "https://platform.example.com", token: "token-1", knId: "kn-demo" };
const tokenProvider = { getToken: () => "token-1", refresh: () => Promise.resolve("token-1") };

/** 后端下发的业务工具 schema：bkn_context 已被 Context Loader 塞进 properties + required。 */
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

const startInteraction: McpToolDef = {
  name: "bkn_start_interaction",
  description: "开始交互",
  inputSchema: { type: "object", properties: { question: { type: "string" } } },
};

const finishInteraction: McpToolDef = {
  name: "bkn_finish_interaction",
  description: "结束交互",
  inputSchema: { type: "object", properties: { interaction_id: { type: "string" } } },
};

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
  it("does not expose bkn lifecycle tools to the model", () => {
    const session = stubSession();
    const tools = buildAgentTools(
      [startInteraction, runSql, finishInteraction],
      env,
      "kn-demo",
      DEFAULT_AGENT_CONFIG,
      tokenProvider,
      { session },
    );

    expect(Object.keys(tools)).toEqual(["run_sql"]);
  });

  it("hides bkn_context from the model", () => {
    const session = stubSession();
    const tools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, { session });

    const schema = schemaOf(tools.run_sql);
    // 模型看得见这个字段就会自己编 conversation/interaction id，而那些 id 在 Core 里根本不存在。
    expect(schema.properties).not.toHaveProperty("bkn_context");
    expect(schema.required).toEqual(["kn_id", "sql"]);
  });

  it("injects the turn context and locked kn_id into the real call", async () => {
    const session = stubSession();
    const turn: BknCallScope = {
      nextContext: () => ({
        conversation_id: "conv_1",
        interaction_id: "int_1",
      }),
    };
    const tools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
      session,
      turn,
    });

    await runTool(tools.run_sql, { sql: "SELECT 1", kn_id: "模型编的网络" });

    expect(session.callTool).toHaveBeenCalledWith(
      "run_sql",
      expect.objectContaining({
        sql: "SELECT 1",
        // kn_id 与 bkn_context 都是平台侧身份，模型传什么都以锁定值为准。
        kn_id: "kn-demo",
        bkn_context: { conversation_id: "conv_1", interaction_id: "int_1" },
      }),
    );
  });

  it("sends no managed context when the backend has no lifecycle", async () => {
    const session = stubSession();
    const tools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, { session });

    await runTool(tools.run_sql, { sql: "SELECT 1" });

    // 老版本 Context Loader 不认这个字段，也不强制它；多发一个空壳只会让请求体对不上 schema。
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

    // 把后端的「下一步该调 bkn_start_interaction」原样喂回去，模型就会照办——那正是死循环的燃料。
    expect(result).not.toContain("required_action");
    expect(result).not.toContain("bkn_start_interaction");
    expect(result).toContain("conversation_required");
    expect(result).toContain("停止工具调用");
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
    // 业务错误要原样给模型：它据此改 SQL 重试是正确行为。
    expect(await runTool(plainTools.run_sql, { sql: "SELECT 1" })).toContain("no such table: foo");
  });
});

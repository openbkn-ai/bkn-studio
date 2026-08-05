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
      context: () => ({ conversation_id: "conv_1", interaction_id: "int_1" }),
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

  it("never hands the lifecycle tools to the model", () => {
    const session = stubSession();
    const tools = buildAgentTools(
      [runSql, { name: "bkn_finish_interaction", description: "终结本轮交互" }],
      env,
      "kn-demo",
      DEFAULT_AGENT_CONFIG,
      tokenProvider,
      { session },
    );

    // 模型自己调 bkn_finish_interaction 会把本轮当场关掉，后续调用全被判 interaction_terminal。
    expect(Object.keys(tools)).toEqual(["run_sql"]);
  });

  it("sends no managed context when the backend has no lifecycle", async () => {
    const session = stubSession();
    const tools = buildAgentTools([runSql], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, { session });

    await runTool(tools.run_sql, { sql: "SELECT 1" });

    // 老版本 Context Loader 不认这个字段，也不强制它；多发一个空壳只会让请求体对不上 schema。
    expect(session.callTool.mock.calls[0][1]).not.toHaveProperty("bkn_context");
  });
});

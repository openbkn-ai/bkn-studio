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

function stubSession(result?: Partial<McpToolCallResult>) {
  const callTool = vi.fn<McpSession["callTool"]>().mockResolvedValue({
    ok: true,
    text: "ok",
    latencyMs: 1,
    isError: false,
    ...result,
  });
  return { callTool } satisfies McpSession;
}

function managedTurn() {
  return {
    nextContext: () => ({ conversation_id: "conv_1", interaction_id: "int_1" }),
    finish: vi.fn().mockResolvedValue(undefined),
  };
}

function runTool(tool: unknown, input: unknown): Promise<string> {
  const execute = (tool as { execute: (input: unknown, options: unknown) => Promise<string> }).execute;
  return execute(input, { toolCallId: "call-1", messages: [] });
}

function buildTool(name: string, session: McpSession) {
  const toolDef: McpToolDef = { name };
  const tools = buildAgentTools([toolDef], env, "kn-demo", DEFAULT_AGENT_CONFIG, tokenProvider, {
    session,
    turn: managedTurn(),
  });
  return tools[name];
}

describe("agent MCP argument guards", () => {
  it("blocks get_action_info when instance identities are missing", async () => {
    const session = stubSession();
    const result = await runTool(buildTool("get_action_info", session), { at_id: "at_1" });

    expect(session.callTool).not.toHaveBeenCalled();
    expect(JSON.parse(result)).toMatchObject({
      error: {
        code: "missing_action_recall_scope",
        required_fields: ["_instance_identities"],
      },
    });
  });

  it("allows get_action_info when the target instances are explicit", async () => {
    const session = stubSession();
    const result = await runTool(buildTool("get_action_info", session), {
      at_id: "at_1",
      _instance_identities: [{ id: "instance_1" }],
    });

    expect(result).toBe("ok");
    expect(session.callTool).toHaveBeenCalledWith(
      "get_action_info",
      expect.objectContaining({
        kn_id: "kn-demo",
        at_id: "at_1",
        _instance_identities: [{ id: "instance_1" }],
        bkn_context: { conversation_id: "conv_1", interaction_id: "int_1" },
      }),
    );
  });

  it("blocks execute_action when target instances or dynamic params are missing", async () => {
    const session = stubSession();
    const result = await runTool(buildTool("execute_action", session), { at_id: "at_1" });

    expect(session.callTool).not.toHaveBeenCalled();
    expect(JSON.parse(result)).toMatchObject({
      error: {
        code: "unsafe_action_call",
        required_fields: ["_instance_identities", "dynamic_params"],
      },
    });
  });

  it("allows execute_action when the execution target and params are explicit", async () => {
    const session = stubSession();
    const result = await runTool(buildTool("execute_action", session), {
      at_id: "at_1",
      _instance_identities: [{ id: "instance_1" }],
      dynamic_params: {},
    });

    expect(result).toBe("ok");
    expect(session.callTool).toHaveBeenCalledWith(
      "execute_action",
      expect.objectContaining({
        kn_id: "kn-demo",
        at_id: "at_1",
        _instance_identities: [{ id: "instance_1" }],
        dynamic_params: {},
      }),
    );
  });
});

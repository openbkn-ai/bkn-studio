/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BknAgentExecutionError,
  getExecution,
  startExecution,
  type ExecutionEvent,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";

import {
  CYPHER_GENERATION_AGENT_ID,
  extractCypherQuery,
  generateCypher,
  type CypherAgentTexts,
} from "./cypher-ai";

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-execution.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/modules/knowledge-network/services/bkn-agent-execution.service")
      >();
    return { ...actual, startExecution: vi.fn(), getExecution: vi.fn() };
  },
);

const texts: CypherAgentTexts = {
  notReady: "NOT_READY",
  forbidden: "FORBIDDEN",
  busy: "BUSY",
  timeout: "TIMEOUT",
  failed: "FAILED",
  network: "NETWORK",
};

const params = {
  base: "https://platform.example.com",
  tokenProvider: { getToken: () => "token-1", refresh: () => Promise.resolve(null) },
  knId: "supply",
  message: "产品 U00-000151 的 BOM 用到了哪些物料",
};

/** Plays the given events to onEvent and returns their terminal, like the real stream. */
function stream(events: ExecutionEvent[]) {
  vi.mocked(startExecution).mockImplementation((request) => {
    for (const event of events) request.onEvent(event);
    const terminal = events.find((event) => event.type === "terminal");
    return Promise.resolve(terminal?.type === "terminal" ? terminal : null);
  });
}

beforeEach(() => {
  vi.mocked(startExecution).mockReset();
  vi.mocked(getExecution).mockReset();
});

describe("extractCypherQuery", () => {
  it("keeps a complete query, RETURN and LIMIT included, from the last fence", () => {
    expect(
      extractCypherQuery(
        "先试了一条：\n```cypher\nMATCH (p:x) RETURN p\n```\n最终：\n```cypher\nMATCH (p:product)-[:uses]->(m:material)\nWHERE p.material_number = 'U00-000151'\nRETURN p AS source, 'USES' AS relationType, m AS target LIMIT 3;\n```\n按主键定位产品。",
      ),
    ).toBe(
      "MATCH (p:product)-[:uses]->(m:material)\nWHERE p.material_number = 'U00-000151'\nRETURN p AS source, 'USES' AS relationType, m AS target LIMIT 3",
    );
  });

  it("takes an unfenced answer from its first MATCH, and gives up without one", () => {
    expect(extractCypherQuery("查询如下 MATCH (p:product) WHERE p.code = 'a'")).toBe(
      "MATCH (p:product) WHERE p.code = 'a'",
    );
    expect(extractCypherQuery("没有找到对应的对象类。")).toBe("");
  });
});

describe("generateCypher", () => {
  it("runs the built-in Cypher Agent and returns its query with the thread to continue", async () => {
    const tools: string[] = [];
    stream([
      { type: "meta", runId: "run-1", threadId: "thread-1" },
      { type: "tool_started", id: "c1", name: "get_object_types", input: {} },
      { type: "tool_started", id: "c2", name: "run_cypher", input: {} },
      { type: "result", answer: "```cypher\nMATCH (p:product)\n```" },
      { type: "terminal", status: "succeeded" },
    ]);

    const generated = await generateCypher(
      { ...params, onTool: (name) => tools.push(name) },
      texts,
    );

    expect(generated).toEqual({
      query: "MATCH (p:product)",
      answer: "```cypher\nMATCH (p:product)\n```",
      threadId: "thread-1",
    });
    expect(tools).toEqual(["get_object_types", "run_cypher"]);
    const request = vi.mocked(startExecution).mock.calls[0][0];
    expect(request.agentId).toBe(CYPHER_GENERATION_AGENT_ID);
    expect(CYPHER_GENERATION_AGENT_ID).toBe("cypher_generation");
    expect(request.knId).toBe("supply");
    expect(request.threadId).toBeUndefined();
  });

  it("continues the given thread when asked to fix a query", async () => {
    stream([
      { type: "meta", runId: "run-2", threadId: "thread-1" },
      { type: "result", answer: "```cypher\nMATCH (p:product)\n```" },
      { type: "terminal", status: "succeeded" },
    ]);
    await generateCypher({ ...params, threadId: "thread-1" }, texts);
    expect(vi.mocked(startExecution).mock.calls[0][0].threadId).toBe("thread-1");
  });

  it("explains an Agent that is not published yet", async () => {
    vi.mocked(startExecution).mockRejectedValue(
      new BknAgentExecutionError("not found", 404, "BknAgent.NotFound"),
    );
    await expect(generateCypher(params, texts)).rejects.toMatchObject({
      message: "NOT_READY",
      notReady: true,
    });
  });

  it("names a timeout and keeps the code of any other failure", async () => {
    stream([{ type: "terminal", status: "failed", code: "BknAgent.Chat.Timeout" }]);
    await expect(generateCypher(params, texts)).rejects.toThrow("TIMEOUT");
    stream([{ type: "terminal", status: "failed", code: "BknAgent.Chat.ModelRejected" }]);
    await expect(generateCypher(params, texts)).rejects.toThrow(
      "FAILED (BknAgent.Chat.ModelRejected)",
    );
  });

  it("reads the committed result when the stream drops before its terminal", async () => {
    stream([{ type: "meta", runId: "run-3", threadId: "thread-3" }]);
    vi.mocked(getExecution).mockResolvedValue({
      run_id: "run-3",
      thread_id: "thread-3",
      status: "succeeded",
      result: { answer: "MATCH (p:product)" },
    });
    await expect(generateCypher(params, texts)).resolves.toMatchObject({
      query: "MATCH (p:product)",
      threadId: "thread-3",
    });
  });
});

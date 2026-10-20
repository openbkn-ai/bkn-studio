/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  BknAgentExecutionError,
  executionRequestError,
  parseExecutionFrame,
  startExecution,
  terminalError,
  type ExecutionEvent,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";

const tokenProvider = { getToken: () => "token-1", refresh: () => Promise.resolve("token-1") };

function sse(name: string, data: Record<string, unknown>): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Response whose body arrives in the given chunks, to exercise frame reassembly. */
function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseExecutionFrame", () => {
  it("maps tool events by their real call id", () => {
    expect(
      parseExecutionFrame(
        sse("tool_finished", {
          tool_call_id: "call_1",
          name: "run_sql",
          status: "failed",
          output: "boom",
          error: "boom",
          duration_ms: 12,
          run_id: "r",
          sequence: 4,
        }),
      ),
    ).toEqual({
      type: "tool_finished",
      id: "call_1",
      name: "run_sql",
      status: "failed",
      output: "boom",
      error: "boom",
      errorKind: "error",
      durationMs: 12,
    });
  });

  it("reports missing usage as unavailable rather than zero", () => {
    expect(parseExecutionFrame(sse("usage", { available: false, usage: null }))).toEqual({
      type: "usage",
      usage: null,
    });
  });

  it("ignores unknown events and malformed data", () => {
    expect(parseExecutionFrame(sse("structured", { content: {} }))).toBeNull();
    expect(parseExecutionFrame("event: token\ndata: {not json\n\n")).toBeNull();
  });
});

describe("startExecution", () => {
  it("posts the fixed Agent and scope, and reassembles frames split across chunks", async () => {
    const body =
      sse("meta", { run_id: "run-1", thread_id: "thread-1", sequence: 1 }) +
      sse("token", { content: "答", sequence: 2 }) +
      sse("terminal", { status: "succeeded", sequence: 3 });
    fetchMock.mockResolvedValue(
      streamResponse([body.slice(0, 17), body.slice(17, 60), body.slice(60)]),
    );
    const events: ExecutionEvent[] = [];

    const terminal = await startExecution({
      base: "https://platform.example.com",
      tokenProvider,
      knId: "kn-1",
      message: "问题",
      clientRequestId: "req-1",
      threadId: "thread-1",
      onEvent: (event) => events.push(event),
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://platform.example.com/api/bkn-agent/v1/executions");
    expect(JSON.parse(init?.body as string)).toEqual({
      agent_id: "studio_smart_qa",
      message: "问题",
      client_request_id: "req-1",
      thread_id: "thread-1",
      context: { kn_id: "kn-1" },
    });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-1");
    expect(events.map((event) => event.type)).toEqual(["meta", "token", "terminal"]);
    expect(terminal).toEqual({ type: "terminal", status: "succeeded", code: undefined });
  });

  it("posts another admitted Agent when the caller names it", async () => {
    fetchMock.mockResolvedValue(
      streamResponse([sse("terminal", { status: "succeeded", sequence: 1 })]),
    );

    await startExecution({
      base: "https://platform.example.com",
      tokenProvider,
      agentId: "graph_explorer_cypher",
      knId: "kn-1",
      message: "问题",
      clientRequestId: "req-1",
      onEvent: () => undefined,
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toMatchObject({
      agent_id: "graph_explorer_cypher",
      context: { kn_id: "kn-1" },
    });
  });

  it("returns null when the stream closes without a terminal event", async () => {
    fetchMock.mockResolvedValue(streamResponse([sse("meta", { run_id: "run-1", thread_id: "t" })]));

    await expect(
      startExecution({
        base: "",
        tokenProvider,
        knId: "kn-1",
        message: "问题",
        clientRequestId: "req-1",
        onEvent: () => undefined,
      }),
    ).resolves.toBeNull();
  });

  it("throws the server's localized envelope for a rejected request", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ code: "BknAgent.Thread.Busy", description: "会话正在处理中" }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    const error = await startExecution({
      base: "",
      tokenProvider,
      knId: "kn-1",
      message: "问题",
      clientRequestId: "req-1",
      onEvent: () => undefined,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BknAgentExecutionError);
    expect(error).toMatchObject({
      status: 409,
      code: "BknAgent.Thread.Busy",
      message: "会话正在处理中",
    });
  });
});

describe("error mapping", () => {
  it("gives timeouts a dedicated, retryable message", () => {
    expect(terminalError("BknAgent.Chat.Timeout")).toMatchObject({
      message: i18n.t("knowledgeNetwork.agentChat.execution.errors.timeout"),
      retryable: true,
    });
  });

  it("does not offer retry for a permission failure", () => {
    expect(terminalError("BknAgent.Execution.Forbidden").retryable).toBe(false);
  });

  it("keeps the server message for other rejections", () => {
    expect(
      executionRequestError(
        new BknAgentExecutionError("没有权限", 403, "BknAgent.Execution.Forbidden"),
      ),
    ).toMatchObject({ message: "没有权限", retryable: false });
  });

  it("names the real failure: category plus the upstream's own message", () => {
    const event = parseExecutionFrame(
      sse("terminal", {
        status: "failed",
        run_id: "run-9",
        error: {
          code: "BknAgent.Model.Unavailable",
          detail: "模型服务暂时不可用。",
          upstream: { code: "ModelFactory.Down", message: "模型工厂暂时无法访问数据库。" },
        },
      }),
    );
    expect(event).toMatchObject({ type: "terminal", runId: "run-9" });
    const terminal = event as Extract<ExecutionEvent, { type: "terminal" }>;
    const error = terminalError(terminal.code, terminal);
    expect(error.message).toBe(
      `${i18n.t("knowledgeNetwork.agentChat.execution.errors.modelUnavailable")}：模型工厂暂时无法访问数据库。`,
    );
    expect(error.detail).toContain("upstream: ModelFactory.Down");
    expect(error.detail).toContain("run_id: run-9");
    expect(error.retryable).toBe(true);
  });

  it("does not offer retry when the model rejected the request", () => {
    expect(terminalError("BknAgent.Model.Rejected").retryable).toBe(false);
  });

  it("falls back to the server's own text for codes it does not know", () => {
    expect(terminalError("BknAgent.Something.New", { detail: "服务端说明" }).message).toBe(
      "服务端说明",
    );
  });
});

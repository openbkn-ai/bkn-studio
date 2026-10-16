/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * ChatPane drives BKN Agent executions: it keeps one server thread per network, stops
 * through the cancel API, reports failed terminals, recovers a run whose stream dropped,
 * and keeps history written by the former browser loop readable.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  BknAgentExecutionError,
  type ExecutionEvent,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";

import { ChatPane, type ChatPaneHandle } from "./ChatPane";

type ExecutionModule =
  typeof import("@/modules/knowledge-network/services/bkn-agent-execution.service");

const { startExecution, cancelExecution, getExecution } = vi.hoisted(() => ({
  startExecution: vi.fn<ExecutionModule["startExecution"]>(),
  cancelExecution: vi.fn<ExecutionModule["cancelExecution"]>(),
  getExecution: vi.fn<ExecutionModule["getExecution"]>(),
}));

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-execution.service",
  async (importOriginal) => ({
    ...(await importOriginal<ExecutionModule>()),
    startExecution,
    cancelExecution,
    getExecution,
  }),
);

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const KN = "kn-demo";
const HISTORY_KEY = `bkn-studio:agentchat:${KN}`;
const models = [{ modelName: "qwen-test", default: true }] as unknown as LlmModel[];

type Terminal = Extract<ExecutionEvent, { type: "terminal" }>;
const meta = (runId: string, threadId: string): ExecutionEvent => ({
  type: "meta",
  runId,
  threadId,
});
const succeeded: Terminal = { type: "terminal", status: "succeeded" };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Streams after a tick, like the network, so the pane renders its busy state first. */
function streams(events: ExecutionEvent[], terminal: Terminal | null = succeeded) {
  startExecution.mockImplementationOnce(async ({ onEvent }) => {
    await tick();
    for (const event of events) onEvent(event);
    if (terminal) onEvent(terminal);
    return terminal;
  });
}

function renderPane() {
  const ref = createRef<ChatPaneHandle>();
  render(
    <ChatPane
      ref={ref}
      env={{ base: "https://platform.example.com", token: "token-1", knId: KN }}
      tokenProvider={{ getToken: () => "token-1", refresh: () => Promise.resolve("token-1") }}
      models={models}
      modelsLoaded
      knSummary={null}
      suggestions={[]}
      pageScrollRef={createRef<HTMLDivElement>()}
    />,
  );
  return ref;
}

/**
 * Sends, then lets the turn settle in a separate act so the busy state commits before the
 * turn ends; the pane persists history on that busy-to-idle transition.
 */
async function send(ref: ReturnType<typeof renderPane>, text: string) {
  act(() => ref.current?.send(text));
  await act(async () => {
    for (let i = 0; i < 5; i++) await tick();
  });
}

function saved(): { threadId?: string; messages?: unknown[] } {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}") as {
    threadId?: string;
    messages?: unknown[];
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  localStorage.clear();
  vi.resetAllMocks();
});

afterEach(cleanup);

describe("ChatPane BKN Agent execution", () => {
  it("submits the network scope, then continues in the thread the server issued", async () => {
    streams([meta("run-1", "thread-1"), { type: "token", content: "第一轮答复" }]);
    streams([meta("run-2", "thread-1"), { type: "token", content: "第二轮答复" }]);
    const ref = renderPane();

    await send(ref, "第一问");
    expect(startExecution.mock.calls[0][0]).toMatchObject({
      knId: KN,
      message: "第一问",
      threadId: undefined,
    });
    expect(screen.getByText("第一轮答复")).toBeTruthy();
    expect(saved().threadId).toBe("thread-1");

    await send(ref, "第二问");
    expect(startExecution.mock.calls[1][0].threadId).toBe("thread-1");
    // Each send is a new request, so it needs its own idempotency key.
    expect(startExecution.mock.calls[1][0].clientRequestId).not.toBe(
      startExecution.mock.calls[0][0].clientRequestId,
    );
  });

  it("restores the thread after reload and drops it on clear", async () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ messages: [], threadId: "thread-9" }));
    streams([meta("run-1", "thread-9")]);
    streams([meta("run-2", "thread-10")]);
    const ref = renderPane();

    await send(ref, "继续");
    expect(startExecution.mock.calls[0][0].threadId).toBe("thread-9");

    act(() => ref.current?.clear());
    await send(ref, "重新开始");
    expect(startExecution.mock.calls[1][0].threadId).toBeUndefined();
  });

  it("stop cancels the run on the server and marks the turn stopped", async () => {
    let signal: AbortSignal | undefined;
    startExecution.mockImplementationOnce(
      ({ onEvent, signal: s }) =>
        new Promise((_, reject) => {
          signal = s;
          onEvent(meta("run-1", "thread-1"));
          s?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    cancelExecution.mockResolvedValue({
      run_id: "run-1",
      thread_id: "thread-1",
      status: "running",
    });
    const ref = renderPane();

    await send(ref, "慢问题");
    await act(async () => {
      ref.current?.stop();
      await tick();
    });

    expect(cancelExecution).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
    expect(signal?.aborted).toBe(true);
    expect(saved().messages?.at(-1)).toMatchObject({ role: "assistant", stopped: true });
  });

  it("shows a failed terminal as a retryable error", async () => {
    streams([meta("run-1", "thread-1")], {
      type: "terminal",
      status: "failed",
      code: "BknAgent.Chat.Timeout",
    });
    const ref = renderPane();

    await send(ref, "问题");
    expect(
      screen.getByText(i18n.t("knowledgeNetwork.agentChat.execution.errors.timeout")),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t("knowledgeNetwork.agentChat.chatPane.error.retry")),
    ).toBeTruthy();
  });

  it("reads the committed result when the stream ends without a terminal", async () => {
    streams([meta("run-1", "thread-1")], null);
    getExecution.mockResolvedValue({
      run_id: "run-1",
      thread_id: "thread-1",
      status: "succeeded",
      result: { answer: "已提交的答复" },
    });
    const ref = renderPane();

    await send(ref, "问题");
    expect(getExecution).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
    expect(screen.getByText("已提交的答复")).toBeTruthy();
  });

  it("starts a new thread when the server no longer knows the saved one", async () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ messages: [], threadId: "gone" }));
    startExecution.mockRejectedValueOnce(
      new BknAgentExecutionError("thread 不存在", 404, "BknAgent.NotFound"),
    );
    streams([meta("run-2", "thread-new"), { type: "token", content: "新线程答复" }]);
    const ref = renderPane();

    await send(ref, "问题");
    expect(startExecution.mock.calls.map(([params]) => params.threadId)).toEqual([
      "gone",
      undefined,
    ]);
    expect(screen.getByText("新线程答复")).toBeTruthy();
    expect(saved().threadId).toBe("thread-new");
  });

  it("explains an unpublished Agent instead of a generic not-found", async () => {
    startExecution.mockRejectedValueOnce(
      new BknAgentExecutionError("Agent 不存在", 404, "BknAgent.NotFound"),
    );
    const ref = renderPane();

    await send(ref, "问题");
    expect(
      screen.getByText(i18n.t("knowledgeNetwork.agentChat.execution.errors.agentNotReady")),
    ).toBeTruthy();
  });

  it("keeps history from the former browser loop readable", () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        messages: [
          { role: "user", content: "旧问题" },
          { role: "assistant", content: "旧答复", reasoning: "旧思考" },
        ],
        model: "qwen-test",
        systemPrompt: "旧提示词",
      }),
    );
    renderPane();

    expect(screen.getByText("旧问题")).toBeTruthy();
    expect(screen.getByText("旧答复")).toBeTruthy();
  });

  it("closes a tool call that never finished when the turn ends", async () => {
    streams(
      [meta("run-1", "thread-1"), { type: "tool_started", id: "c1", name: "run_sql", input: {} }],
      { type: "terminal", status: "failed", code: "BknAgent.Execution.Failed" },
    );
    const ref = renderPane();

    await send(ref, "问题");
    const assistant = saved().messages?.at(-1) as {
      toolCalls: { status: string; error?: string; latencyMs?: number }[];
    };
    expect(assistant.toolCalls[0]).toMatchObject({
      status: "error",
      error: i18n.t("knowledgeNetwork.agentChat.chatPane.toolCall.interrupted"),
    });
    expect(typeof assistant.toolCalls[0].latencyMs).toBe("number");
  });
});

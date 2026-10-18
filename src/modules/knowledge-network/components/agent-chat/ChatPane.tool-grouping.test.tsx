/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Transcript segmentation. A turn runs several steps, so tool calls and text
 * interleave; the panel must keep that order, fold each run of consecutive calls into
 * one closed group, and start a new group after text is emitted.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { ExecutionEvent } from "@/modules/knowledge-network/services/bkn-agent-execution.service";

import { ChatPane, type ChatPaneHandle } from "./ChatPane";

type ExecutionModule =
  typeof import("@/modules/knowledge-network/services/bkn-agent-execution.service");

const { startExecution } = vi.hoisted(() => ({
  startExecution: vi.fn<ExecutionModule["startExecution"]>(),
}));

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-execution.service",
  async (importOriginal) => ({
    ...(await importOriginal<ExecutionModule>()),
    startExecution,
  }),
);

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const call = (id: string, name: string, input: unknown = {}): ExecutionEvent => ({
  type: "tool_started",
  id,
  name,
  input,
});
const done = (id: string, name: string): ExecutionEvent => ({
  type: "tool_finished",
  id,
  name,
  status: "succeeded",
  output: "ok",
  durationMs: 5,
});
const token = (content: string): ExecutionEvent => ({ type: "token", content });
const succeeded: Extract<ExecutionEvent, { type: "terminal" }> = {
  type: "terminal",
  status: "succeeded",
};

/** Replays events synchronously, then reports success. */
function streams(events: ExecutionEvent[]) {
  startExecution.mockImplementation(({ onEvent }) => {
    for (const event of events) onEvent(event);
    onEvent(succeeded);
    return Promise.resolve(succeeded);
  });
}

function renderPane() {
  const ref = createRef<ChatPaneHandle>();
  render(
    <ChatPane
      ref={ref}
      env={{ base: "https://platform.example.com", token: "token-1", knId: "kn-demo" }}
      tokenProvider={{ getToken: () => "token-1", refresh: () => Promise.resolve("token-1") }}
      knSummary={null}
      suggestions={[]}
      pageScrollRef={createRef<HTMLDivElement>()}
    />,
  );
  return ref;
}

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("ChatPane 工具调用折叠", () => {
  it("连续调用折叠成一组，出文字后重新开一组", async () => {
    streams([
      call("c1", "search_schema"),
      done("c1", "search_schema"),
      call("c2", "run_sql", { sql: "SELECT 1" }),
      done("c2", "run_sql"),
      token("中间结论"),
      call("c3", "run_sql", { sql: "SELECT 2" }),
      done("c3", "run_sql"),
      call("c4", "run_sql", { sql: "SELECT 3" }),
      done("c4", "run_sql"),
      token("最终答复"),
    ]);

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    const groups = screen.getAllByText("已调用工具 2 次");
    expect(groups).toHaveLength(2);

    // Groups stay closed, so no request or response body is rendered yet.
    expect(document.querySelectorAll("pre")).toHaveLength(0);

    // Order matters: the first run, then the text it produced, then the next run.
    const text = document.body.textContent ?? "";
    expect(text.indexOf("中间结论")).toBeGreaterThan(text.indexOf("已调用工具 2 次"));
    expect(text.lastIndexOf("已调用工具 2 次")).toBeGreaterThan(text.indexOf("中间结论"));
    expect(text.indexOf("最终答复")).toBeGreaterThan(text.lastIndexOf("已调用工具 2 次"));

    // Expanding one group reveals only that run's cards.
    fireEvent.click(groups[0]);
    expect(screen.getByText("search_schema")).toBeTruthy();
    expect(screen.getAllByText("run_sql")).toHaveLength(1);
  });

  it("第二次调用到达时，已展开的卡片不被收回去", async () => {
    let emit!: (event: ExecutionEvent) => void;
    let finishRun!: () => void;
    startExecution.mockImplementation(
      ({ onEvent }) =>
        new Promise((resolve) => {
          emit = onEvent;
          finishRun = () => resolve(succeeded);
        }),
    );

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    // A run starts as a bare card; the user expands it to read the request.
    act(() => {
      emit(call("c1", "run_sql", { sql: "SELECT 1" }));
    });
    fireEvent.click(screen.getByText("run_sql"));
    expect(document.querySelectorAll("pre").length).toBeGreaterThan(0);

    // The second call swaps the bare card for the group. Expansion must survive that swap,
    // otherwise the card the user is reading closes mid-stream.
    act(() => {
      emit(call("c2", "search_schema"));
    });
    expect(screen.getByText("已调用工具 2 次")).toBeTruthy();
    expect(
      [...document.querySelectorAll("pre")].some((node) =>
        (node.textContent ?? "").includes("SELECT 1"),
      ),
    ).toBe(true);

    await act(async () => {
      finishRun();
      await Promise.resolve();
    });
  });

  it("单次调用不额外套一层分组", async () => {
    streams([call("c1", "run_sql", { sql: "SELECT 1" }), done("c1", "run_sql"), token("答复")]);

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(screen.queryByText(/已调用工具/)).toBeNull();
    expect(screen.getByText("run_sql")).toBeTruthy();
  });

  it("展开卡片时显示 MCP 文本内容，而不是转义后的 JSON", async () => {
    streams([
      call("c1", "get_kn_detail"),
      {
        type: "tool_finished",
        id: "c1",
        name: "get_kn_detail",
        status: "succeeded",
        output: [{ type: "text", text: "object_types:\n  - 产品" }],
        durationMs: 5,
      },
    ]);

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText("get_kn_detail"));
    const response = [...document.querySelectorAll("pre")].map((node) => node.textContent);
    expect(response).toContain("object_types:\n  - 产品");
  });

  it("a retried failure in a successful turn does not mark the group failed", async () => {
    streams([
      call("c1", "run_cypher"),
      {
        type: "tool_finished",
        id: "c1",
        name: "run_cypher",
        status: "failed",
        output: "WITH is not supported",
        errorKind: "error",
        durationMs: 5,
      },
      call("c2", "run_cypher"),
      done("c2", "run_cypher"),
      token("答复"),
    ]);

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(screen.getByText("已调用工具 2 次")).toBeTruthy();
    // Visible without expanding, but not as a failed group.
    expect(screen.getByText(/其中 1 次失败/)).toBeTruthy();
    expect(screen.queryByText(/个失败/)).toBeNull();
  });

  it("a call that did not go through marks the group failed", async () => {
    startExecution.mockImplementation(({ onEvent }) => {
      onEvent(call("c1", "run_sql"));
      onEvent(done("c1", "run_sql"));
      onEvent(call("c2", "run_sql"));
      onEvent({
        type: "tool_finished",
        id: "c2",
        name: "run_sql",
        status: "failed",
        output: "boom",
        errorKind: "unavailable",
        durationMs: 5,
      });
      const terminal = {
        type: "terminal" as const,
        status: "failed" as const,
        code: "BknAgent.Chat.Failed",
      };
      onEvent(terminal);
      return Promise.resolve(terminal);
    });

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(screen.getByText("1 个失败")).toBeTruthy();
  });

  it("history saved before error_kind keeps its failures red", async () => {
    const legacy = (id: string) => ({
      id,
      name: "run_sql",
      args: {},
      status: "error",
      error: "boom",
      startedAt: 0,
      latencyMs: 5,
    });
    localStorage.setItem(
      "bkn-studio:agentchat:kn-demo",
      JSON.stringify({
        messages: [
          { role: "user", content: "问一句" },
          { role: "assistant", content: "答复", toolCalls: [legacy("c1"), legacy("c2")] },
        ],
        stats: { tokens: 0, ms: 0 },
      }),
    );

    renderPane();

    expect(await screen.findByText("2 个失败")).toBeTruthy();
    expect(screen.queryByText(/其中 \d+ 次失败/)).toBeNull();
  });
});

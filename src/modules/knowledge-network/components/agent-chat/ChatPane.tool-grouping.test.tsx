/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Transcript segmentation. A turn runs up to maxSteps steps, so tool calls and text
 * interleave; the panel must keep that order, fold each run of consecutive calls into
 * one closed group, and start a new group after text is emitted.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { BknLifecycle, BknTurn } from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";

import { ChatPane, DEFAULT_PROMPT, KN_EVIDENCE_HINT, type ChatPaneHandle, type PaneProfile } from "./ChatPane";

type AgentChatModule = typeof import("@/modules/knowledge-network/services/agent-chat.service");
type LifecycleModule = typeof import("@/modules/knowledge-network/services/bkn-lifecycle.service");

const { buildAgentTools, runAgentChat, createBknLifecycle } = vi.hoisted(() => ({
  buildAgentTools: vi.fn<AgentChatModule["buildAgentTools"]>(),
  runAgentChat: vi.fn<AgentChatModule["runAgentChat"]>(),
  createBknLifecycle: vi.fn<LifecycleModule["createBknLifecycle"]>(),
}));

vi.mock("@/modules/knowledge-network/services/agent-chat.service", async (importOriginal) => ({
  ...(await importOriginal<AgentChatModule>()),
  buildAgentTools,
  runAgentChat,
}));

vi.mock("@/modules/knowledge-network/services/bkn-lifecycle.service", async (importOriginal) => ({
  ...(await importOriginal<LifecycleModule>()),
  createBknLifecycle,
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const profile: PaneProfile = {
  paneKey: "solo",
  defaultPrompt: DEFAULT_PROMPT,
  injectKnContext: false,
  defaultToolNames: null,
  evidenceHint: KN_EVIDENCE_HINT,
};

const toolDefs: McpToolDef[] = [{ name: "run_sql" }, { name: "search_schema" }];
const models = [{ modelName: "qwen-test", default: true }] as unknown as LlmModel[];

function stubLifecycle() {
  const turn: BknTurn = {
    conversationId: "conv_1",
    interactionId: "int_1",
    nextContext: () => ({ conversation_id: "conv_1", interaction_id: "int_1" }),
    complete: vi.fn<BknTurn["complete"]>().mockResolvedValue(undefined),
    fail: vi.fn<BknTurn["fail"]>().mockResolvedValue(undefined),
    cancel: vi.fn<BknTurn["cancel"]>().mockResolvedValue(undefined),
    finish: vi.fn<BknTurn["finish"]>().mockResolvedValue(undefined),
  };
  createBknLifecycle.mockReturnValue({
    session: { callTool: vi.fn() },
    conversationId: () => "conv_1",
    unsupported: () => false,
    beginTurn: vi.fn<BknLifecycle["beginTurn"]>().mockResolvedValue(turn),
    reset: vi.fn<BknLifecycle["reset"]>(),
  });
}

function renderPane() {
  const ref = createRef<ChatPaneHandle>();
  render(
    <ChatPane
      ref={ref}
      env={{ base: "https://platform.example.com", token: "token-1", knId: "kn-demo" }}
      tokenProvider={{ getToken: () => "token-1", refresh: () => Promise.resolve("token-1") }}
      profile={profile}
      models={models}
      modelsLoaded
      knContext=""
      knSummary={null}
      suggestions={[]}
      getTools={() => Promise.resolve(toolDefs)}
      toolDefs={toolDefs}
      pageScrollRef={createRef<HTMLDivElement>()}
    />,
  );
  return ref;
}

/** Collapsed headers in document order, reduced to what identifies each block. */
function headerLabels() {
  return [...document.querySelectorAll("button")]
    .map((node) => node.textContent ?? "")
    .filter((text) => /思考过程|思考中|已调用工具|search_schema|run_sql/.test(text))
    .map((text) => {
      if (text.includes("思考")) return "思考过程";
      const match = /已调用工具 \d+ 次|search_schema|run_sql/.exec(text);
      return match?.[0] ?? text;
    });
}

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  localStorage.clear();
  vi.clearAllMocks();
  buildAgentTools.mockReturnValue({});
});

afterEach(cleanup);

describe("ChatPane 工具调用折叠", () => {
  it("连续调用折叠成一组，出文字后重新开一组", async () => {
    stubLifecycle();
    runAgentChat.mockImplementation(({ onChunk }) => {
      onChunk({ type: "tool-call", id: "c1", name: "search_schema", args: {} });
      onChunk({ type: "tool-result", id: "c1", result: "ok" });
      onChunk({ type: "tool-call", id: "c2", name: "run_sql", args: { sql: "SELECT 1" } });
      onChunk({ type: "tool-result", id: "c2", result: "ok" });
      onChunk({ type: "text", delta: "中间结论" });
      onChunk({ type: "tool-call", id: "c3", name: "run_sql", args: { sql: "SELECT 2" } });
      onChunk({ type: "tool-result", id: "c3", result: "ok" });
      onChunk({ type: "tool-call", id: "c4", name: "run_sql", args: { sql: "SELECT 3" } });
      onChunk({ type: "tool-result", id: "c4", result: "ok" });
      onChunk({ type: "text", delta: "最终答复" });
      onChunk({ type: "finish" });
      return Promise.resolve();
    });

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

  it("调用之间的思考不打断分组，思考过程仍是顶部一块", async () => {
    stubLifecycle();
    runAgentChat.mockImplementation(({ onChunk }) => {
      onChunk({ type: "reasoning", delta: "先看 schema" });
      onChunk({ type: "tool-call", id: "c1", name: "search_schema", args: {} });
      onChunk({ type: "tool-result", id: "c1", result: "ok" });
      onChunk({ type: "reasoning", delta: "再跑 SQL" });
      onChunk({ type: "tool-call", id: "c2", name: "run_sql", args: { sql: "SELECT 1" } });
      onChunk({ type: "tool-result", id: "c2", result: "ok" });
      onChunk({ type: "tool-call", id: "c3", name: "run_sql", args: { sql: "SELECT 2" } });
      onChunk({ type: "tool-result", id: "c3", result: "ok" });
      onChunk({ type: "text", delta: "答复" });
      onChunk({ type: "finish" });
      return Promise.resolve();
    });

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    // Reasoning between calls neither shatters the run nor spawns a second trace box;
    // per-step reasoning blocks made the trace jump around the transcript.
    const group = screen.getByText("已调用工具 3 次");
    expect(screen.getAllByText("思考过程")).toHaveLength(1);
    expect(headerLabels()).toEqual(["思考过程", "已调用工具 3 次"]);

    fireEvent.click(group);
    expect(screen.getAllByText("思考过程")).toHaveLength(1);
    expect(headerLabels()).toEqual(["思考过程", "已调用工具 3 次", "search_schema", "run_sql", "run_sql"]);
  });

  it("第二次调用到达时，已展开的卡片不被收回去", async () => {
    stubLifecycle();
    let emit!: (chunk: Parameters<Parameters<AgentChatModule["runAgentChat"]>[0]["onChunk"]>[0]) => void;
    let finishRun!: () => void;
    runAgentChat.mockImplementation(
      ({ onChunk }) =>
        new Promise<void>((resolve) => {
          emit = onChunk;
          finishRun = resolve;
        }),
    );

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    // A run starts as a bare card; the user expands it to read the request.
    act(() => {
      emit({ type: "tool-call", id: "c1", name: "run_sql", args: { sql: "SELECT 1" } });
    });
    fireEvent.click(screen.getByText("run_sql"));
    expect(document.querySelectorAll("pre").length).toBeGreaterThan(0);

    // The second call swaps the bare card for the group. Expansion must survive that swap,
    // otherwise the card the user is reading closes mid-stream.
    act(() => {
      emit({ type: "tool-call", id: "c2", name: "search_schema", args: {} });
    });
    expect(screen.getByText("已调用工具 2 次")).toBeTruthy();
    expect([...document.querySelectorAll("pre")].some((node) => (node.textContent ?? "").includes("SELECT 1"))).toBe(true);

    await act(async () => {
      finishRun();
      await Promise.resolve();
    });
  });

  it("单次调用不额外套一层分组", async () => {
    stubLifecycle();
    runAgentChat.mockImplementation(({ onChunk }) => {
      onChunk({ type: "tool-call", id: "c1", name: "run_sql", args: { sql: "SELECT 1" } });
      onChunk({ type: "tool-result", id: "c1", result: "ok" });
      onChunk({ type: "text", delta: "答复" });
      onChunk({ type: "finish" });
      return Promise.resolve();
    });

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(screen.queryByText(/已调用工具/)).toBeNull();
    expect(screen.getByText("run_sql")).toBeTruthy();
  });
});

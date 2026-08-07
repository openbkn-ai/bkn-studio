/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 面板与受管生命周期的接线。服务层各自有单测，但「一轮问答对应一轮交互」这件事
 * 只存在于 ChatPane.send 的 try/catch/finally 里 —— 漏掉终结、outcome 判错、
 * 清空对话忘了换会话，都不会被服务层的测试发现。
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/app/locales/i18n";
import type { BknLifecycle, BknTurn } from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";

import { ANSWER_OPEN } from "@/modules/knowledge-network/services/agent-chat.service";

import { BASE_EVIDENCE_HINT, ChatPane, DEFAULT_PROMPT, KN_EVIDENCE_HINT, type ChatPaneHandle, type PaneProfile } from "./ChatPane";

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

const baseProfile: PaneProfile = {
  paneKey: "base",
  defaultPrompt: DEFAULT_PROMPT,
  injectKnContext: false,
  defaultToolNames: ["list_resources", "describe_resource", "run_sql"],
  evidenceHint: BASE_EVIDENCE_HINT,
};

const toolDefs: McpToolDef[] = [{ name: "bkn_start_interaction" }, { name: "run_sql" }, { name: "bkn_finish_interaction" }];
const models = [{ modelName: "qwen-test", default: true }] as unknown as LlmModel[];

function stubLifecycle() {
  const finish = vi.fn<BknTurn["finish"]>().mockResolvedValue(undefined);
  const turn: BknTurn = {
    conversationId: "conv_1",
    interactionId: "int_1",
    nextContext: () => ({
      conversation_id: "conv_1",
      interaction_id: "int_1",
    }),
    complete: vi.fn<BknTurn["complete"]>().mockResolvedValue(undefined),
    fail: vi.fn<BknTurn["fail"]>().mockResolvedValue(undefined),
    cancel: vi.fn<BknTurn["cancel"]>().mockResolvedValue(undefined),
    finish,
  };
  const beginTurn = vi.fn<BknLifecycle["beginTurn"]>().mockResolvedValue(turn);
  const reset = vi.fn<BknLifecycle["reset"]>();
  const session = { callTool: vi.fn() };
  const lifecycle: BknLifecycle = {
    session,
    conversationId: () => "conv_1",
    unsupported: () => false,
    beginTurn,
    reset,
  };
  createBknLifecycle.mockReturnValue(lifecycle);
  return { beginTurn, finish, reset, session };
}

/** 本轮传给工具循环的选项（buildAgentTools 的第 6 个入参）。 */
function toolOptions() {
  return buildAgentTools.mock.calls[0][5];
}

function renderPane(options: { profile?: PaneProfile; toolDefs?: McpToolDef[] } = {}) {
  const ref = createRef<ChatPaneHandle>();
  const paneProfile = options.profile ?? profile;
  const paneToolDefs = options.toolDefs ?? toolDefs;
  render(
    <ChatPane
      ref={ref}
      env={{ base: "https://platform.example.com", token: "token-1", knId: "kn-demo" }}
      tokenProvider={{ getToken: () => "token-1", refresh: () => Promise.resolve("token-1") }}
      profile={paneProfile}
      models={models}
      modelsLoaded
      knContext=""
      knSummary={null}
      suggestions={[]}
      getTools={() => Promise.resolve(paneToolDefs)}
      toolDefs={paneToolDefs}
      pageScrollRef={createRef<HTMLDivElement>()}
    />,
  );
  return ref;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  buildAgentTools.mockReturnValue({});
});

afterEach(cleanup);

describe("ChatPane 受管生命周期接线", () => {
  it("一轮问答开一轮交互，把它交给工具循环，并以答复正文终结", async () => {
    const { beginTurn, finish, session } = stubLifecycle();
    runAgentChat.mockImplementation(({ onChunk }) => {
      onChunk({ type: "text", delta: "答复" });
      onChunk({ type: "text", delta: "正文" });
      onChunk({ type: "finish" });
      return Promise.resolve();
    });

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(beginTurn).toHaveBeenCalledWith("问一句");
    // 工具循环必须拿到本轮交互和生命周期的会话，否则每次工具调用都会被挡在
    // conversation_required。
    expect(toolOptions()).toMatchObject({
      session,
      turn: expect.objectContaining({ interactionId: "int_1" }) as unknown,
    });
    expect(buildAgentTools.mock.calls[0][0]).toEqual([{ name: "run_sql" }]);
    expect(finish).toHaveBeenCalledWith("completed", "答复正文");
  });

  it("基础数据面板只向模型暴露基础数据工具", async () => {
    stubLifecycle();
    runAgentChat.mockImplementation(({ onChunk }) => {
      onChunk({ type: "finish" });
      return Promise.resolve();
    });

    const ref = renderPane({
      profile: baseProfile,
      toolDefs: [
        { name: "bkn_start_interaction" },
        { name: "list_resources" },
        { name: "describe_resource" },
        { name: "run_sql" },
        { name: "search_schema" },
        { name: "get_kn_detail" },
      ],
    });
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(buildAgentTools.mock.calls[0][0]).toEqual([
      { name: "list_resources" },
      { name: "describe_resource" },
      { name: "run_sql" },
    ]);
  });

  it("执行失败时以 failed 终结", async () => {
    const { finish } = stubLifecycle();
    runAgentChat.mockRejectedValue(new Error("模型不可用"));

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(finish).toHaveBeenCalledWith("failed", "");
  });

  it("beginTurn 失败时不继续无上下文调用工具循环", async () => {
    const { beginTurn, finish } = stubLifecycle();
    beginTurn.mockRejectedValue(new Error("lifecycle failed"));

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(buildAgentTools).not.toHaveBeenCalled();
    expect(runAgentChat).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it("用户中途停止时以 canceled 终结", async () => {
    const { finish } = stubLifecycle();
    // runAgentChat 在 abort 时是正常返回而非抛错，所以 outcome 只能靠 signal 判断。
    runAgentChat.mockImplementation(({ signal, onChunk }) => {
      onChunk({ type: "text", delta: "半句" });
      return new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve()));
    });

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });
    await act(async () => {
      ref.current?.stop();
      await Promise.resolve();
    });

    expect(finish).toHaveBeenCalledWith("canceled", "半句");
  });

  it("后端未启用受管生命周期时照常问答，不终结不存在的交互", async () => {
    const { beginTurn, finish } = stubLifecycle();
    beginTurn.mockResolvedValue(null);
    runAgentChat.mockImplementation(({ onChunk }) => {
      onChunk({ type: "text", delta: "答复" });
      return Promise.resolve();
    });

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(runAgentChat).toHaveBeenCalled();
    expect(toolOptions()).toMatchObject({ turn: null });
    expect(finish).not.toHaveBeenCalled();
  });

  it("流里报错时以 failed 终结，不能记成 completed", async () => {
    // 流里的 error 是 runAgentChat 内部捕获后正常返回的，不会抛到 catch。
    // 漏了这一笔，面板上是红条而交给 Core 的是 completed —— 失败会被系统性少记。
    const { finish } = stubLifecycle();
    runAgentChat.mockImplementation(({ onChunk }) => {
      onChunk({ type: "error", error: "模型服务繁忙，请稍后重试（50508）", retryable: true });
      onChunk({ type: "finish" });
      return Promise.resolve();
    });

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("问一句");
      await Promise.resolve();
    });

    expect(finish).toHaveBeenCalledWith("failed", "");
  });

  it("清空对话换掉受管会话", async () => {
    const { reset } = stubLifecycle();

    const ref = renderPane();
    await act(async () => {
      ref.current?.clear();
      await Promise.resolve();
    });

    // 这是 conversation id 唯一的更换点；漏了会让「清空」后的新对话仍挂在旧会话上。
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("失败轮的重试", () => {
  it("原地重跑那一轮，不追加重复的提问，也不把空 assistant 回灌历史", async () => {
    stubLifecycle();
    runAgentChat.mockImplementation(({ onChunk }) => {
      onChunk({ type: "error", error: "模型服务繁忙，请稍后重试（50508）", retryable: true });
      onChunk({ type: "finish" });
      return Promise.resolve();
    });

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("在途项目有几个?");
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试本轮" }));
      await Promise.resolve();
    });

    expect(runAgentChat).toHaveBeenCalledTimes(2);
    // 重跑的历史里只该有这一条提问：追加式重试会变成两条 user，
    // 失败轮那条 content: "" 的 assistant 也会一并喂回严格 router。
    expect(runAgentChat.mock.calls[1][0].history).toEqual([{ role: "user", content: "在途项目有几个?" }]);
    expect(screen.getAllByText("在途项目有几个?")).toHaveLength(1);
  });
});

/**
 * 输出契约必须由 composedSystem 自动拼接。提示词是持久化状态：每轮结束回写
 * localStorage，载入时 `saved.systemPrompt ?? profile.defaultPrompt` 优先用存量值。
 * 契约一旦写进默认提示词，就只对「从没聊过」的人生效 —— 而会撞上推敲糊进正文
 * 这个 bug 的恰恰是老用户，他们也不会知道要去设置里点一次「恢复默认」。
 */
describe("输出契约的下发方式", () => {
  it("存量用户存的是改版前的旧提示词，照样拿得到契约", async () => {
    stubLifecycle();
    // 模拟老会话：localStorage 里是不含任何契约的旧提示词。
    localStorage.setItem(
      "bkn-studio:agentchat:kn-demo",
      JSON.stringify({ messages: [], model: "qwen-test", systemPrompt: "旧的自定义提示词，没有任何契约" }),
    );
    runAgentChat.mockResolvedValue(undefined);

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("在途项目有几个?");
      await Promise.resolve();
    });

    const system = runAgentChat.mock.calls[0][0].system;
    expect(system).toContain("旧的自定义提示词，没有任何契约");
    expect(system).toContain(ANSWER_OPEN);
  });

  it("契约里的依据写法跟着面板画像走", async () => {
    stubLifecycle();
    runAgentChat.mockResolvedValue(undefined);

    const ref = renderPane();
    await act(async () => {
      ref.current?.send("在途项目有几个?");
      await Promise.resolve();
    });

    expect(runAgentChat.mock.calls[0][0].system).toContain(KN_EVIDENCE_HINT);
  });
});

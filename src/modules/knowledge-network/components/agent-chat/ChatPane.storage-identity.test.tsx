/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 存储身份隔离：两种工具面的提示词、参数与历史不能互相沿用。
 *
 * 隔离之前 PTC 侧就跑在 kn 栏（单栏则跑在 solo）上，两种模式共用一个 localStorage
 * 键，那批数据至今还在。读回来的表现就是「两个模式的问答配置混在一起」：常规栏拿到
 * PTC 的提示词，模型被要求去写 run_code，而它手上只有 MCP 工具，且不会报错。
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { App } from "antd";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";

import { ChatPane, DEFAULT_PROMPT, KN_EVIDENCE_HINT, type ChatPaneHandle, type PaneProfile } from "./ChatPane";

type LifecycleModule = typeof import("@/modules/knowledge-network/services/bkn-lifecycle.service");

const { createBknLifecycle } = vi.hoisted(() => ({
  createBknLifecycle: vi.fn<LifecycleModule["createBknLifecycle"]>(),
}));

vi.mock("@/modules/knowledge-network/services/bkn-lifecycle.service", async (importOriginal) => ({
  ...(await importOriginal<LifecycleModule>()),
  createBknLifecycle,
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const PTC_PROMPT = "你只有一个工具 run_code：写一段 Python 交给沙箱执行。";
const KN_ID = "kn-demo";

/** 常规工具面的对比侧。foreignPrompts 即隔离前可能落在同一键上的对面提示词。 */
const knProfile: PaneProfile = {
  paneKey: "kn",
  title: "业务知识网络",
  defaultPrompt: DEFAULT_PROMPT,
  foreignPrompts: [PTC_PROMPT],
  injectKnContext: false,
  defaultToolNames: null,
  evidenceHint: KN_EVIDENCE_HINT,
};

/** PTC 侧：独立 paneKey，工具面为 ptc。 */
const ptcProfile: PaneProfile = {
  ...knProfile,
  paneKey: "ptc",
  title: "PTC · 代码模式",
  toolMode: "ptc",
  defaultPrompt: PTC_PROMPT,
  foreignPrompts: [DEFAULT_PROMPT],
};

const toolDefs: McpToolDef[] = [{ name: "run_sql" }, { name: "search_schema" }];
const models = [{ modelName: "qwen-test", default: true }] as unknown as LlmModel[];

function msgsKey(paneKey: string): string {
  return `bkn-studio:agentchat:${KN_ID}:cmp-${paneKey}`;
}

function renderPane(profile: PaneProfile) {
  const ref = createRef<ChatPaneHandle>();
  render(
    // antd App 提供 message 上下文；保存设置会弹提示，缺了它 message.success 不存在。
    <App>
      <ChatPane
        ref={ref}
        env={{ base: "https://platform.example.com", token: "token-1", knId: KN_ID }}
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
      />
    </App>,
  );
  return ref;
}

/** 设置面板里的系统提示词编辑框，即该栏当前生效的提示词。 */
async function promptInSettings(ref: React.RefObject<ChatPaneHandle | null>): Promise<string> {
  await act(async () => {
    ref.current?.openSettings();
    await Promise.resolve();
  });
  const textarea = document.querySelector("textarea[placeholder]");
  return (textarea as HTMLTextAreaElement | null)?.value ?? "";
}

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  localStorage.clear();
  vi.clearAllMocks();
  createBknLifecycle.mockReturnValue({
    session: { callTool: vi.fn() },
    conversationId: () => "conv_1",
    unsupported: () => false,
    beginTurn: vi.fn().mockResolvedValue(null),
    reset: vi.fn(),
  });
});

afterEach(cleanup);

describe("ChatPane 存储身份", () => {
  it("老数据里存着对面模式的默认提示词时丢弃，回到本模式默认", async () => {
    // 隔离前 PTC 对比侧写下的形态：键是 cmp-kn，提示词是 PTC 那套，且没有 toolMode 标记。
    localStorage.setItem(
      msgsKey("kn"),
      JSON.stringify({ messages: [{ role: "user", content: "上一轮" }], model: "qwen-test", systemPrompt: PTC_PROMPT }),
    );

    const ref = renderPane(knProfile);

    expect(await promptInSettings(ref)).toBe(DEFAULT_PROMPT);
  });

  it("外来数据的历史也不沿用——两种模式的工具卡片形态不同", () => {
    localStorage.setItem(
      msgsKey("kn"),
      JSON.stringify({ messages: [{ role: "user", content: "上一轮问题" }], model: "qwen-test", systemPrompt: PTC_PROMPT }),
    );

    renderPane(knProfile);

    expect(screen.queryByText("上一轮问题")).toBeNull();
  });

  it("带 toolMode 标记且与本栏不符时丢弃", async () => {
    localStorage.setItem(
      msgsKey("ptc"),
      JSON.stringify({ messages: [], model: "qwen-test", systemPrompt: "手改过的常规提示词", toolMode: "mcp" }),
    );

    const ref = renderPane(ptcProfile);

    expect(await promptInSettings(ref)).toBe(PTC_PROMPT);
  });

  it("标记相符时照常沿用，包括用户手改的提示词", async () => {
    localStorage.setItem(
      msgsKey("kn"),
      JSON.stringify({
        messages: [{ role: "user", content: "上一轮问题" }],
        model: "qwen-test",
        systemPrompt: "我自己改的提示词",
        toolMode: "mcp",
      }),
    );

    const ref = renderPane(knProfile);

    expect(screen.getByText("上一轮问题")).toBeTruthy();
    expect(await promptInSettings(ref)).toBe("我自己改的提示词");
  });

  it("保存时写入 toolMode 标记，后续读取不再靠提示词猜", async () => {
    const ref = renderPane(ptcProfile);

    await act(async () => {
      ref.current?.openSettings();
      await Promise.resolve();
    });
    const saveButton = screen.getByText(i18n.t("knowledgeNetwork.agentChat.chatPane.settings.confirm"));
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    const saved = JSON.parse(localStorage.getItem(msgsKey("ptc")) ?? "{}") as { toolMode?: string };
    expect(saved.toolMode).toBe("ptc");
  });

  it("PTC 栏不给工具白名单——模型只有 run_code，勾什么都不进工具表", async () => {
    const ref = renderPane(ptcProfile);

    await act(async () => {
      ref.current?.openSettings();
      await Promise.resolve();
    });

    expect(screen.queryByText(i18n.t("knowledgeNetwork.agentChat.chatPane.settings.toolScopeTitle"))).toBeNull();
  });

  it("常规栏照常给工具白名单", async () => {
    const ref = renderPane(knProfile);

    await act(async () => {
      ref.current?.openSettings();
      await Promise.resolve();
    });

    expect(screen.getByText(i18n.t("knowledgeNetwork.agentChat.chatPane.settings.toolScopeTitle"))).toBeTruthy();
  });
});

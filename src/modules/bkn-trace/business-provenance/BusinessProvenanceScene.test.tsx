/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BusinessProvenanceScene } from "@/modules/bkn-trace/business-provenance/BusinessProvenanceScene";

const getConversations = vi.hoisted(() => vi.fn());
const getInteractions = vi.hoisted(() => vi.fn());
const getInteraction = vi.hoisted(() => vi.fn());
const getMarkdown = vi.hoisted(() => vi.fn());
const streamAnalysis = vi.hoisted(() => vi.fn());
vi.mock("@/modules/bkn-trace/evidence-chain/CurrentExplanationPanel", () => ({ CurrentExplanationPanel: ({ interactionId }: { interactionId: string }) => <div>saved-evidence:{interactionId}</div> }));

const getAnalysisHistory = vi.hoisted(() => vi.fn());

vi.mock("@/modules/bkn-trace/business-provenance/business-provenance.service", () => ({
  getBusinessProvenanceConversations: getConversations,
  getBusinessProvenanceInteractions: getInteractions,
  getBusinessProvenanceInteraction: getInteraction,
  getBusinessProvenanceMarkdown: getMarkdown,
  streamBusinessProvenanceAnalysis: streamAnalysis,
  getBusinessProvenanceAnalysisHistory: getAnalysisHistory,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  const { bknTraceZhCN } = await import("@/modules/bkn-trace/locales/zh-CN");
  const values: unknown = bknTraceZhCN.bknTrace.businessProvenance;
  const translate = (key: string) => {
    const path = key.replace("bknTrace.businessProvenance.", "").split(".");
    const value = path.reduce<unknown>((current, segment) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[segment];
    }, values);
    return typeof value === "string" ? value : key;
  };
  return {
    ...original,
    useTranslation: () => ({ t: translate }),
  };
});

describe("BusinessProvenanceScene", { timeout: 30_000 }, () => {
  // Ant Design mounts dialogs asynchronously; allow slower local rendering.
  configure({ asyncUtilTimeout: 5_000 });
  beforeEach(() => {
    window.history.replaceState({}, "", "/observability/business-provenance");
    getConversations.mockReset();
    getInteractions.mockReset();
    getInteraction.mockReset();
    getMarkdown.mockReset();
    streamAnalysis.mockReset();
    getAnalysisHistory.mockReset();
    getAnalysisHistory.mockResolvedValue([]);
    getMarkdown.mockResolvedValue("# 当前交互轮次知识网络优化分析输入\n\n- Operation：`op-1`");
  });

  it("opens the exact conversation supplied by an associated log", async () => {
    window.history.replaceState({}, "", "/observability/business-provenance?conversation_id=conv-linked");
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-linked", questionPreview: "关联会话", interactionCount: 1 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-linked", questionPreview: "关联轮次" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-linked", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] });

    render(<BusinessProvenanceScene />);

    await waitFor(() => expect(getConversations).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conv-linked" })));
    await waitFor(() => expect(getInteractions).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conv-linked" })));
    expect(await screen.findByText("关联轮次")).not.toBeNull();
  });

  it("accepts the Studio camel-case conversation and interaction links", async () => {
    window.history.replaceState({}, "", "/observability/business-provenance?conversationId=conv-linked&interactionId=int-two");
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-linked", questionPreview: "关联会话", interactionCount: 2 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-one", questionPreview: "问题甲" }, { interactionId: "int-two", questionPreview: "问题乙" }], total: 2 });
    getInteraction.mockImplementation((id: string) => Promise.resolve({ interactionId: id, conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] }));
    render(<BusinessProvenanceScene />);
    await waitFor(() => expect(getConversations).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conv-linked" })));
    await waitFor(() => expect(getInteraction).toHaveBeenCalledWith("int-two"));
    expect(screen.getAllByText("问题乙").length).toBeGreaterThan(0);
  });

  it("keeps only timeline and evidence views, with execution inside evidence", async () => {
    window.history.replaceState({}, "", "/observability/business-provenance?conversation_id=conv-linked");
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-linked", questionPreview: "关联会话", interactionCount: 2 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-one", questionPreview: "问题甲" }, { interactionId: "int-two", questionPreview: "问题乙" }], total: 2 });
    getInteraction.mockResolvedValue({ interactionId: "int-one", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] });
    render(<BusinessProvenanceScene />);
    await waitFor(() => expect(getInteraction).toHaveBeenCalledWith("int-one"));
    expect(await screen.findByRole("tab", { name: "时间链" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "证据链" })).toBeTruthy();
    expect(screen.queryByText("执行链路")).toBeNull();
    expect(screen.queryByText("知识网络视图")).toBeNull();
    expect(screen.queryByText("saved-evidence:int-one")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "证据链" }));
    expect(await screen.findByText("saved-evidence:int-one")).toBeTruthy();
    getInteraction.mockClear(); getMarkdown.mockClear(); getAnalysisHistory.mockClear();
    fireEvent.click(screen.getByText("问题乙"));
    expect(await screen.findByText("saved-evidence:int-two")).toBeTruthy();
    expect(screen.queryByText("0 次调用")).toBeNull();
    await waitFor(() => expect(getInteraction).toHaveBeenCalledWith("int-two"));
    fireEvent.click(screen.getByRole("tab", { name: "时间链" }));
    expect(screen.queryByText("saved-evidence:int-two")).toBeNull();
  });

  it("shows the current input and output above the deterministic timeline", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-source", questionPreview: "查询世界杯", interactionCount: 1 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-source", roundNumber: 1, questionPreview: "查询世界杯", resultPreview: "法国夺冠" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-source", interactionQuestion: "查询 **2018 世界杯**", interactionResult: "## 结论\n\n法国夺冠", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [{ operationId: "op-1", toolName: "query_object_instance", callStatus: "completed", startedAt: "2026-09-17T00:00:00Z", input: { mode: "inline", inline: { tournament: "WC-2018" } }, output: { mode: "inline", inline: { winner: "France" } }, query: { conditions: { tournament: "WC-2018" }, resultCount: 1 }, elements: [{ kind: "object", id: "tournament", name: "赛事" }], missingFacts: [] }] });

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "查询世界杯" }));

    expect(await screen.findByRole("button", { name: "查看完整本轮输入" })).toHaveTextContent("查询 **2018 世界杯**");
    expect(screen.getByRole("button", { name: "查看完整本轮输出" })).toHaveTextContent("## 结论");
    expect(screen.getByRole("button", { name: "复制 Markdown" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下载 Markdown" })).toBeEnabled();
    const analyzeButton = screen.getByRole("button", { name: "交给 BKN Agent 分析" });
    expect(analyzeButton).toBeEnabled();
    fireEvent.click(analyzeButton);
    expect(screen.getByText("知识网络优化 BKN Agent")).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "知识网络优化事实 Markdown" })).toHaveValue("# 当前交互轮次知识网络优化分析输入\n\n- Operation：`op-1`");
    expect(screen.getByRole("textbox", { name: "知识网络优化事实 Markdown" })).toHaveAttribute("readonly");
    expect(screen.getAllByText("查询赛事").length).toBeGreaterThan(0);
    expect(screen.getAllByText("tournament = WC-2018").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "查询赛事（query_object_instance）" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("问答对")).toBeNull();
  });

  it("collapses and expands the interaction rail without moving it above the workspace", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-rail", questionPreview: "轮次导航", interactionCount: 1 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-rail", roundNumber: 1, questionPreview: "第一轮问题" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-rail", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] });
    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "轮次导航" }));
    const collapse = await screen.findByRole("button", { name: "收起交互轮次" });
    const rail = collapse.closest("aside");
    expect(rail).toBeTruthy();
    fireEvent.click(collapse);
    expect(screen.getByRole("button", { name: "展开交互轮次" })).toBeTruthy();
    expect(rail?.className).toContain("roundSidebarCollapsed");
  });

  it("filters the deterministic timeline by recorded call status", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-filter", questionPreview: "检查调用", interactionCount: 1 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-filter", roundNumber: 1, questionPreview: "检查调用" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-filter", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [
      { operationId: "op-ok", toolName: "query_object_instance", callStatus: "completed", elements: [{ kind: "object", id: "event", name: "赛事" }], missingFacts: [] },
      { operationId: "op-failed", toolName: "run_cypher", callStatus: "failed", error: { mode: "inline", inline: { message: "timeout" } }, elements: [{ kind: "relation", id: "uses", name: "使用关系" }], missingFacts: [] },
    ] });
    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "检查调用" }));
    expect(await screen.findByRole("button", { name: "失败 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "失败 1" }));
    expect(screen.queryByRole("button", { name: /查询赛事/ })).toBeNull();
    expect(screen.getByRole("button", { name: /查询使用关系/ })).toBeTruthy();
  });

  it("does not invent a semantic round number when the API omits it", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-legacy", questionPreview: "历史会话", interactionCount: 3 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-legacy", questionPreview: "历史轮次" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-legacy", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] });

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "历史会话" }));

    expect(await screen.findByText("轮次未记录")).not.toBeNull();
    expect(screen.queryByText("第 1 轮")).toBeNull();
  });

  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({ addEventListener: vi.fn(), addListener: vi.fn(), matches: false, removeEventListener: vi.fn(), removeListener: vi.fn() })),
    });
    vi.stubGlobal("ResizeObserver", class { disconnect() {} observe() {} });
  });

  it("shows an enterprise image upgrade state when the licensed deployment has no EE route", async () => {
    getConversations.mockRejectedValue({ response: { status: 404 } });

    render(<BusinessProvenanceScene />);

    expect(await screen.findByText("需要升级企业版镜像")).not.toBeNull();
    expect(screen.queryByRole("columnheader", { name: "用户问题" })).toBeNull();
  });

  it("shows one access denied state when the server rejects the current trace scope", async () => {
    getConversations.mockRejectedValue({ response: { status: 403 } });

    render(<BusinessProvenanceScene />);

    expect(await screen.findByText("无权查看业务溯源")).not.toBeNull();
    expect(screen.queryByRole("columnheader", { name: "用户问题" })).toBeNull();
  });

  it("shows a retryable page state for an unexpected conversation load failure", async () => {
    getConversations.mockRejectedValue(new Error("network unavailable"));

    render(<BusinessProvenanceScene />);

    expect(await screen.findByText("业务会话加载失败")).not.toBeNull();
    expect(screen.getByRole("button", { name: /重\s*试/ })).not.toBeNull();
  });

  it("uses the standard level-three page title", async () => {
    getConversations.mockResolvedValue({ entries: [], total: 0 });

    render(<BusinessProvenanceScene />);

    expect(await screen.findByRole("heading", { level: 3, name: "业务溯源" })).not.toBeNull();
  });

  it("submits supported conversation filters only when the user queries", async () => {
    getConversations.mockResolvedValue({ entries: [], total: 0 });

    render(<BusinessProvenanceScene />);
    await waitFor(() => expect(getConversations).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("搜索问题、结果或会话 ID"), { target: { value: "采购" } });
    fireEvent.change(screen.getByPlaceholderText("Agent / 应用"), { target: { value: "Cursor" } });
    fireEvent.change(screen.getByPlaceholderText("知识网络"), { target: { value: "supply" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "会话状态" }));
    fireEvent.click(await screen.findByText("可继续对话"));
    expect(getConversations).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /查\s*询/ }));
    await waitFor(() => expect(getConversations).toHaveBeenLastCalledWith(expect.objectContaining({
      agentOrApp: "Cursor",
      keyword: "采购",
      knowledgeNetwork: "supply",
      status: "active",
    })));
    expect(screen.queryByLabelText("开始时间")).toBeNull();
    expect(screen.queryByLabelText("结束时间")).toBeNull();
  });

  it("submits the conversation filters when the user presses Enter", async () => {
    getConversations.mockResolvedValue({ entries: [], total: 0 });

    render(<BusinessProvenanceScene />);
    await waitFor(() => expect(getConversations).toHaveBeenCalledTimes(1));

    const keyword = screen.getByPlaceholderText("搜索问题、结果或会话 ID");
    fireEvent.change(keyword, { target: { value: "采购订单" } });
    fireEvent.keyDown(keyword, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(getConversations).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: "采购订单",
    })));
  });

  it("discards a late interaction list from the previously selected conversation", async () => {
    let resolveFirst!: (value: { entries: Array<{ interactionId: string; questionPreview: string }>; total: number }) => void;
    let resolveSecond!: (value: { entries: Array<{ interactionId: string; questionPreview: string }>; total: number }) => void;
    const first = new Promise<{ entries: Array<{ interactionId: string; questionPreview: string }>; total: number }>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<{ entries: Array<{ interactionId: string; questionPreview: string }>; total: number }>((resolve) => { resolveSecond = resolve; });
    getConversations.mockResolvedValue({ entries: [
      { conversationId: "conv-a", questionPreview: "会话 A", interactionCount: 1 },
      { conversationId: "conv-b", questionPreview: "会话 B", interactionCount: 1 },
    ], total: 2 });
    getInteractions.mockImplementation(({ conversationId }: { conversationId: string }) => conversationId === "conv-a" ? first : second);
    getInteraction.mockImplementation((interactionId: string) => Promise.resolve({ interactionId, conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] }));

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "会话 A" }));
    fireEvent.click(screen.getByRole("button", { name: /返回业务会话/ }));
    fireEvent.click(await screen.findByRole("button", { name: "会话 B" }));

    resolveSecond({ entries: [{ interactionId: "int-b", questionPreview: "B 的轮次" }], total: 1 });
    expect((await screen.findAllByText("B 的轮次")).length).toBeGreaterThan(0);
    resolveFirst({ entries: [{ interactionId: "int-a", questionPreview: "A 的迟到轮次" }], total: 1 });
    await act(async () => { await first; });

    expect(screen.queryByText("A 的迟到轮次")).toBeNull();
    expect(screen.getAllByText("B 的轮次").length).toBeGreaterThan(0);
  });

  it("shows that interaction rounds are loading before the list is available", async () => {
    let resolveInteractions!: (value: { entries: Array<{ interactionId: string; questionPreview: string }>; total: number }) => void;
    const pendingInteractions = new Promise<{ entries: Array<{ interactionId: string; questionPreview: string }>; total: number }>((resolve) => { resolveInteractions = resolve; });
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-loading", questionPreview: "加载中的会话", interactionCount: 1 }], total: 1 });
    getInteractions.mockReturnValue(pendingInteractions);

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "加载中的会话" }));

    expect((await screen.findAllByText("正在加载交互轮次")).length).toBeGreaterThan(0);
    resolveInteractions({ entries: [{ interactionId: "int-loading", questionPreview: "已加载轮次" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-loading", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] });
    expect(await screen.findByText("已加载轮次")).not.toBeNull();
  });

  it("defines compact typography for the analysis workspace", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css"), "utf8");

    expect(styles).toContain(".conversationHeading h1{font-size:18px}");
    expect(styles).toContain(".roundSidebarTitle h3,.operationCard h3{font-size:16px}");
    expect(styles).toContain(".roundList strong,.interactionSummary h2,.sourceTexts p,.operationCard p{font-size:14px}");
    expect(styles).not.toContain(".conversationHeading h1{width:100%;font-size:25px}");
  });

  it("keeps an eight-column conversation list before opening one interaction workspace", async () => {
    getConversations.mockResolvedValue({ entries: [
      { conversationId: "conv-1", questionPreview: "查询采购订单", interactionCount: 2, resultPreview: "无记录", agentName: "Supply Agent", status: "completed", evidenceCompleteness: "complete", startedAt: "2026-08-10", durationMs: 42 },
    ], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-1", questionPreview: "查询采购订单" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-1", conversationContext: [{ knowledgeNetworkId: "supplychain_hd0202", sourceInteractionId: "int-prior", sourceOperationId: "op-prior" }], derivedFacts: [{ rule: "changed_query_still_zero_result", sourceOperationId: "op-0", operationId: "op-1", elementId: "purchase_order" }], contextRelations: [], operations: [{ operationId: "op-1", toolName: "run_sql", knowledgeNetworkId: "supplychain_hd0202", startedAt: "2026-08-10T19:02:58Z", durationMs: 725, callStatus: "completed", elements: [{ kind: "object", id: "purchase_order", name: "物料请购单" }, { kind: "property", id: "supplier_number", name: "供应商编码", parentId: "purchase_order", field: "supplier_id" }], query: { resourceIds: ["inventory_resource"], conditions: { material_number: "101-000015" }, resultCount: 0 }, missingFacts: [] }] });
    render(<BusinessProvenanceScene />);
    expect(screen.getByRole("main").className).toContain("pageSurface");
    await screen.findByRole("columnheader", { name: "记录完整性" });
    expect(screen.getByRole("columnheader", { name: "用户问题" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "业务结果" })).not.toBeNull();
    expect(await screen.findByText("记录完整")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查询采购订单" }));
    await waitFor(() => expect(getInteractions).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conv-1" })));
    expect(await screen.findByText("2 轮交互")).not.toBeNull();
    expect(await screen.findByText("交互轮次")).not.toBeNull();
    expect(await screen.findByRole("tab", { name: "时间链" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("saved-evidence:int-1")).toBeNull();
    expect(screen.getByText("时间链")).not.toBeNull();
    expect(screen.getByText("证据链")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "业务会话" })).toBeNull();
  });

  it("keeps the full conversation question available when the table clamps it", async () => {
    const question = "基于供应链本体知识网络查询长期积压订单并分析每个仓库的成因";
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-clamped", questionPreview: question, interactionCount: 1 }], total: 1 });

    render(<BusinessProvenanceScene />);

    const questionButton = await screen.findByRole("button", { name: question });
    expect(questionButton.getAttribute("aria-label")).toBe(question);
  });

  it("shows recorded MCP payloads as concise business facts instead of generic detail placeholders", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-payload", questionPreview: "反查物料相关产品", interactionCount: 1 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-payload", roundNumber: 1, questionPreview: "反查物料相关产品" }], total: 1 });
    getInteraction.mockResolvedValue({
      interactionId: "int-payload",
      conversationContext: [],
      derivedFacts: [],
      contextRelations: [],
      operations: [
        {
          operationId: "op-code",
          toolName: "run_code",
          callStatus: "failed",
          input: { mode: "inline", inline: { code: "result = get_kn_detail(kn_id='supply_ontology_hand')" } },
          error: { mode: "inline", inline: { message: "代码执行超过 60 秒，已终止" } },
          elements: [],
          missingFacts: [],
        },
        {
          operationId: "op-schema",
          toolName: "get_kn_detail",
          callStatus: "completed",
          input: { mode: "inline", inline: { kn_id: "supply_ontology_hand" } },
          output: { mode: "inline", inline: { structuredContent: { object_types: [{ id: "material" }, { id: "product" }], relation_types: [{ id: "used_by" }] } } },
          elements: [],
          missingFacts: [],
        },
        {
          operationId: "op-resource",
          toolName: "describe_resource",
          callStatus: "completed",
          input: { mode: "inline", inline: { resource_id: "inventory_resource" } },
          output: { mode: "inline", inline: { structuredContent: { columns: [{ name: "material_id" }, { name: "product_id" }, { name: "quantity" }] } } },
          elements: [],
          missingFacts: [],
        },
        {
          operationId: "op-sql",
          toolName: "run_sql",
          callStatus: "completed",
          input: { mode: "inline", inline: { sql: "SELECT product_id FROM {{.inventory_resource}} WHERE material_id = 'M-100'" } },
          output: { mode: "inline", inline: { content: [{ type: "text", text: "{\"columns\":[\"product_id\"],\"data\":[{\"product_id\":\"P-1\"},{\"product_id\":\"P-2\"}]}" }] } },
          elements: [],
          missingFacts: [],
        },
        {
          operationId: "op-types",
          toolName: "get_object_types",
          callStatus: "completed",
          input: { mode: "inline", inline: { ids: ["material", "product"] } },
          output: { mode: "inline", inline: { object_types: [{ id: "material" }, { id: "product" }] } },
          elements: [],
          missingFacts: [],
        },
        {
          operationId: "op-query",
          toolName: "query_object_instance",
          callStatus: "completed",
          input: {
            mode: "inline",
            inline: {
              object_type_id: "material",
              conditions: [
                { field: "material_code", operation: "==", value: "165-001335", value_from: "const" },
                {
                  operation: "or",
                  sub_conditions: [
                    { field: "warehouse", operator: "eq", value: "上海仓" },
                    { field: "warehouse", operator: "eq", value: "苏州仓" },
                  ],
                },
              ],
            },
          },
          output: { mode: "inline", inline: { data: [{ material_code: "165-001335" }] } },
          query: { conditions: "[object Object]", resultCount: 1 },
          elements: [{ kind: "object", id: "material", name: "物料" }],
          missingFacts: [],
        },
      ],
    });

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "反查物料相关产品" }));

    expect((await screen.findAllByRole("heading", { name: "运行代码（run_code）" })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("调用：网络结构").length).toBeGreaterThan(0);
    expect(screen.getAllByText("代码执行超过 60 秒，已终止").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "网络结构（get_kn_detail）" })).not.toBeNull();
    expect(screen.getByText("知识网络：supply_ontology_hand")).not.toBeNull();
    expect(screen.getByText("返回 2 个对象类、1 个关系类。")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "数据资源详情（describe_resource）" })).not.toBeNull();
    expect(screen.getByText("数据资源：inventory_resource")).not.toBeNull();
    expect(screen.getByText("返回 3 个字段。")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "SQL 查询（run_sql）" })).not.toBeNull();
    expect(screen.getByText("SQL：SELECT product_id FROM {{.inventory_resource}} WHERE material_id = 'M-100'")).not.toBeNull();
    expect(screen.getByText("返回 2 条。")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "对象类详情（get_object_types）" })).not.toBeNull();
    expect(screen.getByText("对象类：material、product")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "查询物料（query_object_instance）" })).not.toBeNull();
    expect(screen.getAllByText("material_code = 165-001335；或（warehouse = 上海仓；warehouse = 苏州仓）").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
    expect(screen.queryByText("已记录输入，详情可查看")).toBeNull();
    expect(screen.queryByText("已记录结果，详情可查看")).toBeNull();
    expect(screen.queryByText("代码执行；业务对象以实际子调用为准")).toBeNull();
  });

  it("keeps the selected call inspector beside the 34th call in a self-scrolling workspace", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-long", questionPreview: "长时间链", interactionCount: 1 }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-long", roundNumber: 1, questionPreview: "长时间链" }], total: 1 });
    getInteraction.mockResolvedValue({
      interactionId: "int-long",
      conversationContext: [],
      derivedFacts: [],
      contextRelations: [],
      operations: Array.from({ length: 34 }, (_, index) => ({
        operationId: `op-${index + 1}`,
        toolName: "run_code",
        callStatus: "completed",
        input: { mode: "inline", inline: { code: `print(${index + 1})` } },
        output: { mode: "inline", inline: { stdout: `result-${index + 1}`, exit_code: 0 } },
        elements: [],
        missingFacts: [],
      })),
    });

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "长时间链" }));
    const callCards = await screen.findAllByRole("button", { name: /运行代码（run_code）/ });
    const inspector = screen.getByRole("complementary", { name: "本轮业务调用" });
    inspector.scrollTop = 180;
    fireEvent.click(callCards[33]);

    expect(within(inspector).getByText("op-34")).not.toBeNull();
    expect(inspector.scrollTop).toBe(0);

    const styles = readFileSync(resolve(process.cwd(), "src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css"), "utf8");

    expect(styles).toContain(".timelineLayout{display:grid;grid-template-columns:minmax(360px,1.15fr) minmax(300px,.85fr);align-items:stretch;height:clamp(480px,calc(100vh - 220px),720px);min-height:0;overflow:hidden");
    expect(styles).toContain(".timelineList{display:grid;align-content:start;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable");
    expect(styles).toContain(".timelineInspector{position:static;min-width:0;min-height:0;margin:14px;overflow-y:auto;overscroll-behavior:contain");
    expect(styles).toContain(".timelineLayout{height:auto;min-height:0;overflow:visible;grid-template-columns:1fr}");
  });

});

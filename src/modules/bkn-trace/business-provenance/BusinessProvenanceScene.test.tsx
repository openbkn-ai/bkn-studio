/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BusinessProvenanceScene } from "@/modules/bkn-trace/business-provenance/BusinessProvenanceScene";

const getConversations = vi.hoisted(() => vi.fn());
const getInteractions = vi.hoisted(() => vi.fn());
const getInteraction = vi.hoisted(() => vi.fn());
const getMarkdown = vi.hoisted(() => vi.fn());
const streamAnalysis = vi.hoisted(() => vi.fn());
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

describe("BusinessProvenanceScene", () => {
  beforeEach(() => {
    getConversations.mockReset();
    getInteractions.mockReset();
    getInteraction.mockReset();
    getMarkdown.mockReset();
    streamAnalysis.mockReset();
    getAnalysisHistory.mockReset();
    getAnalysisHistory.mockResolvedValue([]);
    getMarkdown.mockResolvedValue("# 当前交互轮次过程事实\n\n- Operation：`op-1`");
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

  it("keeps an eight-column conversation list before opening one interaction workspace", async () => {
    getConversations.mockResolvedValue({ entries: [
      { conversationId: "conv-internal", questionPreview: "你是业务溯源优化分析 Agent，只能依据当前交互轮次 Markdown", interactionCount: 1, agentName: "业务溯源优化Agent", status: "active", startedAt: "2026-08-10", durationMs: 42 },
      { conversationId: "conv-1", questionPreview: "查询采购订单", interactionCount: 2, resultPreview: "无记录", agentName: "Supply Agent", status: "completed", startedAt: "2026-08-10", durationMs: 42 },
    ], total: 2 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-1", questionPreview: "查询采购订单" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-1", conversationContext: [{ knowledgeNetworkId: "supplychain_hd0202", sourceInteractionId: "int-prior", sourceOperationId: "op-prior" }], derivedFacts: [{ rule: "changed_query_still_zero_result", sourceOperationId: "op-0", operationId: "op-1", elementId: "purchase_order" }], contextRelations: [], operations: [{ operationId: "op-1", toolName: "run_sql", knowledgeNetworkId: "supplychain_hd0202", startedAt: "2026-08-10T19:02:58Z", durationMs: 725, callStatus: "completed", elements: [{ kind: "object", id: "purchase_order", name: "物料请购单" }, { kind: "property", id: "supplier_number", name: "供应商编码", parentId: "purchase_order", field: "supplier_id" }], query: { resourceIds: ["inventory_resource"], conditions: { material_number: "101-000015" }, resultCount: 0 }, missingFacts: [] }] });
    streamAnalysis.mockResolvedValue({
          decision: "change_required",
          summary: "采购订单查询连续返回 0 条。",
          recommendations: [{
            scope: "bkn",
            location: "采购订单对象",
            problem: "缺少可复用的供应商关系",
            change: "补充供应商关联",
            trace_evidence_operation_ids: ["op-1"],
            bkn_schema_evidence: ["purchase_order"],
            acceptance: "重放后可通过正式关系查询供应商",
          }],
      });

    render(<BusinessProvenanceScene />);
    expect(screen.getByRole("main").className).toContain("pageSurface");
    await screen.findByRole("columnheader", { name: "证据完整性" });
    expect(screen.getByRole("columnheader", { name: "用户问题" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "业务结果" })).not.toBeNull();
    expect(screen.queryByText(/你是业务溯源优化分析 Agent/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查询采购订单" }));
    await waitFor(() => expect(getInteractions).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conv-1" })));
    expect(await screen.findByText("1 轮交互")).not.toBeNull();
    expect(await screen.findByText("交互轮次")).not.toBeNull();
    expect(await screen.findByText("调整查询后仍无匹配记录。")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "业务会话" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "调用详情" }));
    expect(await screen.findByText("做了什么")).not.toBeNull();
    expect(screen.getByText("操作哪个业务元素")).not.toBeNull();
    expect(screen.getByText("怎么调用")).not.toBeNull();
    expect(screen.getByText("实际结果")).not.toBeNull();
    expect(screen.getByText("供应商编码（supplier_number） → supplier_id")).not.toBeNull();
    expect(screen.getByText("inventory_resource")).not.toBeNull();
    expect(screen.getByText(/int-prior.*op-prior/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "关闭调用详情" }));
    fireEvent.click(screen.getByRole("button", { name: "交给 BKN Agent 分析" }));
    expect(await screen.findByText("业务溯源优化 BKN Agent")).not.toBeNull();
    expect(screen.getByText("待分析 Markdown")).not.toBeNull();
    const editor = await screen.findByRole("textbox", { name: "待分析 Markdown" });
    expect((editor as HTMLTextAreaElement).value).toContain("Operation：`op-1`");
    fireEvent.change(editor, { target: { value: "# 已确认的过程事实\n\n- Operation：`op-1`" } });
    expect(screen.queryByText(/\{\s*"decision"/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
		await waitFor(() => expect(streamAnalysis).toHaveBeenCalledTimes(1));
		expect(streamAnalysis).toHaveBeenCalledWith("int-1", "# 已确认的过程事实\n\n- Operation：`op-1`", expect.any(Function));
		expect(await screen.findByText("分类结论")).not.toBeNull();
		expect(screen.getByText("采购订单查询连续返回 0 条。")).not.toBeNull();
		expect(screen.getByText("缺少可复用的供应商关系")).not.toBeNull();
		expect(screen.getByText("op-1")).not.toBeNull();
		expect(screen.getByText("purchase_order")).not.toBeNull();
		expect(screen.getByText("重放后可通过正式关系查询供应商")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "关闭 BKN Agent 分析" }));
    fireEvent.click(screen.getByText("知识网络视图", { exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: /物料请购单/ }));
    expect(await screen.findByText("关联调用")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /查询物料请购单/ }));
    await waitFor(() => expect(screen.queryByText("关联调用")).toBeNull());
    expect(screen.getByText("做了什么")).not.toBeNull();
  }, 20_000);

  it("shows ambiguous BKN bindings as candidates instead of touched objects", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-1", questionPreview: "查询采购", interactionCount: 1, agentName: "Supply Agent" }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-ambiguous", questionPreview: "查询采购" }], total: 1 });
    getInteraction.mockResolvedValue({
      interactionId: "int-ambiguous", conversationContext: [], derivedFacts: [], contextRelations: [],
      operations: [{ operationId: "op-ambiguous", toolName: "run_sql", knowledgeNetworkId: "supply", status: "ambiguous", callStatus: "completed", objects: [{ id: "purchase_order", name: "采购订单" }, { id: "purchase_request", name: "采购申请" }], elements: [], query: { resourceIds: ["shared_resource"] }, missingFacts: [] }],
    });

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "查询采购" }));
    await screen.findByText("本轮输入（原文）");
    fireEvent.click(await screen.findByRole("button", { name: "调用详情" }));

    expect(await screen.findByText("候选业务对象")).not.toBeNull();
    expect(screen.getByText("采购订单、采购申请")).not.toBeNull();
    expect(screen.getByText("同一资源绑定到多个业务对象，无法唯一定位")).not.toBeNull();
  });

  it("does not let a previous interaction overwrite the current Markdown", async () => {
    let resolveFirstMarkdown!: (value: string) => void;
    const firstMarkdown = new Promise<string>((resolve) => { resolveFirstMarkdown = resolve; });
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-1", questionPreview: "连续查询", interactionCount: 2, agentName: "Supply Agent" }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [
      { interactionId: "int-1", questionPreview: "第一轮查询" },
      { interactionId: "int-2", questionPreview: "第二轮查询" },
    ], total: 2 });
    getInteraction.mockImplementation((interactionId: string) => Promise.resolve({ interactionId, conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] }));
    getMarkdown.mockImplementation((interactionId: string) => interactionId === "int-1" ? firstMarkdown : Promise.resolve("# 第二轮过程事实"));

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "连续查询" }));
    fireEvent.click(await screen.findByRole("button", { name: /第 2 轮.*第二轮查询/ }));
    fireEvent.click(await screen.findByRole("button", { name: "交给 BKN Agent 分析" }));
    const editor = await screen.findByRole("textbox", { name: "待分析 Markdown" });
    await waitFor(() => expect((editor as HTMLTextAreaElement).value).toBe("# 第二轮过程事实"));

    resolveFirstMarkdown("# 第一轮迟到的过程事实");
    await act(async () => { await firstMarkdown; });
    expect((editor as HTMLTextAreaElement).value).toBe("# 第二轮过程事实");
  });

  it("shows recorded SQL, readable resources and an exact failed analysis state", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-1", questionPreview: "查询采购", interactionCount: 1, agentName: "Supply Agent" }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-1", questionPreview: "查询采购" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-1", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [{
      operationId: "op-sql", toolName: "run_sql", callStatus: "completed", status: "resolved", knowledgeNetworkId: "supply",
      elements: [{ kind: "object", id: "purchase_order", name: "采购订单" }], missingFacts: [],
      query: { sql: "SELECT * FROM {{.resource_po}} WHERE material_number = '101'", resourceIds: ["resource_po"], resources: [{ id: "resource_po", name: "supply.bkn_supply_po", objectId: "purchase_order", objectName: "采购订单" }], resultCount: 0 },
    }] });
    streamAnalysis.mockRejectedValue(new Error("源 BKN 未配置 Skill 对象"));

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "查询采购" }));
    await screen.findByText("本轮输入（原文）");
    fireEvent.click(await screen.findByRole("button", { name: "调用详情" }));
    expect((await screen.findAllByText("SQL 条件见下方完整 SQL")).length).toBeGreaterThan(0);
    expect(screen.getByText("采购订单 · supply.bkn_supply_po")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "关闭调用详情" }));
    fireEvent.click(screen.getByRole("button", { name: "交给 BKN Agent 分析" }));
    await screen.findByRole("textbox", { name: "待分析 Markdown" });
    fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
    expect(await screen.findByText("分析失败")).not.toBeNull();
    expect(screen.getByText("源 BKN 未配置 Skill 对象")).not.toBeNull();
    expect(screen.queryByText("分类结论")).toBeNull();
  });

  it("shows the EE submission diagnosis instead of claiming that the BKN Agent is unavailable", async () => {
    getConversations.mockResolvedValue({ entries: [{ conversationId: "conv-1", questionPreview: "查询采购", interactionCount: 1, agentName: "Supply Agent" }], total: 1 });
    getInteractions.mockResolvedValue({ entries: [{ interactionId: "int-1", questionPreview: "查询采购" }], total: 1 });
    getInteraction.mockResolvedValue({ interactionId: "int-1", conversationContext: [], derivedFacts: [], contextRelations: [], operations: [] });
    streamAnalysis.mockRejectedValue(Object.assign(new Error("response_format must be a JSON Schema"), { code: "analysis_rejected", statusCode: 422 }));

    render(<BusinessProvenanceScene />);
    fireEvent.click(await screen.findByRole("button", { name: "查询采购" }));
    await screen.findByText("本轮输入（原文）");
    fireEvent.click(await screen.findByRole("button", { name: "交给 BKN Agent 分析" }));
    await screen.findByRole("textbox", { name: "待分析 Markdown" });
    fireEvent.click(screen.getByRole("button", { name: "开始分析" }));

    expect(await screen.findByText("分析失败")).not.toBeNull();
    expect(screen.getByText("response_format must be a JSON Schema")).not.toBeNull();
    expect(screen.queryByText("优化 Agent 暂时不可用")).toBeNull();
  });
});

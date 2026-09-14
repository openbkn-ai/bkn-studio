/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import "@testing-library/jest-dom/vitest";
import "@/app/locales/i18n";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidenceChainPanels } from "./EvidenceChainPanels";
import type { EvidenceChainView } from "./evidence-chain.types";

// Synthetic component contract test, never shipped as historical evidence.
const view: EvidenceChainView = {
  interactionId: "test-only", question: "When?", answer: "Late 24 days; stock 0.", status: "interrupted",
  claims: [
    { id: "late", label: "Delay", value: "24 days", status: "checked", answerRange: { start: 5, end: 12, exact: "24 days" }, nodeIds: ["delay"] },
    { id: "stock", label: "Stock", value: "0", status: "unbound", nodeIds: [] },
  ],
  execution: { nodes: [{ id: "call", label: "Inventory query", kind: "query", status: "failed", technical: "private-op-id" }, { id: "other", label: "Other call", kind: "api" }], edges: [] },
  evidence: { nodes: [{ id: "date", label: "Available date", kind: "field" }, { id: "delay", label: "Customer delay", kind: "result" }, { id: "unrelated", label: "Unrelated material", kind: "object" }], edges: [{ id: "d", source: "date", target: "delay", label: "Date difference" }] },
};
describe("EvidenceChainPanels", () => {
  it("uses complete propositions and question coverage as the business entry", () => {
    render(<EvidenceChainPanels view={{ ...view, evidenceStatus: "complete", question: "物料现在有多少库存，它被哪些产品使用？", requirements: [
      { id: "inventory", label: "现在有多少库存", status: "supported", claimIds: ["inventory"] },
      { id: "products", label: "被哪些产品使用", status: "missing", claimIds: [] },
    ], claims: [{
      id: "inventory", label: "当前全仓可用库存为 2 个", value: "2 个", role: "primary", requirementIds: ["inventory"],
      status: "located", supportStatus: "supported", attributionStatus: "reconstructed", answerRange: { start: 0, end: 13, exact: "当前全仓可用库存为 2 个" }, nodeIds: ["date"],
    }], answer: "当前全仓可用库存为 2 个。" }} />);
    expect(screen.getByText("问题要求与关键结论")).toBeVisible();
    expect(screen.getByText("现在有多少库存")).toBeVisible();
    expect(screen.getByText("被哪些产品使用")).toBeVisible();
    expect(screen.getByText("答案尚未覆盖")).toBeVisible();
    expect(screen.getByText("部分结论有依据")).toBeVisible();
    const catalog = screen.getByText("问题要求与关键结论").closest("aside")!;
    expect(within(catalog).getByRole("button", { name: /当前全仓可用库存为 2 个/ })).toBeVisible();
    expect(within(catalog).queryByText("2 个")).not.toBeInTheDocument();
  });
  it("shows a shared conclusion once when it answers multiple requirements", () => {
    const sharedClaim = {
      id: "player", label: "1978 年，Mario Kempes 代表阿根廷获得金球奖，并在同届世界杯打进 5 球。", value: "1978、阿根廷、5 球", role: "primary" as const,
      requirementIds: ["members", "details"], status: "located" as const, nodeIds: ["delay"],
    };
    render(<EvidenceChainPanels view={{ ...view, claims: [sharedClaim], requirements: [
      { id: "members", label: "哪些球员符合条件", status: "partial", claimIds: ["player"] },
      { id: "details", label: "列出届次、球队与进球数", status: "partial", claimIds: ["player"] },
    ] }} />);
    const catalog = screen.getByText("问题要求与关键结论").closest("aside")!;
    expect(within(catalog).getAllByRole("button", { name: /1978 年，Mario Kempes/ })).toHaveLength(1);
    expect(screen.getByText("由前述共用结论覆盖")).toBeVisible();
  });
  it("keeps scope, result, and legacy conclusions reachable in the requirement catalog", () => {
    render(<EvidenceChainPanels view={{ ...view, requirements: [
      { id: "inventory", label: "库存", status: "supported", claimIds: ["primary"] },
    ], claims: [
      { id: "primary", label: "当前库存为 2 个", role: "primary", status: "checked", nodeIds: ["date"] },
      { id: "scope", label: "统计范围为全仓", role: "scope", status: "located", nodeIds: ["date"] },
      { id: "result", label: "生产可用库存为 0", role: "result", status: "located", nodeIds: ["delay"] },
      { id: "legacy", label: "该物料被 1 个产品使用", status: "located", nodeIds: ["delay"] },
    ] }} />);

    const catalog = screen.getByText("问题要求与关键结论").closest("aside")!;
    expect(within(catalog).getByRole("button", { name: /当前库存为 2 个/ })).toBeVisible();
    expect(within(catalog).getByRole("button", { name: /统计范围为全仓/ })).toBeVisible();
    expect(within(catalog).getByRole("button", { name: /生产可用库存为 0/ })).toBeVisible();
    expect(within(catalog).getByRole("button", { name: /该物料被 1 个产品使用/ })).toBeVisible();
  });
  it("keeps one selected conclusion in the explanation workspace", () => {
    render(<EvidenceChainPanels view={view} />);

    expect(screen.getByRole("region", { name: "Delay的解释路径" })).not.toHaveAttribute("open");
    expect(screen.queryByRole("region", { name: "Stock的解释路径" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Stock/ }));
    expect(screen.getByRole("region", { name: "Stock的解释路径" })).not.toHaveAttribute("open");
    expect(screen.queryByRole("region", { name: "Delay的解释路径" })).not.toBeInTheDocument();
  });
  it("shows the selected conclusion evidence graph as the primary workspace", () => {
    render(<EvidenceChainPanels view={view} />);

    const graph = screen.getByRole("region", { name: "依据图谱" });
    expect(graph).toBeVisible();
    expect(within(graph).getByRole("group", { name: "图谱视图控制" })).toBeVisible();
    expect(screen.queryByText(/排障/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看本轮其他记录" })).toHaveAttribute("aria-expanded", "false");
  });
  it("puts the trust decision before a long unverified answer and keeps the answer collapsed", () => {
    const longAnswer = `未经逐项核验的业务回答。${"详细内容".repeat(90)}`;
    render(<EvidenceChainPanels view={{ ...view, answer: longAnswer, claims: [], status: "completed", evidenceStatus: "partial" }} />);

    const warning = screen.getByRole("status", { name: "本答案尚未验证" });
    const answerHeading = screen.getByRole("heading", { name: "答案原文" });
    expect(warning.compareDocumentPosition(answerHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("答案支持度").parentElement).toHaveTextContent("未形成结论依据");
    expect(screen.getByText("证据记录").parentElement).toHaveTextContent("存在缺口");
    expect(screen.getByText("本轮执行").parentElement).toHaveTextContent("已完成");
    expect(screen.queryByText(longAnswer)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看答案原文" }));
    expect(screen.getByText(longAnswer)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "收起答案原文" }));
    expect(screen.queryByText(longAnswer)).not.toBeInTheDocument();
  });

  it("keeps a selected answer anchor visible while a long verified answer is collapsed", () => {
    const exact = "1978 年，Mario Kempes 代表阿根廷获得金球奖，并在同届世界杯打进 5 球";
    const answer = `${exact}。${"其他届次的详细说明。".repeat(40)}`;
    render(<EvidenceChainPanels view={{
      ...view,
      answer,
      claims: [{
        id: "kempes",
        label: "Mario Kempes 获得金球奖且在同一届世界杯至少打进 3 球",
        value: "1978 年，阿根廷，5 球",
        role: "primary",
        status: "located",
        supportStatus: "supported",
        attributionStatus: "explicit",
        answerRange: { start: 0, end: Array.from(exact).length, exact },
        nodeIds: ["delay"],
      }],
    }} />);

    expect(screen.getByText("当前结论在答案中的原文")).toBeVisible();
    expect(screen.getByRole("button", { name: exact })).toBeVisible();
    expect(screen.queryByText(answer)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "依据图谱" })).toBeVisible();
  });

  it("separates answer scope from the primary business result", () => {
    render(<EvidenceChainPanels view={{...view, claims:[
      {id:"total",label:"可用库存合计",value:"100,508,026.49",role:"result",status:"located",nodeIds:["date"],derivation:{method:"direct_return",processName:"全网可用库存指标",boundary:"指标返回总量。",inputs:[],components:[]}},
      {id:"warehouses",label:"仓库数量",value:"29",role:"scope",status:"located",nodeIds:["delay"],derivation:{method:"direct_return",processName:"仓库数量指标",boundary:"指标返回统计范围。",inputs:[],components:[]}},
    ]}} />);
    const total = screen.getByRole("region", {name:"可用库存合计的解释路径"});
    expect(total).toHaveAttribute("open");
    expect(within(total).getByText("答案结论")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /仓库数量29/ }));
    const scope = screen.getByRole("region", {name:"仓库数量的解释路径"});
    expect(within(scope).getByText("回答范围")).toBeInTheDocument();
  });
  it("shows semantic support and answer attribution as independent states", () => {
    render(<EvidenceChainPanels view={{ ...view, claims: [
      { ...view.claims[0], supportStatus: "partial", attributionStatus: "explicit" },
      { ...view.claims[1], supportStatus: "unsupported", attributionStatus: "reconstructed" },
    ] }} />);
    const delay = screen.getByRole("region", { name: "Delay的解释路径" });
    expect(within(delay).getByText("部分支持")).toBeInTheDocument();
    expect(within(delay).getByText("答案明确引用")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Stock0/ }));
    const stock = screen.getByRole("region", { name: "Stock的解释路径" });
    expect(within(stock).getByText("不支持结论")).toBeInTheDocument();
    expect(within(stock).getByText("系统重建引用")).toBeInTheDocument();
  });
  it("does not call the answer fully supported when the evidence record has gaps", () => {
    render(<EvidenceChainPanels view={{
      ...view,
      status: "completed",
      evidenceStatus: "partial",
      claims: [{ ...view.claims[0], supportStatus: "supported", attributionStatus: "reconstructed" }],
    }} />);
    expect(screen.getByText("答案支持度").parentElement).toHaveTextContent("部分结论有依据");
    expect(screen.getByText("证据记录").parentElement).toHaveTextContent("存在缺口");
  });
  it("treats checked legacy conclusions as supported when no support status was projected", () => {
    render(<EvidenceChainPanels view={{
      ...view,
      evidenceStatus: "complete",
      claims: [{ ...view.claims[0], status: "checked", supportStatus: undefined }],
    }} />);
    expect(screen.getByText("答案支持度").parentElement).toHaveTextContent("已识别结论有依据");
  });
  it("keeps non-adopted records behind a secondary business entry", () => {
    render(<EvidenceChainPanels view={view} />);
    expect(screen.queryByText(/排障/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看本轮其他记录" })).toHaveAttribute("aria-expanded", "false");
  });
  it("resolves an all-interaction diagnostic edge against the all-facts graph", () => {
    const multipleClaims: EvidenceChainView = {
      ...view,
      claims: [
        { ...view.claims[0], nodeIds: ["delay"] },
        { ...view.claims[1], nodeIds: ["stock"] },
      ],
      evidence: {
        nodes: [
          ...view.evidence.nodes,
          { id: "stock-source", label: "Stock source", kind: "source" },
          { id: "stock", label: "Stock fact", kind: "field", value: "0" },
        ],
        edges: [...view.evidence.edges, { id: "stock-return", source: "stock-source", target: "stock", label: "Stock returned", kind: "value" }],
      },
    };
    render(<EvidenceChainPanels view={multipleClaims} />);
    fireEvent.click(screen.getByRole("button", { name: "查看本轮其他记录" }));
    fireEvent.click(screen.getByRole("button", { name: "Stock returned" }));
    expect(screen.getByRole("dialog", { name: "关系详情" })).toHaveTextContent("Stock source → Stock fact");
  });
  it("provides zoom, fit, reset, node selection, and edge selection on the evidence graph", () => {
    render(<EvidenceChainPanels view={view} />);
    const graph = screen.getByRole("region", { name: "依据图谱" });
    expect(within(graph).getByRole("group", { name: "图谱视图控制" })).toBeVisible();
    fireEvent.click(within(graph).getByRole("button", { name: "放大图谱" }));
    expect(within(graph).getByText("110%")).toBeVisible();
    fireEvent.click(within(graph).getByRole("button", { name: "重置视图" }));
    expect(within(graph).getByText("100%")).toBeVisible();
    const date = within(graph).getByRole("button", { name: /Available date/ });
    fireEvent.click(date);
    expect(date).toHaveAttribute("aria-pressed", "true");
    const nodeDetails = screen.getByRole("dialog", { name: "依据详情" });
    expect(nodeDetails).toBeVisible();
    fireEvent.click(within(nodeDetails).getByRole("button", { name: /关闭/ }));
    const relation = within(graph).getByRole("button", { name: "Date difference" });
    fireEvent.click(relation);
    expect(relation.closest("g")).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("dialog", { name: "关系详情" })).toBeVisible();
  });
  it("registers a non-passive native wheel handler for Ctrl or Command zoom", () => {
    const listener = vi.spyOn(HTMLElement.prototype, "addEventListener");
    try {
      render(<EvidenceChainPanels view={view} />);
      expect(listener).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
    } finally {
      listener.mockRestore();
    }
  });
  it("keeps the initial graph view readable in a narrow embedded workspace", () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 300 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 300 });
    try {
      render(<EvidenceChainPanels view={view} />);
      const graph = screen.getByRole("region", { name: "依据图谱" });
      expect(within(graph).getByText("72%")).toBeVisible();
      fireEvent.click(within(graph).getByRole("button", { name: "适应画布" }));
      expect(within(graph).getByText("45%")).toBeVisible();
    } finally {
      if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
      else delete (HTMLElement.prototype as unknown as { clientWidth?: number }).clientWidth;
      if (height) Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
      else delete (HTMLElement.prototype as unknown as { clientHeight?: number }).clientHeight;
    }
  });
  it("supports zoom controls and visible node or edge selection in the fact graph", () => {
    render(<EvidenceChainPanels view={view} />);
    const graph = screen.getByRole("region", { name: "依据图谱" });
    expect(within(graph).getByRole("button", { name: "放大图谱" })).toBeVisible();
    fireEvent.click(within(graph).getByRole("button", { name: "放大图谱" }));
    expect(within(graph).getByText("110%")).toBeVisible();
    const node = within(graph).getByRole("button", { name: /Available date/ });
    fireEvent.click(node);
    expect(node).toHaveAttribute("aria-pressed", "true");
    const edge = within(graph).getByRole("button", { name: "Date difference" });
    fireEvent.click(edge);
    expect(edge.closest("g")).toHaveAttribute("data-selected", "true");
    fireEvent.click(within(graph).getByRole("button", { name: "重置视图" }));
    expect(within(graph).getByText("100%")).toBeVisible();
  });
  it("switches the focused business explanation while keeping component details optional", () => {
    const explained: EvidenceChainView = {
      ...view,
      answer: "可用库存 906；反查被 3 个产品使用。",
      claims: [
        { id:"inventory", label:"可用库存", value:"906", status:"located", answerRange:{start:0,end:8,exact:"可用库存 906"}, nodeIds:["inventory-fact"], objectLabel:"物料 165-001335", derivation:{method:"sum",processName:"物料可用库存指标",formula:"20 + 1 + 77 + 121 + 9 + 1 + 677 = 906",verification:"independent_cross_check",boundary:"指标内部计算明细未记录；分仓数据来自另一次同口径查询。",inputs:[{label:"数据时点",value:"当前"}],components:[{label:"乌鲁木齐备件仓 · 可用",value:"20"},{label:"苏州无人机原料仓 · 可用",value:"677"}]} },
        { id:"products", label:"使用产品数", value:"3", status:"located", answerRange:{start:9,end:18,exact:"反查被 3 个产品"}, nodeIds:["products-fact"], objectLabel:"物料 165-001335", derivation:{method:"distinct_count",processName:"物料反查产品",formula:"去重后的产品编码数 = 3",verification:"same_return",boundary:"未记录产品级 BOM 回溯明细。",inputs:[{label:"统计口径",value:"BOM 根产品（含替代料）"}],components:[{label:"产品",value:"367-000061"},{label:"产品",value:"367-000130"},{label:"产品",value:"367-000131"}]} },
      ],
      evidence:{nodes:[{id:"inventory-fact",label:"可用库存",kind:"field",value:"906"},{id:"products-fact",label:"使用产品数",kind:"field",value:"3"}],edges:[]},
    };
    render(<EvidenceChainPanels view={explained} />);
    const inventory = screen.getByRole("region", {name:"可用库存的解释路径"});
    expect(inventory).toHaveAttribute("open");
    expect(within(inventory).getByText("物料可用库存指标")).toBeVisible();
    expect(within(inventory).getByText("20 + 1 + 77 + 121 + 9 + 1 + 677 = 906")).toBeVisible();
    expect(within(inventory).getByText("乌鲁木齐备件仓 · 可用")).not.toBeVisible();
    fireEvent.click(within(inventory).getByText(/查看 2 项组成数据/));
    expect(within(inventory).getByText("乌鲁木齐备件仓 · 可用")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /使用产品数3/ }));
    const products = screen.getByRole("region", {name:"使用产品数的解释路径"});
    expect(products).toHaveAttribute("open");
    expect(screen.queryByRole("region", {name:"可用库存的解释路径"})).not.toBeInTheDocument();
    expect(within(products).getByText("物料反查产品")).toBeVisible();
    expect(screen.getByRole("region", {name:"依据图谱"})).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "可用库存 906" }));
    const claimFacts = screen.getByRole("region", {name:"依据图谱"});
    expect(within(claimFacts).getAllByText("可用库存").length).toBeGreaterThan(0);
    expect(within(claimFacts).queryByText("使用产品数")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看本轮其他记录" }));
    expect(within(screen.getByRole("region", {name:"本轮完整记录事实"})).getByText("使用产品数")).toBeVisible();
  });
  it("opens execution on the operation that produced an answer conclusion", () => {
    const semantic: EvidenceChainView = {
      ...view,
      claims: [{ id: "inventory", label: "可用库存", value: "906", status: "located", nodeIds: ["inventory-fact"] }],
      execution: { nodes: [
        { id: "discovery", label: "搜索工具", kind: "query", role: "context" },
        { id: "metric", label: "计算业务指标", kind: "calculation", role: "process" },
        { id: "input", label: "物料 165-001335", kind: "object", role: "input" },
        { id: "output", label: "可用库存", value: "906", kind: "field", role: "output" },
      ], edges: [
        { id: "in", source: "input", target: "metric", label: "作为分析对象", kind: "execution" },
        { id: "out", source: "metric", target: "output", label: "返回", kind: "execution" },
      ] },
      evidence: { nodes: [
        { id: "source", label: "指标返回", kind: "source", role: "source", executionNodeId: "metric" },
        { id: "inventory-fact", label: "可用库存", value: "906", kind: "field", role: "fact" },
      ], edges: [{ id: "source-fact", source: "source", target: "inventory-fact", label: "返回值来源", kind: "value" }] },
    };
    render(<EvidenceChainPanels view={semantic} />);
    fireEvent.click(screen.getByRole("button", { name: "执行链路" }));
    const flow = screen.getByRole("region", { name: "计算业务指标业务处理" });
    expect(within(flow).getByText("业务输入")).toBeInTheDocument();
    expect(within(flow).getByText("物料 165-001335")).toBeInTheDocument();
    expect(within(flow).getAllByText("计算业务指标")).toHaveLength(2);
    expect(within(flow).getByText("业务结果")).toBeInTheDocument();
    expect(within(flow).getByText("906")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "选择业务处理" })).not.toBeInTheDocument();
    expect(screen.getByText("搜索工具")).not.toBeVisible();
    fireEvent.click(within(flow).getByRole("button", { name: "查看结论：可用库存 →" }));
    expect(screen.getByRole("button", { name: "证据链" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "可用库存的解释路径" })).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "执行链路" }));
    fireEvent.click(screen.getByText(/^技术执行记录/));
    expect(screen.getByText("搜索工具")).toBeInTheDocument();
  });

  it("prefers the execution output explicitly matching the selected conclusion", () => {
    const inventory = "物料525-000016当前可用库存为2个。";
    const product = "YN580农业无人飞机（367-000130）使用物料525-000016。";
    const semantic: EvidenceChainView = {
      ...view,
      claims: [
        { id: "inventory", label: inventory, value: "2", role: "primary", status: "located", nodeIds: ["inventory-fact"] },
        { id: "product", label: product, value: "367-000130", role: "primary", status: "located", nodeIds: ["product-fact"] },
      ],
      execution: { nodes: [
        { id: "inventory-query", label: "查询库存", kind: "query", role: "process", status: "completed" },
        { id: "inventory-input", label: "库存条件", kind: "field", role: "input" },
        { id: "inventory-output", label: inventory, value: "2", kind: "field", role: "output" },
        { id: "product-query", label: "查询产品BOM", kind: "query", role: "process", status: "completed" },
        { id: "product-input", label: "物料", value: "525-000016", kind: "field", role: "input" },
        { id: "product-output", label: product, value: "367-000130", kind: "field", role: "output" },
      ], edges: [
        { id: "inventory-in", source: "inventory-input", target: "inventory-query", label: "输入", kind: "execution" },
        { id: "inventory-out", source: "inventory-query", target: "inventory-output", label: "返回", kind: "execution" },
        { id: "product-in", source: "product-input", target: "product-query", label: "输入", kind: "execution" },
        { id: "product-out", source: "product-query", target: "product-output", label: "返回", kind: "execution" },
      ] },
      evidence: { nodes: [
        { id: "inventory-source", label: "库存查询", kind: "source", executionNodeId: "inventory-query" },
        { id: "product-source", label: "产品BOM查询", kind: "source", executionNodeId: "product-query" },
        { id: "inventory-fact", label: "库存", value: "2", kind: "field", role: "fact" },
        { id: "product-fact", label: "使用产品", value: "367-000130", kind: "field", role: "fact" },
      ], edges: [
        { id: "inventory-product", source: "inventory-source", target: "product-fact", label: "同轮上下文", kind: "context" },
        { id: "product-product", source: "product-source", target: "product-fact", label: "返回值来源", kind: "value" },
      ] },
    };
    render(<EvidenceChainPanels view={semantic} />);
    const catalog = screen.getByText("问题要求与关键结论").closest("aside")!;
    fireEvent.click(within(catalog).getByRole("button", { name: /YN580农业无人飞机/ }));
    fireEvent.click(screen.getByRole("button", { name: "执行链路" }));

    expect(screen.getByRole("region", { name: "查询产品BOM业务处理" })).toHaveAttribute("open");
    expect(screen.getByRole("region", { name: "查询库存业务处理" })).not.toHaveAttribute("open");
  });

  it("keeps the recorded function output when an answer claim has a different value", () => {
    const recorded: EvidenceChainView = {
      ...view,
      claims: [{ id: "claim", label: "仓库数量", value: "29", status: "located", nodeIds: ["fact"] }],
      execution: { nodes: [
        { id: "metric", label: "可用库存指标", kind: "calculation", role: "process" },
        { id: "scope", label: "库存范围", value: "全网", kind: "object", role: "input" },
        { id: "output", label: "可用库存", value: "100,508,026.49", kind: "field", role: "output" },
      ], edges: [{ id: "in", source: "scope", target: "metric", label: "作为输入", kind: "execution" }, { id: "out", source: "metric", target: "output", label: "返回", kind: "execution" }] },
      evidence: { nodes: [{ id: "source", label: "指标返回", kind: "source", executionNodeId: "metric" }, { id: "fact", label: "仓库数量", value: "29", kind: "field", role: "fact" }], edges: [] },
    };
    render(<EvidenceChainPanels view={recorded} initialPanel="execution" />);
    const flow = screen.getByRole("region", { name: "可用库存指标业务处理" });
    expect(within(flow).getByText("100,508,026.49")).toBeVisible();
    expect(within(flow).queryByText("29")).not.toBeInTheDocument();
  });

  it("leads an execution step with its process and key conclusions", () => {
    const semantic: EvidenceChainView = {
      ...view,
      claims: [
        { id: "total", label: "当前全仓可用库存为 2 个", value: "2 个", role: "primary", status: "located", nodeIds: ["total-source"] },
        { id: "warehouse", label: "库存记录位于生产维修仓", value: "生产维修仓", role: "supporting", status: "located", nodeIds: ["warehouse-source"] },
      ],
      execution: { nodes: [
        { id: "query", label: "查询库存", kind: "query", role: "process", status: "completed" },
        { id: "input", label: "物料", value: "525-000016", kind: "object", role: "input" },
        { id: "total-output", label: "当前全仓可用库存为 2 个", value: "2 个", kind: "field", role: "output" },
        { id: "warehouse-output", label: "库存记录位于生产维修仓", value: "生产维修仓", kind: "field", role: "output" },
      ], edges: [
        { id: "input-query", source: "input", target: "query", label: "作为输入", kind: "execution" },
        { id: "query-total", source: "query", target: "total-output", label: "返回", kind: "execution" },
        { id: "query-warehouse", source: "query", target: "warehouse-output", label: "返回", kind: "execution" },
      ] },
      evidence: { nodes: [
        { id: "total-source", label: "库存查询", kind: "source", executionNodeId: "query" },
        { id: "warehouse-source", label: "库存查询", kind: "source", executionNodeId: "query" },
      ], edges: [] },
    };
    render(<EvidenceChainPanels view={semantic} initialPanel="execution" />);
    const flow = screen.getByRole("region", { name: "查询库存业务处理" });
    expect(within(flow).getAllByRole("heading", { name: "查询库存" })).toHaveLength(2);
    expect(within(flow).getAllByText("当前全仓可用库存为 2 个")).toHaveLength(2);
    expect(within(flow).getByText("生产维修仓")).not.toBeVisible();
    fireEvent.click(within(flow).getByText("查看其他 1 项返回字段"));
    expect(within(flow).getByText("生产维修仓")).toBeVisible();
    expect(within(flow).queryByRole("button", { name: "查看结论：库存记录位于生产维修仓 →" })).not.toBeInTheDocument();
  });

  it("focuses a shared business process on the conclusion selected by the user", () => {
    const kempes = "1978 年，Mario Kempes 代表阿根廷获得金球奖，并在同届世界杯打进 5 球。";
    const messi = "2022 年，Lionel Messi 代表阿根廷获得金球奖，并在同届世界杯打进 7 球。";
    const semantic: EvidenceChainView = {
      ...view,
      requirements: [{ id: "players", label: "哪些球员符合条件", status: "partial", claimIds: ["kempes", "messi"] }],
      claims: [
        { id: "kempes", label: kempes, value: "1978、5 球、阿根廷", role: "primary", status: "located", nodeIds: ["kempes-source"] },
        { id: "messi", label: messi, value: "2022、7 球、阿根廷", role: "primary", status: "located", nodeIds: ["messi-source"] },
      ],
      execution: { nodes: [
        { id: "query", label: "查询奖项得主", kind: "query", role: "process", status: "completed" },
        { id: "input", label: "已记录查询条件", value: "Mario Kempes", kind: "field", role: "input" },
        { id: "kempes-output", label: kempes, value: "1978、5 球、阿根廷", kind: "field", role: "output" },
        { id: "messi-output", label: messi, value: "2022、7 球、阿根廷", kind: "field", role: "output" },
      ], edges: [
        { id: "input-query", source: "input", target: "query", label: "作为输入", kind: "execution" },
        { id: "query-kempes", source: "query", target: "kempes-output", label: "返回", kind: "execution" },
        { id: "query-messi", source: "query", target: "messi-output", label: "返回", kind: "execution" },
      ] },
      evidence: { nodes: [
        { id: "kempes-source", label: "奖项查询", kind: "source", executionNodeId: "query" },
        { id: "messi-source", label: "奖项查询", kind: "source", executionNodeId: "query" },
      ], edges: [] },
    };
    render(<EvidenceChainPanels view={semantic} />);
    const catalog = screen.getByText("问题要求与关键结论").closest("aside")!;
    fireEvent.click(within(catalog).getByRole("button", { name: /2022 年，Lionel Messi/ }));
    fireEvent.click(screen.getByRole("button", { name: "执行链路" }));

    const flow = screen.getByRole("region", { name: "查询奖项得主业务处理" });
    expect(flow.querySelector("summary")).toHaveTextContent(messi);
    expect(flow.querySelector("summary")).not.toHaveTextContent(kempes);
    const results = within(flow).getByRole("heading", { name: "本次返回的结果" }).closest("section")!;
    expect(within(results).getByText(messi)).toBeVisible();
    expect(within(results).getByText(kempes)).not.toBeVisible();
    expect(within(flow).getByText("该业务处理同时返回 1 项其他结果。下面优先显示当前结论；左侧条件保持本次调用的真实记录。")).toBeVisible();
    expect(within(flow).getByRole("button", { name: `查看结论：${messi} →` })).toBeVisible();
    expect(within(flow).getByText("查看同一步骤支撑的其他 1 个结论")).toBeVisible();
    expect(within(flow).getByRole("button", { name: `查看结论：${kempes} →` })).not.toBeVisible();
  });

  it("does not invent a calculation path when only a located return value was recorded", () => {
    render(<EvidenceChainPanels view={{ ...view, claims: [{ id: "stock", label: "库存", value: "906", status: "located", nodeIds: ["date"] }] }} />);
    const claim = screen.getByRole("region", { name: "库存的解释路径" });
    fireEvent.click(within(claim).getByText("库存"));
    expect(within(claim).getByText("证据边界：")).toBeVisible();
    expect(within(claim).queryByText("已记录的业务处理")).not.toBeInTheDocument();
  });

  it("renders a generic semantic evidence path from projected references and conditions", () => {
    const semantic: EvidenceChainView = {
      ...view,
      claims: [{ id: "count", label: "参赛次数", value: "18", status: "located", supportStatus: "supported", attributionStatus: "reconstructed", nodeIds: ["unit"], objectLabel: "球员" }],
      evidence: { nodes: [
        { id: "player", label: "球员", kind: "object", role: "context" },
        { id: "condition", label: "业务条件", value: "赛事 = 决赛阶段", kind: "field", role: "input" },
        { id: "unit", label: "按本体关系查询", kind: "query", role: "process" },
      ], edges: [
        { id: "player-unit", source: "player", target: "unit", label: "限定业务范围", kind: "object" },
        { id: "condition-unit", source: "condition", target: "unit", label: "作为查询条件", kind: "execution" },
      ] },
    };
    render(<EvidenceChainPanels view={semantic} />);
    const claim = screen.getByRole("region", { name: "参赛次数的解释路径" });
    expect(within(claim).getByText("赛事 = 决赛阶段")).toBeInTheDocument();
    expect(within(claim).getByText("按本体关系查询")).toBeInTheDocument();
    expect(within(claim).getAllByText("18")).toHaveLength(3);
  });

  it("shows each answer-producing process as an input-to-result business flow", () => {
    const semantic: EvidenceChainView = { ...view, execution: { nodes: [
      { id:"inventory", label:"计算业务指标", kind:"calculation", role:"process", status:"completed" },
      { id:"material-a", label:"物料", value:"165-001335", kind:"object", role:"input" },
      { id:"instant", label:"数据时点", value:"当前", kind:"field", role:"input" },
      { id:"available", label:"可用库存", value:"906 个", kind:"field", role:"output" },
      { id:"reverse", label:"调用业务函数", kind:"function", role:"process", status:"completed" },
      { id:"material-b", label:"物料", value:"165-001335", kind:"object", role:"input" },
      { id:"caliber", label:"统计口径", value:"BOM 根产品", kind:"field", role:"input" },
      { id:"products", label:"使用产品数", value:"3 个", kind:"field", role:"output" },
      { id:"definition", label:"读取对象定义", kind:"query", role:"context" },
    ], edges: [
      {id:"a1",source:"material-a",target:"inventory",label:"作为分析对象",kind:"execution"},
      {id:"a2",source:"instant",target:"inventory",label:"作为查询条件",kind:"execution"},
      {id:"a3",source:"inventory",target:"available",label:"返回",kind:"execution"},
      {id:"b1",source:"material-b",target:"reverse",label:"作为分析对象",kind:"execution"},
      {id:"b2",source:"caliber",target:"reverse",label:"作为统计口径",kind:"execution"},
      {id:"b3",source:"reverse",target:"products",label:"返回",kind:"execution"},
    ] } };
    render(<EvidenceChainPanels view={semantic} />);
    fireEvent.click(screen.getByRole("button", {name:"执行链路"}));
    const inventory = screen.getByRole("region", {name:"计算业务指标业务处理"});
    expect(inventory).toHaveTextContent("物料165-001335");
    expect(inventory).toHaveTextContent("数据时点当前");
    expect(inventory).toHaveTextContent("计算业务指标");
    expect(inventory).toHaveTextContent("可用库存906 个");
    const reverse = screen.getByRole("region", {name:"调用业务函数业务处理"});
    expect(reverse).toHaveTextContent("统计口径BOM 根产品");
    expect(reverse).toHaveTextContent("调用业务函数");
    expect(reverse).toHaveTextContent("使用产品数3 个");
    expect(inventory).toHaveAttribute("open");
    expect(reverse).not.toHaveAttribute("open");
    fireEvent.click(within(reverse).getAllByText("调用业务函数")[0]);
    expect(reverse).toHaveAttribute("open");
    fireEvent.click(within(reverse).getAllByText("调用业务函数")[0]);
    expect(reverse).not.toHaveAttribute("open");
    expect(screen.getByText("读取对象定义")).not.toBeVisible();
  });
  it("groups an explicitly linked orchestrator under its business operation", () => {
    const semantic: EvidenceChainView = { ...view, execution: { nodes: [
      { id: "container", label: "分析任务", kind: "function", role: "process", status: "completed", technical: "run_code" },
      { id: "query", label: "按本体关系查询", kind: "query", role: "process", status: "completed" },
      { id: "input", label: "比赛", kind: "object", role: "input" },
      { id: "output", label: "记录数", value: "18", kind: "field", role: "output" },
    ], edges: [
      { id: "parent", source: "container", target: "query", label: "引用上级操作", kind: "execution" },
      { id: "input-query", source: "input", target: "query", label: "作为分析对象", kind: "execution" },
      { id: "query-output", source: "query", target: "output", label: "返回", kind: "execution" },
    ] } };
    render(<EvidenceChainPanels view={semantic} initialPanel="execution" />);
    const flow = screen.getByRole("region", { name: "按本体关系查询业务处理" });
    expect(within(flow).getByText("上级编排步骤（1）")).toBeInTheDocument();
    expect(within(flow).getByText("分析任务")).not.toBeVisible();
    fireEvent.click(within(flow).getByText("上级编排步骤（1）"));
    expect(within(flow).getByText("分析任务")).toBeVisible();
    expect(screen.queryByText("run_code")).not.toBeInTheDocument();
  });
  it("opens the answer conclusion flow before an earlier scope-only flow", () => {
    const semantic: EvidenceChainView = { ...view, claims: [
      { id:"total", label:"可用库存合计", value:"100", role:"result", status:"located", nodeIds:["total-source"] },
      { id:"scope", label:"仓库数量", value:"29", role:"scope", status:"located", nodeIds:["scope-source"] },
    ], execution: { nodes: [
      { id:"warehouse-count", label:"仓库数量指标", kind:"calculation", role:"process" },
      { id:"scope-input", label:"库存范围", kind:"object", role:"input" },
      { id:"scope-output", label:"仓库数量", value:"29", kind:"field", role:"output" },
      { id:"total-inventory", label:"全网可用库存指标", kind:"calculation", role:"process" },
      { id:"total-input", label:"库存范围", kind:"object", role:"input" },
      { id:"total-output", label:"可用库存合计", value:"100", kind:"field", role:"output" },
    ], edges: [
      { id:"scope-in", source:"scope-input", target:"warehouse-count", label:"条件", kind:"execution" },
      { id:"scope-out", source:"warehouse-count", target:"scope-output", label:"返回", kind:"execution" },
      { id:"total-in", source:"total-input", target:"total-inventory", label:"条件", kind:"execution" },
      { id:"total-out", source:"total-inventory", target:"total-output", label:"返回", kind:"execution" },
    ] }, evidence: { nodes: [
      { id:"total-source", label:"全网库存返回", kind:"source", executionNodeId:"total-inventory" },
      { id:"scope-source", label:"仓库数量返回", kind:"source", executionNodeId:"warehouse-count" },
    ], edges: [] } };
    render(<EvidenceChainPanels view={semantic} />);
    fireEvent.click(screen.getByRole("button", {name:"执行链路"}));
    const total = screen.getByRole("region", {name:"全网可用库存指标业务处理"});
    const scope = screen.getByRole("region", {name:"仓库数量指标业务处理"});
    expect(total).toHaveAttribute("open");
    expect(scope).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "证据链" }));
    fireEvent.click(screen.getByRole("button", { name: /仓库数量29/ }));
    fireEvent.click(screen.getByRole("button", { name: "执行链路" }));
    expect(screen.getByRole("region", {name:"仓库数量指标业务处理"})).toHaveAttribute("open");
    expect(screen.getByRole("region", {name:"全网可用库存指标业务处理"})).not.toHaveAttribute("open");
  });
  it("keeps incomplete recorded links out of the business flow and available for troubleshooting", () => {
    const execution: EvidenceChainView["execution"] = {nodes:[
      {id:"a",label:"Query A",kind:"query"},{id:"x",label:"Result X",kind:"result"},
      {id:"y",label:"Result Y",kind:"result"},{id:"b",label:"Query B",kind:"query"}
    ],edges:[
      {id:"ax",source:"a",target:"x",label:"A result",kind:"execution"},
      {id:"xy",source:"x",target:"y",label:"Recorded bridge",kind:"execution"},
      {id:"yb",source:"y",target:"b",label:"B reference",kind:"execution"}
    ]};
    render(<EvidenceChainPanels view={{...view,execution}} />);
    fireEvent.click(screen.getByRole("button",{name:"执行链路"}));
    expect(screen.getByText("尚未形成完整的业务处理链路")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Result X")).not.toBeVisible();
    fireEvent.click(screen.getByText(/^技术执行记录/));
    expect(screen.getByText("Result X")).toBeVisible();
    expect(screen.getByText("Result Y")).toBeVisible();
  });
  it("keeps explicitly returned relationship paths in object scope with localized labels", () => {
    const relationView: EvidenceChainView = { ...view, claims: [{ id:"material", label:"Required material", value:"Material B", status:"located", nodeIds:["b"] }], evidence: {nodes:[{id:"a",label:"Product A",kind:"object"},{id:"b",label:"Material B",kind:"object"},{id:"r",label:"Recorded BOM relation",kind:"relation",role:"process"}],edges:[{id:"from",source:"a",target:"r",label:"Uses",kind:"relation"},{id:"to",source:"r",target:"b",label:"Component",kind:"relation"}]}};
    render(<EvidenceChainPanels view={relationView} />);
    const graph = screen.getByRole("region", {name:"依据图谱"});
    expect(within(graph).getByText("业务关系")).toBeInTheDocument();
    expect(within(graph).getAllByText("Material B").length).toBeGreaterThan(0);
    fireEvent.click(within(graph).getByRole("button",{name:"Uses"}));
    expect(screen.getByRole("dialog",{name:"关系详情"})).toHaveTextContent("Recorded BOM relation");
  });
  it("does not present unbound raw fields as answer conclusions", () => {
    const facts: EvidenceChainView = { ...view, claims: [], answer: "产品 P61-000351 的成品现货为 0。", evidence: { nodes: [
      { id: "product", label: "产品 P61-000351", kind: "object" },
      { id: "stock", label: "bom_material_code", value: "0", kind: "field" },
      { id: "source", label: "已记录对象查询", kind: "source", executionNodeId: "call" },
    ], edges: [
      { id: "owned", source: "product", target: "stock", label: "对象字段", kind: "object" },
      { id: "returned", source: "source", target: "stock", label: "返回值来源", kind: "value" },
    ] } };
    render(<EvidenceChainPanels view={facts} />);
    expect(screen.getByText("尚未形成可解释的答案结论")).toBeInTheDocument();
    expect(screen.getByText(/这轮记录没有把答案中的结论与业务证据明确绑定/)).toBeInTheDocument();
    expect(screen.queryByText("bom_material_code")).not.toBeInTheDocument();
    expect(screen.queryByText("已记录对象查询")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看已记录的业务过程" }));
    expect(screen.getByRole("button", { name: "执行链路" })).toHaveAttribute("aria-pressed", "true");
  });
  it("does not promote unrelated technical calls to business flows", () => {
    render(<EvidenceChainPanels view={view} />);
    fireEvent.click(screen.getByRole("button", {name:"执行链路"}));
    expect(screen.getByText("尚未形成完整的业务处理链路")).toBeInTheDocument();
    expect(screen.getByText("Inventory query")).not.toBeVisible();
    expect(screen.getByText("Other call")).not.toBeVisible();
    fireEvent.click(screen.getByText(/^技术执行记录/));
    expect(screen.getByText("Inventory query")).toBeVisible();
    expect(screen.getByText("Other call")).toBeVisible();
    expect(screen.queryByText("private-op-id")).not.toBeInTheDocument();
  });
  it("opens the selected business view in a full-screen reading layout", () => {
    render(<EvidenceChainPanels view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "全屏查看" }));
    const dialog = screen.getByRole("dialog", { name: "证据链全屏查看" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveTextContent("When?");
    fireEvent.click(screen.getByRole("button", { name: "执行链路" }));
    expect(screen.getByRole("dialog", { name: "执行链路全屏查看" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "退出全屏" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("routes unbound function output to the recorded execution instead of presenting it as an answer conclusion", () => {
    const functions: EvidenceChainView = { ...view, claims: [], answer: " ", execution: {nodes:[{id:"op1",label:"First calculation",kind:"function"},{id:"op2",label:"Second calculation",kind:"function"}],edges:[]}, evidence:{nodes:[{id:"s1",label:"First source",kind:"source",executionNodeId:"op1"},{id:"s2",label:"Second source",kind:"source",executionNodeId:"op2"},{id:"f1",label:"Delay",kind:"field",value:"24",executionNodeId:"op1"},{id:"f2",label:"Delay",kind:"field",value:"19",executionNodeId:"op2"}],edges:[{id:"e1",source:"s1",target:"f1",kind:"value",label:"Returned"},{id:"e2",source:"s2",target:"f2",kind:"value",label:"Returned"}]}};
    render(<EvidenceChainPanels view={functions} />);
    expect(screen.getByText("未记录答案正文")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看已记录的业务过程" }));
    expect(screen.getByText("尚未形成完整的业务处理链路")).toBeInTheDocument();
    expect(screen.getByText("First calculation")).not.toBeVisible();
    expect(screen.getByText("Second calculation")).not.toBeVisible();
  });
  it("opens semantic edge details and keeps metadata hidden until requested", () => {
    const evidence = { ...view.evidence, edges: [...view.evidence.edges, { id: "ctx", source: "unrelated", target: "date", label: "Business context", kind: "context" as const, technical: "context-pointer" }] };
    render(<EvidenceChainPanels view={{ ...view, evidence }} />);
    expect(screen.queryByRole("button", { name: "Business context" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Date difference" }));
    expect(screen.getByRole("dialog", { name: "关系详情" })).toHaveTextContent("来自已记录的关系或明确引用");
    fireEvent.click(screen.getByRole("checkbox", { name: "展开主键与业务条件" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Business context" }), { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "关系详情" })).toHaveTextContent("不作为计算输入或历史采用证明");
    expect(screen.getByText("context-pointer").closest("details")).not.toHaveAttribute("open");
  });
  it("navigates source to execution and back only through supplied references", () => {
    const evidence = { ...view.evidence, nodes: view.evidence.nodes.map(n => n.id === "date" ? { ...n, kind: "source" as const, executionNodeId: "call" } : n) };
    render(<EvidenceChainPanels view={{ ...view, evidence }} />);
    fireEvent.click(screen.getByRole("button", { name: /Available date/ }));
    fireEvent.click(screen.getByRole("button", { name: "在执行链路中查看 →" }));
    expect(screen.getByRole("button", { name: "执行链路" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "查看关联结论：Delay" }));
    expect(screen.getByRole("button", { name: "24 days" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "证据链" })).toHaveAttribute("aria-pressed", "true");
  });
  it("does not offer execution navigation without a recorded source reference", () => {
    render(<EvidenceChainPanels view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Available date/ }));
    expect(screen.queryByRole("button", { name: "在执行链路中查看 →" })).not.toBeInTheDocument();
  });
  it("does not link candidates even when their text matches", () => {
    render(<EvidenceChainPanels view={{ ...view, claims: [{ ...view.claims[0], status: "candidate" }] }} />);
    expect(screen.queryByRole("button", { name: "24 days" })).not.toBeInTheDocument();
  });
  it("supports Unicode offsets and safely traverses explicit cycles", () => {
    const cyclic = { ...view.evidence, edges: [...view.evidence.edges, { id: "back", source: "delay", target: "date", label: "Recorded reverse link" }] };
    render(<EvidenceChainPanels view={{ ...view, answer: "😀24 days", evidence: cyclic, claims: [{ ...view.claims[0], answerRange: { start: 1, end: 8, exact: "24 days" } }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "24 days" }));
    expect(screen.getByText("Available date")).toBeInTheDocument();
    expect(screen.queryByText("Unrelated material")).not.toBeInTheDocument();
  });
  it("opens only explicit upstream evidence for a bound answer fragment", () => {
    render(<EvidenceChainPanels view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "24 days" }));
    const graph = screen.getByRole("region", { name: "依据图谱" });
    expect(within(graph).getByText("Available date")).toBeInTheDocument();
    expect(within(graph).queryByText("Unrelated material")).not.toBeInTheDocument();
    expect(within(graph).getAllByText("Date difference").length).toBeGreaterThan(0);
  });
  it("does not fabricate connections between execution records", () => {
    render(<EvidenceChainPanels view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "执行链路" }));
    expect(screen.getByText("Inventory query")).not.toBeVisible();
    expect(screen.queryAllByTestId("chain-edge")).toHaveLength(0);
    fireEvent.click(screen.getByText(/^技术执行记录/));
    fireEvent.click(screen.getByRole("button", { name: /Inventory query/ }));
    expect(screen.getByText("private-op-id").closest("details")).not.toHaveAttribute("open");
  });
  it("rejects stale answer offsets and keeps unbound conclusions inspectable", () => {
    render(<EvidenceChainPanels view={{ ...view, answer: "Changed answer" }} />);
    expect(screen.queryByRole("button", { name: "24 days" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Stock/ }));
    expect(screen.getAllByText("该结论尚未绑定依据，不能从相同数值推断来源。")).toHaveLength(2);
  });
  it("clears selection when interaction changes and distinguishes missing answer", () => {
    const { rerender } = render(<EvidenceChainPanels view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Stock/ }));
    rerender(<EvidenceChainPanels view={{ ...view, interactionId: "next", answer: undefined, claims: [] }} />);
    expect(screen.getByText("未记录答案正文")).toBeInTheDocument();
    expect(screen.queryByText("该结论尚未绑定依据，不能从相同数值推断来源。")).not.toBeInTheDocument();
  });
});

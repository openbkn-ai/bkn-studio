/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import "@testing-library/jest-dom/vitest";
import "@/app/locales/i18n";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  it("separates answer scope from the primary business result", () => {
    render(<EvidenceChainPanels view={{...view, claims:[
      {id:"total",label:"可用库存合计",value:"100,508,026.49",role:"result",status:"located",nodeIds:["date"],derivation:{method:"direct_return",processName:"全网可用库存指标",boundary:"指标返回总量。",inputs:[],components:[]}},
      {id:"warehouses",label:"仓库数量",value:"29",role:"scope",status:"located",nodeIds:["delay"],derivation:{method:"direct_return",processName:"仓库数量指标",boundary:"指标返回统计范围。",inputs:[],components:[]}},
    ]}} />);
    const total = screen.getByRole("region", {name:"可用库存合计的解释路径"});
    const scope = screen.getByRole("region", {name:"仓库数量的解释路径"});
    expect(total).toHaveAttribute("open");
    expect(within(total).getByText("答案结论")).toBeInTheDocument();
    expect(within(scope).getByText("回答范围")).toBeInTheDocument();
  });
  it("explains conclusions with independently collapsible business steps and details", () => {
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
    const products = screen.getByRole("region", {name:"使用产品数的解释路径"});
    expect(inventory).toHaveAttribute("open");
    expect(products).not.toHaveAttribute("open");
    expect(within(inventory).getByText("物料可用库存指标")).toBeVisible();
    expect(within(inventory).getByText("20 + 1 + 77 + 121 + 9 + 1 + 677 = 906")).toBeVisible();
    expect(within(inventory).getByText("乌鲁木齐备件仓 · 可用")).not.toBeVisible();
    fireEvent.click(within(inventory).getByText(/查看 2 项分仓核验/));
    expect(within(inventory).getByText("乌鲁木齐备件仓 · 可用")).toBeVisible();
    fireEvent.click(within(products).getAllByText("使用产品数")[0]);
    expect(products).toHaveAttribute("open");
    expect(within(products).getByText("物料反查产品")).toBeVisible();
    expect(screen.getByRole("region", {name:"依据图谱"})).not.toBeVisible();
    fireEvent.click(screen.getByText("查看完整记录事实（排障）"));
    expect(screen.getByRole("region", {name:"依据图谱"})).toBeVisible();
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
    const flow = screen.getByRole("region", { name: "可用库存业务处理" });
    expect(within(flow).getByText("业务输入")).toBeInTheDocument();
    expect(within(flow).getByText("物料 165-001335")).toBeInTheDocument();
    expect(within(flow).getByText("计算业务指标")).toBeInTheDocument();
    expect(within(flow).getByText("业务结果")).toBeInTheDocument();
    expect(within(flow).getAllByText("906")).toHaveLength(2);
    expect(screen.queryByRole("combobox", { name: "选择业务处理" })).not.toBeInTheDocument();
    expect(screen.getByText("搜索工具")).not.toBeVisible();
    fireEvent.click(screen.getByText(/^技术执行记录/));
    expect(screen.getByText("搜索工具")).toBeInTheDocument();
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
    const flow = screen.getByRole("region", { name: "可用库存业务处理" });
    expect(within(flow).getAllByText("100,508,026.49")).toHaveLength(2);
    expect(within(flow).queryByText("29")).not.toBeInTheDocument();
  });

  it("does not invent a calculation path when only a located return value was recorded", () => {
    render(<EvidenceChainPanels view={{ ...view, claims: [{ id: "stock", label: "库存", value: "906", status: "located", nodeIds: ["date"] }] }} />);
    const claim = screen.getByRole("region", { name: "库存的解释路径" });
    expect(within(claim).getByText("证据边界：")).toBeVisible();
    expect(within(claim).queryByText("已记录的业务处理")).not.toBeInTheDocument();
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
    const inventory = screen.getByRole("region", {name:"可用库存业务处理"});
    expect(inventory).toHaveTextContent("物料165-001335");
    expect(inventory).toHaveTextContent("数据时点当前");
    expect(inventory).toHaveTextContent("计算业务指标");
    expect(inventory).toHaveTextContent("可用库存906 个");
    const reverse = screen.getByRole("region", {name:"使用产品数业务处理"});
    expect(reverse).toHaveTextContent("统计口径BOM 根产品");
    expect(reverse).toHaveTextContent("调用业务函数");
    expect(reverse).toHaveTextContent("使用产品数3 个");
    expect(inventory).toHaveAttribute("open");
    expect(reverse).not.toHaveAttribute("open");
    fireEvent.click(within(reverse).getAllByText("使用产品数")[0]);
    expect(reverse).toHaveAttribute("open");
    fireEvent.click(within(reverse).getAllByText("使用产品数")[0]);
    expect(reverse).not.toHaveAttribute("open");
    expect(screen.getByText("读取对象定义")).not.toBeVisible();
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
    const total = screen.getByRole("region", {name:"可用库存合计业务处理"});
    const scope = screen.getByRole("region", {name:"仓库数量业务处理"});
    expect(total).toHaveAttribute("open");
    expect(scope).not.toHaveAttribute("open");
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
    expect(within(graph).getByText("Material B")).toBeInTheDocument();
    fireEvent.click(within(graph).getByRole("button",{name:"Uses"}));
    expect(screen.getByRole("complementary",{name:"关系详情"})).toHaveTextContent("Recorded BOM relation");
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
    expect(screen.getByRole("complementary", { name: "关系详情" })).toHaveTextContent("来自已记录的关系或明确引用");
    fireEvent.click(screen.getByRole("checkbox", { name: "展开主键与业务条件" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Business context" }), { key: "Enter" });
    expect(screen.getByRole("complementary", { name: "关系详情" })).toHaveTextContent("不作为计算输入或历史采用证明");
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

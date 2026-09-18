/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EvidenceChainView } from "./evidence-chain.types";
import { BusinessProvenance016 } from "./BusinessProvenance016";

const view: EvidenceChainView = {
  interactionId: "interaction-016",
  status: "completed",
  question: "物料 M-1 有多少库存，它被哪些产品使用？",
  answer: "库存 906，使用产品为 P-1、P-2。",
  claims: [
    {
      id: "claim-stock",
      label: "库存为 906",
      value: "906",
      status: "located",
      supportStatus: "supported",
      nodeIds: ["evidence-stock"],
    },
    {
      id: "claim-product",
      label: "产品 P-1、P-2 使用该物料",
      status: "located",
      supportStatus: "supported",
      nodeIds: ["evidence-product"],
    },
  ],
  evidence: { nodes: [], edges: [] },
  execution: { nodes: [], edges: [] },
  generationStatus: "ready",
  questionPairs: [
    {
      id: "pair-stock",
      question: "物料 M-1 有多少库存？",
      answer: "906",
      summary: "库存",
      status: "supported",
      claimIds: ["claim-stock"],
    },
    {
      id: "pair-product",
      question: "物料 M-1 被哪些产品使用？",
      answer: "P-1、P-2",
      summary: "反查产品",
      status: "supported",
      claimIds: ["claim-product"],
    },
  ],
  selectedPairGraphs: {
    "pair-stock": {
      claims: [
        {
          id: "claim-stock",
          label: "库存为 906",
          value: "906",
          status: "located",
          supportStatus: "supported",
          nodeIds: ["evidence-stock"],
        },
      ],
      evidenceNodes: [
        { id: "evidence-stock", label: "库存汇总结果", kind: "result", value: "906" },
      ],
      businessFunctions: [
        {
          id: "function-stock",
          displayName: "汇总物料可用库存",
          capabilityKind: "sql_query",
          businessPurpose: "按仓库汇总指定物料的可用库存",
          businessInputs: [{ name: "物料编码", value: "M-1", sourceKind: "question" }],
          logicSummary: "过滤可用库存并按仓库求和",
          businessOutputs: [
            {
              summary: "可用库存 906",
              evidenceRefs: ["evidence-stock"],
              adoptedRowRefs: ["row:1"],
            },
          ],
          operationIds: ["op-sql"],
          supportsClaimIds: ["claim-stock"],
          schemaRefs: [],
          technicalExecution: {
            interfaceNames: ["run_sql"],
            inputPayloadRef: "artifact:sql-input",
            outputPayloadRef: "artifact:sql-output",
            completeness: "complete",
          },
          validationStatus: "valid",
        },
      ],
      executionSteps: [
        {
          id: "step-sql",
          operationId: "op-sql",
          attempt: 1,
          businessRole: "汇总库存",
          interfaceName: "run_sql",
          status: "completed",
          timeRailItemId: "time:op-sql:1",
        },
      ],
      schemaNodes: [],
      edges: [
        {
          edgeId: "step-function",
          kind: "implements",
          fromId: "step-sql",
          toId: "function-stock",
          operationIds: ["op-sql"],
          validationStatus: "verified",
        },
        {
          edgeId: "function-claim",
          kind: "supports",
          fromId: "function-stock",
          toId: "claim-stock",
          operationIds: ["op-sql"],
          validationStatus: "verified",
        },
        {
          edgeId: "evidence-claim",
          kind: "supports",
          fromId: "evidence-stock",
          toId: "claim-stock",
          operationIds: ["op-sql"],
          validationStatus: "verified",
        },
      ],
    },
    "pair-product": {
      claims: [
        {
          id: "claim-product",
          label: "产品 P-1、P-2 使用该物料",
          status: "located",
          supportStatus: "supported",
          nodeIds: ["evidence-product"],
        },
      ],
      evidenceNodes: [
        { id: "evidence-product", label: "产品实例", kind: "result", value: "P-1、P-2" },
      ],
      businessFunctions: [
        {
          id: "function-product",
          displayName: "通过物料反查产品",
          capabilityKind: "agent_composed_process",
          businessPurpose: "从物料经 BOM 找到产品",
          businessInputs: [{ name: "物料编码", value: "M-1", sourceKind: "question" }],
          logicSummary: "物料 → BOM → 产品",
          businessOutputs: [
            { summary: "产品 P-1、P-2", evidenceRefs: ["evidence-product"], adoptedRowRefs: [] },
          ],
          operationIds: ["op-bom", "op-product"],
          supportsClaimIds: ["claim-product"],
          schemaRefs: [],
          technicalExecution: {
            interfaceNames: ["query_object_instance"],
            completeness: "complete",
          },
          validationStatus: "valid",
        },
      ],
      executionSteps: [
        {
          id: "step-bom",
          operationId: "op-bom",
          attempt: 1,
          businessRole: "查询 BOM",
          interfaceName: "query_object_instance",
          status: "completed",
          timeRailItemId: "time:op-bom:1",
        },
        {
          id: "step-product",
          operationId: "op-product",
          attempt: 1,
          businessRole: "查询产品",
          interfaceName: "query_object_instance",
          status: "completed",
          timeRailItemId: "time:op-product:1",
        },
      ],
      schemaNodes: [],
      edges: [
        {
          edgeId: "product-claim",
          kind: "supports",
          fromId: "function-product",
          toId: "claim-product",
          operationIds: ["op-bom", "op-product"],
          validationStatus: "verified",
        },
      ],
    },
  },
  timeRail: [
    {
      id: "time:op-sql:1",
      order: 1,
      operation_id: "op-sql",
      attempt: 1,
      interface_name: "run_sql",
      protocol: "mcp",
      status: "completed",
      started_at: "2026-09-16T08:00:00Z",
      input: {
        mode: "inline",
        media_type: "application/json",
        byte_length: 120,
        inline: {
          query:
            "SELECT SUM(available_qty) FROM inventory_view WHERE material_code = :material_code",
          params: { material_code: "M-1" },
        },
      },
      output: {
        mode: "inline",
        media_type: "application/json",
        byte_length: 18,
        inline: { total: 906 },
      },
    },
  ],
};

describe("BusinessProvenance016", () => {
  it("uses question pairs as the business entry point and changes the active provenance", () => {
    render(<BusinessProvenance016 view={view} />);
    expect(screen.getByRole("heading", { name: "汇总物料可用库存" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /反查产品/ }));
    expect(screen.getByRole("heading", { name: "通过物料反查产品" })).toBeTruthy();
    expect(screen.getByText("物料 → BOM → 产品")).toBeTruthy();
  });

  it("shows the real interface behind the business function on demand", () => {
    render(<BusinessProvenance016 view={view} />);
    expect(screen.queryByText("artifact:sql-input")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /技术执行/ }));
    expect(screen.getAllByText("run_sql").length).toBeGreaterThan(0);
    expect(screen.getByText("artifact:sql-input")).toBeTruthy();
    expect(screen.getByText("op-sql")).toBeTruthy();
    expect(screen.getByText(/SELECT SUM\(available_qty\)/)).toBeTruthy();
  });

  it("counts technical executions by operation rather than unique interface name", () => {
    render(<BusinessProvenance016 view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /反查产品/ }));
    expect(screen.getByRole("button", { name: "查看技术执行（2）" })).toBeTruthy();
  });

  it("switches to a graph built from persisted nodes and expands technical execution", () => {
    render(<BusinessProvenance016 view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "图谱模式" }));
    expect(screen.getByText("库存汇总结果")).toBeTruthy();
    expect(screen.queryByText("汇总库存")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /技术执行层/ }));
    expect(screen.getByText("汇总库存")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /库存为 906/ }));
    expect(screen.getByRole("complementary", { name: "节点详情" })).toHaveTextContent("支持证据");
  });

  it("expands one selected conclusion path at a time when a question has many conclusions", () => {
    const claims = Array.from({ length: 18 }, (_, index) => ({
      id: `claim-${index + 1}`,
      label: `结论 ${index + 1}`,
      value: `${index + 1}`,
      status: "located" as const,
      supportStatus: "supported" as const,
      nodeIds: ["evidence-stock"],
    }));
    const graph = {
      ...view.selectedPairGraphs!["pair-stock"],
      claims,
      edges: [
        ...view.selectedPairGraphs!["pair-stock"].edges.filter(
          (edge) => !edge.toId.startsWith("claim"),
        ),
        ...claims.map((claim, index) => ({
          edgeId: `support-${index}`,
          kind: "supports",
          fromId: "function-stock",
          toId: claim.id,
          operationIds: ["op-sql"],
          validationStatus: "verified" as const,
        })),
      ],
    };
    render(
      <BusinessProvenance016
        view={{
          ...view,
          claims,
          questionPairs: [{ ...view.questionPairs![0], claimIds: claims.map((claim) => claim.id) }],
          selectedPairGraphs: { ...view.selectedPairGraphs, "pair-stock": graph },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "图谱模式" }));
    expect(screen.getByRole("button", { name: "回答结论：结论 1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "回答结论：结论 18" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "选择回答结论" }), {
      target: { value: "claim-18" },
    });
    expect(screen.getByRole("button", { name: "回答结论：结论 18" })).toBeTruthy();
  });

  it("renders the answer as Markdown and keeps a long answer collapsed until requested", () => {
    const markdownView: EvidenceChainView = {
      ...view,
      questionPairs: [
        {
          ...view.questionPairs![0],
          answer: "共 **2** 项。\n\n| 球员 | 进球 |\n|---|---:|\n| Messi | 7 |\n| Zidane | 3 |",
        },
      ],
    };
    render(<BusinessProvenance016 view={markdownView} />);
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "P" && element.textContent === "共 2 项。",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "球员" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看完整回答" }));
    expect(screen.getByRole("columnheader", { name: "球员" })).toBeTruthy();
  });

  it("shows many member conclusions as a compact table instead of expanded cards", () => {
    const claims = Array.from({ length: 18 }, (_, index) => ({
      id: `claim-${index + 1}`,
      label: `球员 ${index + 1} 在同届世界杯达到门槛`,
      value: `${index + 3}、Team ${index + 1}`,
      status: "located" as const,
      supportStatus: "supported" as const,
      nodeIds: ["evidence-stock"],
    }));
    const memberView: EvidenceChainView = {
      ...view,
      claims,
      questionPairs: [{ ...view.questionPairs![0], claimIds: claims.map((item) => item.id) }],
      selectedPairGraphs: {
        ...view.selectedPairGraphs,
        "pair-stock": { ...view.selectedPairGraphs!["pair-stock"], claims },
      },
    };
    render(<BusinessProvenance016 view={memberView} />);
    const table = screen.getByRole("table", { name: "回答结论" });
    expect(within(table).getAllByRole("row")).toHaveLength(19);
    expect(within(table).getByText("球员 18 在同届世界杯达到门槛")).toBeTruthy();
  });

  it("uses the deterministic time rail with a compact inspector", () => {
    render(<BusinessProvenance016 view={view} panel="timeline" />);
    expect(screen.getByRole("heading", { name: "确定性时间链" })).toBeTruthy();
    expect(screen.getAllByText("run_sql").length).toBeGreaterThan(1);
    expect(screen.getByText("op-sql")).toBeTruthy();
    expect(screen.getByText(/SELECT SUM\(available_qty\)/)).toBeTruthy();
    expect(screen.queryByText("汇总物料可用库存")).toBeNull();
  });

  it("supports a full-screen provenance workspace", () => {
    render(<BusinessProvenance016 view={view} />);
    const enter = screen.getByRole("button", { name: "全屏查看" });
    expect(enter).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(enter);
    expect(screen.getByRole("button", { name: "退出全屏" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps question cards visible when attribution has not produced a graph", () => {
    render(
      <BusinessProvenance016
        view={{ ...view, generationStatus: "analysis_pending", selectedPairGraphs: {} }}
        evidenceOnly
      />,
    );
    expect(screen.getByRole("button", { name: /库存，证据成立/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /反查产品，证据成立/ })).toBeTruthy();
    expect(screen.getByText("本轮已保留问答记录，但尚未形成可展示的归因图。")).toBeTruthy();
  });

  it("uses one selected conclusion in both reading and graph modes", () => {
    const secondClaim = {
      id: "claim-stock-2",
      label: "生产可用库存为 0",
      value: "0",
      status: "located" as const,
      supportStatus: "partial" as const,
      nodeIds: ["evidence-stock"],
    };
    const graph = {
      ...view.selectedPairGraphs!["pair-stock"],
      claims: [...view.selectedPairGraphs!["pair-stock"].claims, secondClaim],
    };
    render(
      <BusinessProvenance016
        view={{
          ...view,
          claims: [...view.claims, secondClaim],
          questionPairs: [{ ...view.questionPairs![0], claimIds: ["claim-stock", secondClaim.id] }],
          selectedPairGraphs: { "pair-stock": graph },
        }}
        evidenceOnly
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "查看回答结论：生产可用库存为 0" }));
    fireEvent.click(screen.getByRole("button", { name: "图谱模式" }));
    expect(screen.getByRole("combobox", { name: "选择回答结论" })).toHaveValue(secondClaim.id);
    expect(screen.getByRole("button", { name: "回答结论：生产可用库存为 0" })).toBeTruthy();
  });

  it("does not repeat the page-level timeline tabs in the embedded evidence view", () => {
    render(<BusinessProvenance016 view={view} evidenceOnly />);
    expect(screen.queryByRole("tab", { name: "时间链" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "证据链" })).toBeNull();
    expect(screen.getByRole("button", { name: "全屏查看" })).toBeTruthy();
  });
});

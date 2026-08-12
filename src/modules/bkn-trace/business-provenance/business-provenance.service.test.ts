/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: { get: getMock, post: postMock } }));
vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: "/api",
    currentUser: { businessDomainId: "bd_demo" },
    auth: { tokenManager: { getAccessToken: () => "token", refreshAccessToken: vi.fn() } },
  }),
}));

describe("EE business provenance service", () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); });

  it("reads the EE conversation list rather than the removed community endpoint", async () => {
    getMock.mockResolvedValue({ data: { entries: [{ conversation_id: "conv-1" }], total: 1 } });
    const { getBusinessProvenanceConversations } = await import("./business-provenance.service");

    const page = await getBusinessProvenanceConversations({ page: 2, pageSize: 20, keyword: "采购" });

    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/business-provenance/conversations",
      { headers: { "x-business-domain": "bd_demo" }, params: { page: 2, page_size: 20, keyword: "采购" } },
    );
    expect(page.entries[0]?.conversationId).toBe("conv-1");
  });

  it("reads an interaction projection and its canonical Markdown from EE", async () => {
    getMock
      .mockResolvedValueOnce({ data: {
        interaction_id: "int-1",
        conversation_context: [{ knowledge_network_id: "supply", source_interaction_id: "int-prior", source_operation_id: "op-prior" }],
        derived_facts: [{ rule: "changed_query_still_zero_result", source_operation_id: "op-0", operation_id: "op-1", element_id: "purchase_order" }],
        operations: [{ operation_id: "op-1", status: "ambiguous", query: { resources: [{ id: "resource_po", name: "supply.bkn_supply_po", object_id: "purchase_order", object_name: "采购订单" }] }, objects: [{ id: "purchase_order", name: "采购订单" }, { id: "purchase_request", name: "采购申请" }], elements: [{ kind: "property", id: "available_qty", name: "可用库存", parent_id: "inventory", field: "available_qty" }] }],
      } })
      .mockResolvedValueOnce({ data: "# 当前交互轮次业务溯源" });
    const { getBusinessProvenanceInteraction, getBusinessProvenanceMarkdown } = await import("./business-provenance.service");

    const [projection, markdown] = await Promise.all([
      getBusinessProvenanceInteraction("int-1"), getBusinessProvenanceMarkdown("int-1"),
    ]);

    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/business-provenance/interactions/int-1",
      { headers: { "x-business-domain": "bd_demo" } },
    );
    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/business-provenance/interactions/int-1/markdown",
      { headers: { "x-business-domain": "bd_demo" }, responseType: "text" },
    );
    expect(projection.operations[0]?.operationId).toBe("op-1");
    expect(projection.operations[0]?.elements[0]).toMatchObject({ parentId: "inventory", field: "available_qty" });
    expect(projection.operations[0]?.objects).toEqual([{ id: "purchase_order", name: "采购订单" }, { id: "purchase_request", name: "采购申请" }]);
    expect(projection.operations[0]?.query?.resources).toEqual([{ id: "resource_po", name: "supply.bkn_supply_po", objectId: "purchase_order", objectName: "采购订单" }]);
    expect(projection.conversationContext).toEqual([{ knowledgeNetworkId: "supply", sourceInteractionId: "int-prior", sourceOperationId: "op-prior" }]);
    expect(projection.derivedFacts).toEqual([{ rule: "changed_query_still_zero_result", sourceOperationId: "op-0", operationId: "op-1", elementId: "purchase_order" }]);
    expect(markdown).toContain("当前交互轮次");
  });

  it("loads interaction rounds only for the selected conversation", async () => {
    getMock.mockResolvedValue({ data: { entries: [{ interaction_id: "int-1", conversation_id: "conv-1" }], total: 1 } });
    const { getBusinessProvenanceInteractions } = await import("./business-provenance.service");
    await getBusinessProvenanceInteractions({ conversationId: "conv-1", page: 1, pageSize: 20 });
    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/business-provenance/interactions",
      { headers: { "x-business-domain": "bd_demo" }, params: { conversation_id: "conv-1", page: 1, page_size: 20 } },
    );
  });

  it("streams the server-configured provenance Agent and returns its structured result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      'event: token\ndata: {"content":"正在分析"}\n\nevent: structured\ndata: {"content":{"decision":"no_change","summary":"事实完整。","recommendations":[]}}\n\nevent: done\ndata: {"status":"completed"}\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const tokens: string[] = [];
    const { streamBusinessProvenanceAnalysis } = await import("./business-provenance.service");
    await expect(streamBusinessProvenanceAnalysis("int-1", "# 已确认 Markdown", (token) => tokens.push(token))).resolves.toMatchObject({ decision: "no_change", summary: "事实完整。" });
    expect(tokens).toEqual(["正在分析"]);
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[0]).toBe("/api/agent-observability/v1/business-provenance/interactions/int-1/analysis");
    expect(request[1]).toMatchObject({ method: "POST", body: JSON.stringify({ markdown: "# 已确认 Markdown" }), headers: { Authorization: "Bearer token", Accept: "text/event-stream", "Content-Type": "application/json" } });
  });

  it("shows the normalized stream failure without exposing an empty result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      'event: error\ndata: {"code":"analysis_agent_failed","message":"BKN Agent 分析失败，请稍后重试"}\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } },
    )));
    const { streamBusinessProvenanceAnalysis } = await import("./business-provenance.service");
    await expect(streamBusinessProvenanceAnalysis("int-1", "# 待分析 Markdown")).rejects.toMatchObject({ code: "analysis_agent_failed", message: "BKN Agent 分析失败，请稍后重试" });
  });

  it("reads immutable analysis history for the selected interaction", async () => {
    getMock.mockResolvedValue({ data: { entries: [{ analysis_id: "analysis-1", interaction_id: "int-1", status: "completed", result: { decision: "no_change" }, started_at: "2026-08-11T10:00:00Z" }] } });
    const { getBusinessProvenanceAnalysisHistory } = await import("./business-provenance.service");
    await expect(getBusinessProvenanceAnalysisHistory("int-1")).resolves.toMatchObject([{ analysisId: "analysis-1", status: "completed", result: { decision: "no_change" } }]);
  });
});

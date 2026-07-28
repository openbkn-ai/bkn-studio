/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const runtimeConfigMock = vi.hoisted(() => ({
  currentUser: { businessDomainId: "bd_demo" },
}));

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => runtimeConfigMock,
}));

describe("bkn-trace service", () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
  });

  it("fetches trace graph through the BKN Trace API", async () => {
    getMock.mockResolvedValue({
      data: {
        trace_id: "trace_001",
        status: "ok",
        duration_nano: 120,
        partial: false,
        partial_reason: [],
        page: { node_count: 1, edge_count: 0, truncated: false },
        data: { nodes: [], edges: [] },
      },
    });
    const { getTraceGraph } = await import("@/modules/bkn-trace/services/trace.service");

    const result = await getTraceGraph("trace_001");

    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/traces/trace_001/trace-graph",
      { headers: { "x-business-domain": "bd_demo" } },
    );
    expect(result.traceId).toBe("trace_001");
    expect(result.status).toBe("ok");
  });

  it("fetches request-scoped evidence views without raw OpenSearch access", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          trace_id: "trace_001",
          "bkn.request.id": "req_001",
          partial: false,
          partial_reason: [],
          visibility_summary: {
            authorized_ref_count: 1,
            redacted_ref_count: 0,
            hidden_ref_count: 0,
            omitted_ref_count: 0,
            unresolved_ref_count: 0,
          },
          page: { node_count: 1, edge_count: 0, truncated: false },
          data: {
            artifact_links: [{
              artifact_ref: "artifact:art_question_001",
              artifact_type: "question",
              role: "question_artifact_ref",
              event_id: "evt_started",
              event_type: "agent.interaction.started",
              operation_id: "op-1",
            }],
            claims: [],
            evidence_refs: [],
            business_refs: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          trace_id: "trace_001",
          "bkn.request.id": "req_001",
          partial: false,
          partial_reason: [],
          visibility_summary: {
            authorized_ref_count: 1,
            redacted_ref_count: 0,
            hidden_ref_count: 0,
            omitted_ref_count: 0,
            unresolved_ref_count: 0,
          },
          page: { node_count: 1, edge_count: 0, truncated: false },
          data: { nodes: [], edges: [] },
        },
      });
    const { getEvidenceChain, getBusinessGraph } = await import(
      "@/modules/bkn-trace/services/trace.service"
    );

    const chain = await getEvidenceChain({ requestId: "req_001", limit: 50 });
    await getBusinessGraph({ requestId: "req_001", limit: 50 });

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      "/agent-observability/v1/traces/by-request",
      {
        headers: { "x-business-domain": "bd_demo" },
        params: { request_id: "req_001", limit: 50 },
      },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/agent-observability/v1/traces/by-request/business-graph",
      {
        headers: { "x-business-domain": "bd_demo" },
        params: { request_id: "req_001", limit: 50 },
      },
    );
    expect(getMock.mock.calls.flat().join(" ")).not.toContain("_search");
    expect(chain.data.artifactLinks[0]).toEqual({
      artifactRef: "artifact:art_question_001",
      artifactType: "question",
      claimId: undefined,
      eventId: "evt_started",
      eventType: "agent.interaction.started",
      operationId: "op-1",
      role: "question_artifact_ref",
    });
  });

  it("maps five-stage business graph nodes and semantic edges", async () => {
    getMock.mockResolvedValue({
      data: {
        trace_id: "trace_story",
        "bkn.request.id": "req_story",
        data: {
          nodes: [{
            id: "event:evt_data",
            node_type: "operation",
            stage: "execution",
            label: "data.query.observed",
            display: {
              name: "客户生命周期价值查询",
              business_path: ["客户", "ltv"],
              controlled_summary: "读取客户生命周期价值属性",
              resolution_status: "resolved",
              source_version: "v17",
            },
            event_id: "evt_data",
            interaction_id: "interaction_1",
            operation_id: "operation_data",
            properties: { event_type: "data.query.observed", row_count: 3 },
          }],
          edges: [{
            id: "edge:1",
            source_id: "event:evt_data",
            target_id: "claim:claim_1",
            edge_type: "supports",
            visibility: "visible",
          }],
        },
      },
    });
    const { getBusinessGraph } = await import("@/modules/bkn-trace/services/trace.service");

    const graph = await getBusinessGraph({ traceId: "trace_story" });

    expect(graph.data.nodes[0]).toMatchObject({
      eventId: "evt_data",
      interactionId: "interaction_1",
      nodeType: "operation",
      operationId: "operation_data",
      stage: "execution",
      display: {
        businessPath: ["客户", "ltv"],
        controlledSummary: "读取客户生命周期价值属性",
        name: "客户生命周期价值查询",
        resolutionStatus: "resolved",
        sourceVersion: "v17",
      },
    });
    expect(graph.data.edges[0]).toEqual({
      edgeType: "supports",
      id: "edge:1",
      sourceId: "event:evt_data",
      targetId: "claim:claim_1",
      visibility: "visible",
    });
  });

  it("lists observable business requests with product-facing summaries", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{
          request_id: "req_business_001",
          started_at: "2026-07-27T09:00:00Z",
          completed_at: "2026-07-27T09:00:03Z",
          initiator: "业务分析员",
          agent_or_app: "risk-agent",
          business_domain: "customer-risk",
          knowledge_networks: ["customer-risk-network"],
          question_preview: "客户 A 的风险为什么上升？",
          result_preview: "近 7 天投诉增加，风险等级上升。",
          status: "completed",
          evidence_completeness: "complete",
          business_refs: ["bkn://customer/A"],
          action_summary: { recommended: 1, approved: 0, executed: 0, completed: 0 },
          trace_count: 2,
          duration_ms: 3000,
        }],
        total: 1,
        next_cursor: "cursor-2",
        truncated: false,
        partial: false,
      },
    });
    const { getRequestSummaries } = await import(
      "@/modules/bkn-trace/services/trace.service"
    );

    const page = await getRequestSummaries({
      agentOrApp: "risk-agent",
      businessDomain: "customer-risk",
      cursor: "cursor-1",
      evidenceCompleteness: "complete",
      from: "2026-07-27T00:00:00Z",
      keyword: "客户 A",
      knowledgeNetwork: "customer-risk-network",
      limit: 30,
      status: "completed",
      to: "2026-07-28T00:00:00Z",
    });

    expect(getMock).toHaveBeenCalledWith("/agent-observability/v1/requests", {
      headers: { "x-business-domain": "bd_demo" },
      params: {
        agent_or_app: "risk-agent",
        business_domain: "customer-risk",
        cursor: "cursor-1",
        evidence_completeness: "complete",
        from: "2026-07-27T00:00:00Z",
        keyword: "客户 A",
        knowledge_network: "customer-risk-network",
        limit: 30,
        status: "completed",
        to: "2026-07-28T00:00:00Z",
      },
    });
    expect(page.entries[0]).toMatchObject({
      requestId: "req_business_001",
      questionPreview: "客户 A 的风险为什么上升？",
      resultPreview: "近 7 天投诉增加，风险等级上升。",
      evidenceCompleteness: "complete",
      traceCount: 2,
    });
    expect(page.nextCursor).toBe("cursor-2");
  });

  it("loads one request, its traces, and authorized artifact content", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          request_id: "req_business_001",
          question_preview: "业务问题",
          result_preview: "业务结论",
          status: "completed",
          evidence_completeness: "complete",
          action_summary: {},
          trace_count: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          entries: [{
            trace_id: "trace_001",
            request_id: "req_business_001",
            root_operation: "bkn.agent.chat",
            status: "completed",
            span_count: 7,
          }],
          total: 1,
          next_cursor: null,
          truncated: false,
          partial: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          artifact_id: "art_result_001",
          artifact_type: "result",
          "bkn.request.id": "req_business_001",
          trace_id: "trace_001",
          content_type: "application/json",
          schema_version: "2.2.0",
          observed_at: "2026-07-27T09:00:03Z",
          content_hash: "sha256:result",
          content: { conclusion: "业务结论", score: 0.91 },
          business_refs: ["bkn://customer/A"],
          business_domain: "customer-risk",
          "bkn.account.id": "acct-1",
          "bkn.account.type": "user",
        },
      });
    const { getEvidenceArtifact, getRequestSummary, getRequestTraces } = await import(
      "@/modules/bkn-trace/services/trace.service"
    );

    const summary = await getRequestSummary("req_business_001");
    const traces = await getRequestTraces("req_business_001", { limit: 30 });
    const artifact = await getEvidenceArtifact("art_result_001");

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      "/agent-observability/v1/requests/req_business_001",
      { headers: { "x-business-domain": "bd_demo" } },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/agent-observability/v1/requests/req_business_001/traces",
      { headers: { "x-business-domain": "bd_demo" }, params: { limit: 30 } },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      3,
      "/agent-observability/v1/evidence/artifacts/art_result_001",
      { headers: { "x-business-domain": "bd_demo" } },
    );
    expect(summary.requestId).toBe("req_business_001");
    expect(traces.entries[0].requestId).toBe("req_business_001");
    expect(artifact.content).toEqual({ conclusion: "业务结论", score: 0.91 });
  });

  it("maps and sends conversation lifecycle identifiers", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        entries: [{
          request_id: "req_round_001",
          conversation_id: "thread_supply_chain",
          interaction_id: "interaction_june_forecast",
          status: "completed",
        }],
        total: 1,
      },
    });
    const { getRequestSummaries } = await import(
      "@/modules/bkn-trace/services/trace.service"
    );

    const page = await getRequestSummaries({
      conversationId: "thread_supply_chain",
      interactionId: "interaction_june_forecast",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/requests",
      {
        headers: { "x-business-domain": "bd_demo" },
        params: {
          conversation_id: "thread_supply_chain",
          interaction_id: "interaction_june_forecast",
        },
      },
    );
    expect(page.entries[0]).toMatchObject({
      conversationId: "thread_supply_chain",
      interactionId: "interaction_june_forecast",
    });
  });

  it("loads a complete interaction spanning multiple requests", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        interaction_id: "interaction_june_forecast",
        conversation_id: "thread_supply_chain",
        status: "completed",
        requests: [
          { request_id: "req_schema", interaction_id: "interaction_june_forecast" },
          { request_id: "req_sql", interaction_id: "interaction_june_forecast" },
        ],
        traces: [
          { trace_id: "trace_schema", request_id: "req_schema" },
          { trace_id: "trace_sql", request_id: "req_sql" },
        ],
      },
    });
    const { getInteractionSummary } = await import(
      "@/modules/bkn-trace/services/trace.service"
    );

    const interaction = await getInteractionSummary("interaction_june_forecast");

    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/interactions/interaction_june_forecast",
      { headers: { "x-business-domain": "bd_demo" } },
    );
    expect(interaction.requests.map((item) => item.requestId)).toEqual([
      "req_schema",
      "req_sql",
    ]);
    expect(interaction.traces.map((item) => item.traceId)).toEqual([
      "trace_schema",
      "trace_sql",
    ]);
  });
});

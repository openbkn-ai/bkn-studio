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
    locale: "en-US",
    auth: { tokenManager: { getAccessToken: () => "token", refreshAccessToken: vi.fn() } },
  }),
}));

describe("EE business provenance service", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("restores shared time-rail payloads by operation and attempt without replacing distinct historical content", async () => {
    const input = {
      mode: "inline",
      media_type: "application/json",
      byte_length: 20,
      inline: { original: "中文" },
    };
    const retry = { ...input, inline: { original: "retry" } };
    getMock.mockResolvedValue({
      data: {
        interaction_id: "int-shared",
        time_rail_payloads_shared: true,
        time_rail: [
          {
            operation_id: "op",
            attempt: 1,
            input: { ...input, inline: undefined, shared_inline: true },
            output: { ...retry, inline: undefined, shared_inline: true },
          },
          {
            operation_id: "op",
            attempt: 2,
            input: { ...retry, inline: undefined, shared_inline: true },
            error: { ...input, inline: undefined, shared_inline: true },
          },
          { operation_id: "op", attempt: 1, input: { ...input, inline: "distinct" } },
          { operation_id: "op", attempt: 1, input: { mode: "ref", ref: "original-ref" } },
        ],
        operations: [
          { operation_id: "op", attempt: 2, input: retry, error: input },
          { operation_id: "op", attempt: 1, input, output: retry },
        ],
      },
    });
    const { getBusinessProvenanceInteraction } = await import("./business-provenance.service");
    const value = await getBusinessProvenanceInteraction("int-shared");
    expect(value.timeRail?.[0]?.input).toEqual(input);
    expect(value.timeRail?.[0]?.output).toEqual(retry);
    expect(value.timeRail?.[1]?.input).toEqual(retry);
    expect(value.timeRail?.[1]?.error).toEqual(input);
    expect(value.timeRail?.[2]?.input.inline).toBe("distinct");
    expect(value.timeRail?.[3]?.input).toEqual({ mode: "ref", ref: "original-ref" });
    expect(value.operations[1]?.input).toEqual(input);
  });

  it("keeps zero and first attempts distinct when restoring shared inline values", async () => {
    getMock.mockResolvedValue({
      data: {
        time_rail_payloads_shared: true,
        operations: [
          { operation_id: "op", attempt: 1, input: { inline: "first" } },
          { operation_id: "op", attempt: 0, input: { inline: "zero" } },
        ],
        time_rail: [0, 1].map((attempt) => ({
          operation_id: "op",
          attempt,
          input: { shared_inline: true },
        })),
      },
    });
    const { getBusinessProvenanceInteraction } = await import("./business-provenance.service");
    const value = await getBusinessProvenanceInteraction("int-attempts");
    expect(value.timeRail?.map((item) => item.input.inline)).toEqual(["zero", "first"]);
  });

  it.each(["missing operation", "missing inline"])(
    "rejects %s for an explicitly shared field instead of displaying it as unrecorded",
    async (reason) => {
      getMock.mockResolvedValue({
        data: {
          time_rail_payloads_shared: true,
          operations:
            reason === "missing operation"
              ? []
              : [{ operation_id: "op", attempt: 1, input: { mode: "ref", ref: "recorded-ref" } }],
          time_rail: [{ operation_id: "op", attempt: 1, input: { shared_inline: true } }],
        },
      });
      const { getBusinessProvenanceInteraction } = await import("./business-provenance.service");
      await expect(getBusinessProvenanceInteraction("int-invalid")).rejects.toThrow(
        /shared time-rail/,
      );
    },
  );

  it("silences the expected missing-EE-route response while reading the conversation list", async () => {
    getMock.mockResolvedValue({ data: { entries: [{ conversation_id: "conv-1" }], total: 1 } });
    const { getBusinessProvenanceConversations } = await import("./business-provenance.service");

    const page = await getBusinessProvenanceConversations({
      page: 2,
      pageSize: 20,
      keyword: "采购",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/business-provenance/conversations",
      {
        params: { page: 2, page_size: 20, keyword: "采购" },
        skipErrorToast: true,
      },
    );
    expect(page.entries[0]?.conversationId).toBe("conv-1");
  });

  it.each(["partial", "truncated"])(
    "preserves %s query metadata and marks unread previews",
    async (field) => {
      getMock.mockResolvedValue({
        data: {
          entries: [{ conversation_id: "conv-1" }],
          total: 1,
          [field]: true,
          partial_reasons: ["projection_scan_cap_reached"],
        },
      });
      const { getBusinessProvenanceConversations } = await import("./business-provenance.service");
      const page = await getBusinessProvenanceConversations();
      expect(page).toMatchObject({
        [field]: true,
        partialReasons: ["projection_scan_cap_reached"],
      });
      expect(page.entries[0]).toMatchObject({ previewUnavailable: true });
    },
  );

  it("preserves incomplete interaction preview context for the round navigation", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{ interaction_id: "int-1" }],
        total: 1,
        partial: true,
        truncated: true,
        partial_reasons: ["projection_scan_cap_reached"],
      },
    });
    const { getBusinessProvenanceInteractions } = await import("./business-provenance.service");
    const page = await getBusinessProvenanceInteractions({ conversationId: "conv-1" });
    expect(page).toMatchObject({
      partial: true,
      truncated: true,
      partialReasons: ["projection_scan_cap_reached"],
    });
    expect(page.entries[0]).toMatchObject({ previewUnavailable: true });
  });

  it("reads an interaction projection and its canonical Markdown from EE", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          time_rail: [
            {
              id: "time:child:1",
              operation_id: "child",
              parent_operation_id: "function",
              order: 1,
            },
          ],
          interaction_id: "int-1",
          interaction_question: "完整问题",
          interaction_result: "## 完整回答",
          conversation_context: [
            {
              knowledge_network_id: "supply",
              source_interaction_id: "int-prior",
              source_operation_id: "op-prior",
            },
          ],
          derived_facts: [
            {
              rule: "changed_query_still_zero_result",
              source_operation_id: "op-0",
              operation_id: "op-1",
              element_id: "purchase_order",
            },
          ],
          operations: [
            {
              operation_id: "op-1",
              status: "ambiguous",
              query: {
                resources: [
                  {
                    id: "resource_po",
                    name: "supply.bkn_supply_po",
                    object_id: "purchase_order",
                    object_name: "采购订单",
                  },
                ],
              },
              objects: [
                { id: "purchase_order", name: "采购订单" },
                { id: "purchase_request", name: "采购申请" },
              ],
              elements: [
                {
                  kind: "property",
                  id: "available_qty",
                  name: "可用库存",
                  parent_id: "inventory",
                  field: "available_qty",
                },
              ],
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: "# 当前交互轮次业务溯源" });
    const { getBusinessProvenanceInteraction, getBusinessProvenanceMarkdown } =
      await import("./business-provenance.service");

    const [projection, markdown] = await Promise.all([
      getBusinessProvenanceInteraction("int-1"),
      getBusinessProvenanceMarkdown("int-1"),
    ]);

    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/business-provenance/interactions/int-1",
      { skipErrorToast: true, params: { deduplicate_payloads: true } },
    );
    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/business-provenance/interactions/int-1/markdown",
      { responseType: "text" },
    );
    expect(projection.timeRail?.[0]).toMatchObject({
      operation_id: "child",
      parent_operation_id: "function",
    });
    expect(projection.operations[0]?.operationId).toBe("op-1");
    expect(projection).toMatchObject({
      interactionQuestion: "完整问题",
      interactionResult: "## 完整回答",
    });
    expect(projection.operations[0]?.elements[0]).toMatchObject({
      parentId: "inventory",
      field: "available_qty",
    });
    expect(projection.operations[0]?.objects).toEqual([
      { id: "purchase_order", name: "采购订单" },
      { id: "purchase_request", name: "采购申请" },
    ]);
    expect(projection.operations[0]?.query?.resources).toEqual([
      {
        id: "resource_po",
        name: "supply.bkn_supply_po",
        objectId: "purchase_order",
        objectName: "采购订单",
      },
    ]);
    expect(projection.conversationContext).toEqual([
      {
        knowledgeNetworkId: "supply",
        sourceInteractionId: "int-prior",
        sourceOperationId: "op-prior",
      },
    ]);
    expect(projection.derivedFacts).toEqual([
      {
        rule: "changed_query_still_zero_result",
        sourceOperationId: "op-0",
        operationId: "op-1",
        elementId: "purchase_order",
      },
    ]);
    expect(markdown).toContain("当前交互轮次");
  });

  it("loads interaction rounds only for the selected conversation", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{ interaction_id: "int-1", conversation_id: "conv-1", round_number: 3 }],
        total: 3,
      },
    });
    const { getBusinessProvenanceInteractions } = await import("./business-provenance.service");
    const page = await getBusinessProvenanceInteractions({
      conversationId: "conv-1",
      page: 1,
      pageSize: 20,
    });
    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/business-provenance/interactions",
      { params: { conversation_id: "conv-1", page: 1, page_size: 20 } },
    );
    expect(page.entries[0]).toMatchObject({ interactionId: "int-1", roundNumber: 3 });
  });

  it("streams the server-configured provenance Agent and returns its structured result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          'event: token\ndata: {"content":"正在分析"}\n\nevent: structured\ndata: {"content":{"decision":"no_change","summary":"事实完整。","recommendations":[]}}\n\nevent: done\ndata: {"status":"completed"}\n\n',
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const tokens: string[] = [];
    const { streamBusinessProvenanceAnalysis } = await import("./business-provenance.service");
    await expect(
      streamBusinessProvenanceAnalysis("int-1", "# 已确认 Markdown", (token) => tokens.push(token)),
    ).resolves.toMatchObject({ decision: "no_change", summary: "事实完整。" });
    expect(tokens).toEqual(["正在分析"]);
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[0]).toBe(
      "/api/agent-observability/v1/business-provenance/interactions/int-1/analysis",
    );
    expect(request[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ markdown: "# 已确认 Markdown" }),
      headers: {
        Authorization: "Bearer token",
        Accept: "text/event-stream",
        "Accept-Language": "en-US",
        "Content-Type": "application/json",
      },
    });
  });

  it("shows the normalized stream failure without exposing an empty result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            'event: error\ndata: {"code":"analysis_agent_failed","message":"BKN Agent 分析失败，请稍后重试"}\n\n',
            { status: 200, headers: { "content-type": "text/event-stream" } },
          ),
        ),
    );
    const { streamBusinessProvenanceAnalysis } = await import("./business-provenance.service");
    await expect(
      streamBusinessProvenanceAnalysis("int-1", "# 待分析 Markdown"),
    ).rejects.toMatchObject({
      code: "analysis_agent_failed",
      message: "BKN Agent 分析失败，请稍后重试",
    });
  });

  it("reads immutable analysis history for the selected interaction", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            analysis_id: "analysis-1",
            interaction_id: "int-1",
            status: "completed",
            result: { decision: "no_change" },
            started_at: "2026-08-11T10:00:00Z",
          },
        ],
      },
    });
    const { getBusinessProvenanceAnalysisHistory } = await import("./business-provenance.service");
    await expect(getBusinessProvenanceAnalysisHistory("int-1")).resolves.toMatchObject([
      { analysisId: "analysis-1", status: "completed", result: { decision: "no_change" } },
    ]);
  });
});

describe("interaction record integrity", () => {
  it("maps the independent assessment and sends its own filter", async () => {
    const report = {
      status: "missing",
      checked_at: "2026-10-03T00:00:00Z",
      scope: "registered_call_records",
      missing: [
        {
          operation_id: "op",
          attempt: 1,
          reason: "business_target_missing",
          field: "business_refs",
        },
      ],
    };
    getMock.mockResolvedValue({
      data: {
        entries: [{ interaction_id: "int", current_record_integrity: report }],
        total: 1,
      },
    });
    const { getBusinessProvenanceInteractions } = await import("./business-provenance.service");
    const page = await getBusinessProvenanceInteractions({ recordIntegrity: "missing" });
    expect(page.entries[0].currentRecordIntegrity).toEqual(report);
    expect(getMock).toHaveBeenLastCalledWith(
      "/agent-observability/v1/business-provenance/interactions",
      expect.objectContaining({ params: { record_integrity: "missing" } }),
    );
  });
});

it("does not map or forward legacy conversation state fields", async () => {
  getMock.mockResolvedValue({
    data: {
      entries: [
        {
          conversation_id: "conv",
          status: "closed",
          evidence_completeness: "partial",
          current_record_integrity: { status: "missing" },
          record_integrity_check_failed: true,
        },
      ],
      total: 1,
      partial: true,
      partial_reasons: ["preview_read_incomplete"],
    },
  });
  const { getBusinessProvenanceConversations } = await import("./business-provenance.service");
  const legacyQuery = {
    keyword: "stock",
    status: "closed",
    recordIntegrity: "missing",
    evidenceCompleteness: "partial",
  };
  const page = await getBusinessProvenanceConversations(legacyQuery);
  expect(getMock).toHaveBeenLastCalledWith(
    "/agent-observability/v1/business-provenance/conversations",
    expect.objectContaining({ params: { keyword: "stock" } }),
  );
  expect(page.entries[0].conversationId).toBe("conv");
  for (const key of [
    "status",
    "evidenceCompleteness",
    "currentRecordIntegrity",
    "recordIntegrityCheckFailed",
  ])
    expect(page.entries[0]).not.toHaveProperty(key);
  expect(page.partial).toBe(true);
  expect(page.partialReasons).toEqual(["preview_read_incomplete"]);
});

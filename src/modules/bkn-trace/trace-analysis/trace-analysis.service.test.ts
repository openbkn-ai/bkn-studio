/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({ http: { get: getMock } }));

describe("trace-analysis service", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("maps bounded display metadata without another first-screen request", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        summary: { trace_id: "range" },
        operations: [],
        span_display: {
          loaded_count: 1000,
          display_limit: 1000,
          raw_record_limit: 1001,
          raw_record_count: 1001,
          total_count: 1500,
          total_accuracy: "estimated",
          sort: "loaded_start_time_asc_span_id_asc",
          truncated: true,
          first_start_at: null,
          last_start_at: "2026-10-24T12:00:00Z",
          browse_allowed: false,
          browse_reason: "global_trace_access_required",
        },
      },
    });
    const service = await import("./trace-analysis.service");
    const detail = await service.getTechnicalTrace("range");
    expect(detail).toHaveProperty("spanDisplay", {
      loadedCount: 1000,
      displayLimit: 1000,
      rawRecordLimit: 1001,
      rawRecordCount: 1001,
      totalCount: 1500,
      totalAccuracy: "estimated",
      sort: "loaded_start_time_asc_span_id_asc",
      truncated: true,
      firstStartAt: null,
      lastStartAt: "2026-10-24T12:00:00Z",
      browseAllowed: false,
      browseReason: "global_trace_access_required",
    });
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("loads one bounded Span page with an encoded trace ID and cancellable cursor request", async () => {
    getMock.mockResolvedValue({
      data: {
        trace_id: "trace/a",
        entries: [{ span_id: "s", name: "page-span", start_nano: 1 }],
        has_more: true,
        next_cursor: "next",
        sort: "span_id_asc",
        consistency: "live",
      },
    });
    const { listTechnicalSpans } = await import("./trace-analysis.service");
    const signal = new AbortController().signal;
    const first = await listTechnicalSpans("trace/a", undefined, signal);
    expect(first.entries[0]).toMatchObject({ spanId: "s", name: "page-span" });
    expect(first).toMatchObject({
      hasMore: true,
      nextCursor: "next",
      sort: "span_id_asc",
      consistency: "live",
    });
    expect(getMock).toHaveBeenLastCalledWith("/agent-observability/v1/traces/trace%2Fa/spans", {
      signal,
      skipErrorToast: true,
    });
    await listTechnicalSpans("trace/a", "next", signal);
    expect(getMock).toHaveBeenLastCalledWith("/agent-observability/v1/traces/trace%2Fa/spans", {
      signal,
      params: { cursor: "next" },
      skipErrorToast: true,
    });
  });

  it.each([null, undefined])("accepts an empty terminal page with entries=%s", async (entries) => {
    getMock.mockResolvedValueOnce({
      data: {
        trace_id: "trace",
        entries,
        has_more: false,
        sort: "span_id_asc",
        consistency: "live",
      },
    });
    const { listTechnicalSpans } = await import("./trace-analysis.service");
    expect(await listTechnicalSpans("trace")).toMatchObject({ entries: [], hasMore: false });
  });

  it("does not turn a malformed non-array Span page into an empty success", async () => {
    getMock.mockResolvedValueOnce({ data: { trace_id: "trace", entries: {}, has_more: false } });
    const { listTechnicalSpans } = await import("./trace-analysis.service");
    await expect(listTechnicalSpans("trace")).rejects.toThrow();
  });

  it("merges and deduplicates graph-only partial diagnostics without another request", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        summary: { trace_id: "trace" },
        partial: false,
        partial_reasons: ["operation_gap"],
        graph: {
          data: { nodes: [] },
          partial: true,
          partial_reason: ["operation_gap", "trace_query_truncated", "parent_outside_display"],
        },
      },
    });
    const { getTechnicalTrace } = await import("./trace-analysis.service");
    const detail = await getTechnicalTrace("trace");
    expect(detail.partialReasons).toEqual([
      "operation_gap",
      "trace_query_truncated",
      "parent_outside_display",
    ]);
    expect(detail.partial).toBe(true);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("lists technical traces through stable typed filters", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            trace_id: "trace-1",
            request_id: "req-1",
            started_at: "2026-08-08T11:04:40.302897Z",
            completed_at: "2026-08-08T11:04:40.970884Z",
            root_service: "user-bkn-agent-retrieval",
            root_operation: "run_sql",
            agent_name: "Claude",
            question_preview: "对比两款产品的 BOM 物料差异。",
            result_preview: "返回 6 条 BOM 明细。",
            status: "completed",
            span_count: 1,
            span_count_status: "available",
            duration_ms: 667,
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        truncated: false,
        partial: false,
      },
    });
    const { listTechnicalTraces } =
      await import("@/modules/bkn-trace/trace-analysis/trace-analysis.service");

    const page = await listTechnicalTraces({
      errorKeyword: "timeout",
      from: "2026-08-08T00:00:00Z",
      limit: 20,
      service: "user-bkn-agent-retrieval",
      status: "completed",
      to: "2026-08-09T00:00:00Z",
      tool: "run_sql",
      traceId: "trace-1",
    });

    expect(getMock).toHaveBeenCalledWith("/agent-observability/v1/traces", {
      params: {
        error_keyword: "timeout",
        from: "2026-08-08T00:00:00Z",
        limit: 20,
        service: "user-bkn-agent-retrieval",
        status: "completed",
        to: "2026-08-09T00:00:00Z",
        tool: "run_sql",
        trace_id: "trace-1",
      },
    });
    expect(page.entries[0]).toMatchObject({
      agentName: "Claude",
      durationMs: 667,
      questionPreview: "对比两款产品的 BOM 物料差异。",
      resultPreview: "返回 6 条 BOM 明细。",
      rootService: "user-bkn-agent-retrieval",
      rootOperation: "run_sql",
      traceId: "trace-1",
    });
  });

  it("gets one technical trace with raw operation facts and no enterprise calls", async () => {
    getMock.mockResolvedValue({
      data: {
        summary: { trace_id: "trace-1", request_id: "req-1", status: "failed", span_count: 0 },
        graph: {
          trace_id: "trace-1",
          data: { nodes: [], edges: [] },
          partial: true,
          partial_reason: ["span_unavailable"],
        },
        operations: [
          {
            state: "failed",
            partial_reasons: ["span_unavailable"],
            fact: {
              operation_id: "op-1",
              attempt: 1,
              conversation_id: "conv-1",
              interaction_id: "int-1",
              request_id: "req-1",
              trace_id: "trace-1",
              tool_name: "run_sql",
              protocol: "mcp",
              source_module: "user-bkn-agent-retrieval",
              started_at: "2026-08-08T11:04:40.302897Z",
              finished_at: "2026-08-08T11:04:40.970884Z",
              status: "failed",
              retryable: true,
              input: {
                mode: "inline",
                media_type: "application/json",
                byte_length: 18,
                inline: { sql: "SELECT 1" },
              },
              error: {
                mode: "inline",
                media_type: "application/json",
                byte_length: 18,
                inline: { code: "TIMEOUT" },
              },
            },
            receipt: { receipt_id: "receipt-1", receipt_status: "failed" },
          },
        ],
        partial: true,
        partial_reasons: ["span_unavailable"],
      },
    });
    const { getTechnicalTrace } =
      await import("@/modules/bkn-trace/trace-analysis/trace-analysis.service");

    const detail = await getTechnicalTrace("trace-1");

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith("/agent-observability/v1/traces/trace-1", {
      skipErrorToast: true,
    });
    expect(detail.operations[0]).toMatchObject({
      state: "failed",
      fact: {
        operationId: "op-1",
        input: { inline: { sql: "SELECT 1" }, mode: "inline" },
        error: { inline: { code: "TIMEOUT" }, mode: "inline" },
      },
    });
    expect(getMock.mock.calls.flat().join(" ")).not.toMatch(
      /business-provenance|business-graph|evidence|snapshot/,
    );
  });

  it("loads a referenced payload only through the authorized artifact read", async () => {
    getMock.mockResolvedValue({ data: { content: { sql: "SELECT 1" } } });
    const { getReferencedPayload } =
      await import("@/modules/bkn-trace/trace-analysis/trace-analysis.service");

    const content = await getReferencedPayload("artifact:run_sql_input_1", "int-1");

    expect(content).toEqual({ sql: "SELECT 1" });
    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/evidence/artifacts/run_sql_input_1",
      {
        params: { interaction_id: "int-1" },
        skipErrorToast: true,
      },
    );
  });
});

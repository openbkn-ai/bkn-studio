/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const runtimeConfigMock: { currentUser: { businessDomainId: string | null } } = vi.hoisted(() => ({
  currentUser: { businessDomainId: "bd_demo" },
}));

vi.mock("@/framework/request/http", () => ({ http: { get: getMock } }));
vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => runtimeConfigMock,
}));

describe("trace-analysis service", () => {
  beforeEach(() => {
    getMock.mockReset();
    runtimeConfigMock.currentUser.businessDomainId = "bd_demo";
  });

  it("lists technical traces through stable typed filters", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{
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
        }],
        total: 1,
        page: 1,
        page_size: 20,
        truncated: false,
        partial: false,
      },
    });
    const { listTechnicalTraces } = await import(
      "@/modules/bkn-trace/trace-analysis/trace-analysis.service"
    );

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
      headers: { "x-business-domain": "bd_demo" },
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
        graph: { trace_id: "trace-1", data: { nodes: [], edges: [] }, partial: true, partial_reason: ["span_unavailable"] },
        operations: [{
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
            input: { mode: "inline", media_type: "application/json", byte_length: 18, inline: { sql: "SELECT 1" } },
            error: { mode: "inline", media_type: "application/json", byte_length: 18, inline: { code: "TIMEOUT" } },
          },
          receipt: { receipt_id: "receipt-1", receipt_status: "failed" },
        }],
        partial: true,
        partial_reasons: ["span_unavailable"],
      },
    });
    const { getTechnicalTrace } = await import(
      "@/modules/bkn-trace/trace-analysis/trace-analysis.service"
    );

    const detail = await getTechnicalTrace("trace-1");

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith("/agent-observability/v1/traces/trace-1", {
      headers: { "x-business-domain": "bd_demo" },
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
    expect(getMock.mock.calls.flat().join(" ")).not.toMatch(/business-provenance|business-graph|evidence|snapshot/);
  });

  it("uses the local default business domain when the signed-in user has no domain", async () => {
    runtimeConfigMock.currentUser.businessDomainId = null;
    getMock.mockResolvedValue({ data: { entries: [], total: 0 } });
    const { listTechnicalTraces } = await import(
      "@/modules/bkn-trace/trace-analysis/trace-analysis.service"
    );

    await listTechnicalTraces({ limit: 20 });

    expect(getMock).toHaveBeenCalledWith("/agent-observability/v1/traces", {
      headers: { "x-business-domain": "bd_public" },
      params: { limit: 20 },
    });
  });

  it("loads a referenced payload only through the authorized artifact read", async () => {
    getMock.mockResolvedValue({ data: { content: { sql: "SELECT 1" } } });
    const { getReferencedPayload } = await import(
      "@/modules/bkn-trace/trace-analysis/trace-analysis.service"
    );

    const content = await getReferencedPayload("artifact:run_sql_input_1", "int-1");

    expect(content).toEqual({ sql: "SELECT 1" });
    expect(getMock).toHaveBeenCalledWith(
      "/agent-observability/v1/evidence/artifacts/run_sql_input_1",
      {
        headers: { "x-business-domain": "bd_demo" },
        params: { interaction_id: "int-1" },
        skipErrorToast: true,
      },
    );
  });
});

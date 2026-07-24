/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
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
          data: { claims: [], evidence_refs: [], business_refs: [] },
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

    await getEvidenceChain({ requestId: "req_001", limit: 50 });
    await getBusinessGraph({ requestId: "req_001", limit: 50 });

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      "/agent-observability/v1/traces/by-request",
      { params: { request_id: "req_001", limit: 50 } },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/agent-observability/v1/traces/by-request/business-graph",
      { params: { request_id: "req_001", limit: 50 } },
    );
    expect(getMock.mock.calls.flat().join(" ")).not.toContain("_search");
  });
});

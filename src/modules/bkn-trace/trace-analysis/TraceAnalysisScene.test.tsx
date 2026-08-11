/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TraceAnalysisScene } from "@/modules/bkn-trace/trace-analysis/TraceAnalysisScene";
import {
  getTechnicalTrace,
  listTechnicalTraces,
} from "@/modules/bkn-trace/trace-analysis/trace-analysis.service";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/modules/bkn-trace/trace-analysis/trace-analysis.service", () => ({
  getTechnicalTrace: vi.fn(),
  listTechnicalTraces: vi.fn(),
}));

const writeTextMock = vi.fn().mockResolvedValue(undefined);

describe("TraceAnalysisScene", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockImplementation(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
      writable: true,
    });
    vi.stubGlobal("ResizeObserver", class {
      disconnect() {}
      observe() {}
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });
  });

  beforeEach(() => {
    writeTextMock.mockClear();
    window.history.replaceState({}, "", "/studio/observability/traces");
    vi.mocked(listTechnicalTraces).mockResolvedValue({
      entries: [{
        agentName: "Claude",
        durationMs: 667,
        questionPreview: "分析对比900-000044和900-000063两款智能球阀的BOM物料差异。",
        requestId: "req_7892c814-bd3a-45c5-83eb-6707f0279df1",
        resultPreview: "查询到 6 条 BOM 记录。",
        rootService: "user-bkn-agent-retrieval",
        rootOperation: "run_sql",
        spanCount: 0,
        spanCountStatus: "unavailable",
        startedAt: "2026-08-08T11:04:40.302897Z",
        status: "completed",
        traceId: "c2c97a9e8afd1259218a9d975ad63e91",
      }],
      page: 1,
      pageSize: 20,
      partial: false,
      partialReasons: [],
      total: 1,
      truncated: false,
    });
    vi.mocked(getTechnicalTrace).mockResolvedValue({
      summary: {
        agentName: "Claude",
        durationMs: 667,
        questionPreview: "分析对比900-000044和900-000063两款智能球阀的BOM物料差异。",
        requestId: "req_7892c814-bd3a-45c5-83eb-6707f0279df1",
        resultPreview: "查询到 6 条 BOM 记录。",
        rootService: "user-bkn-agent-retrieval",
        rootOperation: "run_sql",
        spanCount: 0,
        spanCountStatus: "unavailable",
        startedAt: "2026-08-08T11:04:40.302897Z",
        status: "completed",
        traceId: "c2c97a9e8afd1259218a9d975ad63e91",
      },
      operations: [{
        state: "completed",
        partialReasons: ["span_unavailable"],
        receipt: { partialReasons: [], receiptId: "receipt-1", receiptStatus: "completed" },
        fact: {
          attempt: 1,
          conversationId: "conv_73fc12a00ac46933c3d8015616a1b1b3",
          finishedAt: "2026-08-08T11:04:40.970884Z",
          input: {
            byteLength: 320,
            inline: { resource_id: "d9qpqpco8jec73ec20tg", sql: "SELECT parent_material_code FROM t" },
            mediaType: "application/json",
            mode: "inline",
          },
          interactionId: "int_483a29806fa10fde2e45b6eede7b435e",
          operationId: "op_481d7266ea974c0d6d9e2165c9e29a43",
          output: {
            byteLength: 20,
            inline: { row_count: 6 },
            mediaType: "application/json",
            mode: "inline",
          },
          protocol: "mcp",
          requestId: "req_7892c814-bd3a-45c5-83eb-6707f0279df1",
          retryable: false,
          sourceModule: "user-bkn-agent-retrieval",
          startedAt: "2026-08-08T11:04:40.302897Z",
          status: "completed",
          toolName: "run_sql",
          traceId: "c2c97a9e8afd1259218a9d975ad63e91",
        },
      }],
      graph: {
        nodes: [
          {
            durationNano: 667_000_000,
            endNano: 1_754_651_480_970_000_000,
            kind: "server",
            name: "POST /mcp/run_sql",
            serviceName: "user-bkn-agent-retrieval",
            spanId: "span-1",
            startNano: 1_754_651_480_303_000_000,
            status: "ok",
          },
          {
            durationNano: 120_000_000,
            endNano: 1_754_651_480_520_000_000,
            kind: "client",
            name: "vega.query",
            parentSpanId: "span-1",
            serviceName: "vega-backend",
            spanId: "span-2",
            startNano: 1_754_651_480_400_000_000,
            status: "ok",
          },
        ],
        partial: false,
        partialReasons: [],
      },
      partial: true,
      partialReasons: ["span_unavailable"],
    });
  });

  it("opens a real technical Trace into summary, execution chain and raw detail", async () => {
    const { container } = render(<TraceAnalysisScene />);
    expect(container.firstElementChild?.className).toContain("pageSurface");

    const traceLink = await screen.findByRole("button", {
      name: "c2c97a9e8afd1259218a9d975ad63e91",
    });
    expect(screen.getByText("user-bkn-agent-retrieval")).not.toBeNull();
    fireEvent.click(traceLink);

    expect(await screen.findByText("分析对比900-000044和900-000063两款智能球阀的BOM物料差异。")).not.toBeNull();
    expect(screen.getByText("查询到 6 条 BOM 记录。")).not.toBeNull();
    const span = screen.getByText("POST /mcp/run_sql");
    const childSpan = screen.getByText("vega.query");
    expect(screen.getByText("bknTrace.traceWorkspace.diagnostics.spanUnavailable")).not.toBeNull();
    const operationButton = screen.getByRole("button", { name: /run_sql/ });
    expect(span.compareDocumentPosition(operationButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(childSpan.closest("div")?.getAttribute("style")).toContain("margin-inline-start: 14px");

    fireEvent.click(operationButton);
    expect(await screen.findByText(/SELECT parent_material_code FROM t/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /bknTrace\.traceWorkspace\.copy/ }));
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("SELECT parent_material_code FROM t"));
    fireEvent.click(screen.getByRole("tab", { name: "bknTrace.traceWorkspace.output" }));
    expect(screen.getByText(/"row_count": 6/)).not.toBeNull();
    expect(getTechnicalTrace).toHaveBeenCalledWith("c2c97a9e8afd1259218a9d975ad63e91");
    await waitFor(() => expect(listTechnicalTraces).toHaveBeenCalledTimes(1));
  }, 20_000);

  it("opens an exact trace from a related-log deep link", async () => {
    window.history.replaceState({}, "", "/studio/observability/traces?trace_id=c2c97a9e8afd1259218a9d975ad63e91");

    render(<TraceAnalysisScene />);

    await waitFor(() => expect(getTechnicalTrace).toHaveBeenCalledWith("c2c97a9e8afd1259218a9d975ad63e91"));
    expect(await screen.findByText("bknTrace.traceWorkspace.detailTitle")).not.toBeNull();
  });
});

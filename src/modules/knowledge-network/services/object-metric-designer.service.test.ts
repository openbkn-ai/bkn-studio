/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  proposalToObjectMetricAiIntent,
  runObjectMetricDesigner,
  type ObjectMetricDesignProposal,
} from "./object-metric-designer.service";

const tokenProvider = { getToken: () => "token-1", refresh: () => Promise.resolve("token-1") };
const fetchMock = vi.fn<typeof fetch>();

function sse(name: string, data: Record<string, unknown>): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}

const proposal: ObjectMetricDesignProposal = {
  kind: "metric_design_proposal",
  base_form_revision: "rev-1",
  summary: "改用订单金额",
  questions: [],
  changes: [
    {
      field: "atomic.property_name",
      operation: "replace",
      before: "amount_before",
      after: "amount",
      reason: "用户指定金额属性",
    },
  ],
};

const baseParams = {
  base: "https://platform.example.com",
  tokenProvider,
  scope: {
    kn_id: "network-1",
    owner_object_type_id: "order",
    metric_type: "atomic" as const,
    mode: "create" as const,
  },
  formSnapshot: { name: "当前名称" },
  candidates: {
    properties: [{ name: "amount", label: "金额" }],
    published_metrics: [],
  },
  baseFormRevision: "rev-1",
  message: "改成金额",
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("runObjectMetricDesigner", () => {
  it("binds the design scope and receives a typed proposal across split SSE frames", async () => {
    const body =
      sse("meta", { run_id: "run-1", thread_id: "thread-1" }) +
      sse("token", { content: "建议调整" }) +
      sse("proposal", { content: proposal }) +
      sse("result", { content: { answer: "建议调整", proposal } }) +
      sse("terminal", { status: "succeeded" });
    fetchMock.mockResolvedValue(
      streamResponse([body.slice(0, 23), body.slice(23, 95), body.slice(95)]),
    );
    const chunks: string[] = [];

    const result = await runObjectMetricDesigner({
      ...baseParams,
      diagnostic: {
        kind: "trial",
        form_revision: "rev-1",
        status: "partial",
        entry_count: 2,
        overall_ms: 31,
      },
      onText: (text) => chunks.push(text),
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://platform.example.com/api/bkn-agent/v1/metric-design/executions");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      scope: baseParams.scope,
      base_form_revision: "rev-1",
      form_snapshot: { name: "当前名称" },
      diagnostic: {
        kind: "trial",
        form_revision: "rev-1",
        status: "partial",
        entry_count: 2,
      },
      message: "改成金额",
    });
    expect(JSON.parse(init?.body as string)).not.toHaveProperty("model_id");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-1");
    expect(chunks).toEqual(["建议调整"]);
    expect(result).toEqual({ answer: "建议调整", proposal, runId: "run-1", threadId: "thread-1" });
    expect(proposalToObjectMetricAiIntent(proposal)).toEqual({
      atomic: { property_name: "amount" },
    });
  });

  it("rejects a proposal for another form revision", async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        sse("meta", { run_id: "run-1", thread_id: "thread-1" }) +
          sse("proposal", { content: { ...proposal, base_form_revision: "rev-old" } }) +
          sse("terminal", { status: "succeeded" }),
      ]),
    );
    await expect(runObjectMetricDesigner(baseParams)).rejects.toThrow("无效的修改建议");
  });

  it.each([{ detail: "当前用户无权使用该模型" }, { detail: { detail: "当前用户无权使用该模型" } }])(
    "shows the server's authorization reason when execution is denied",
    async (body) => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 403 }));
      await expect(runObjectMetricDesigner(baseParams)).rejects.toThrow("当前用户无权使用该模型");
    },
  );

  it("rejects server-owned fields and changes for another metric type", async () => {
    for (const field of ["code", "derived.event_time"]) {
      fetchMock.mockResolvedValueOnce(
        streamResponse([
          sse("meta", { run_id: "run-1", thread_id: "thread-1" }) +
            sse("proposal", {
              content: {
                ...proposal,
                changes: [{ ...proposal.changes[0], field }],
              },
            }) +
            sse("terminal", { status: "succeeded" }),
        ]),
      );
      await expect(runObjectMetricDesigner(baseParams)).rejects.toThrow("无效的修改建议");
    }
  });

  it("accepts a valid decimal result contract proposal", async () => {
    const decimalProposal = {
      ...proposal,
      changes: [
        { ...proposal.changes[0], field: "result.precision", after: 20 },
        { ...proposal.changes[0], field: "result.scale", after: 8 },
        { ...proposal.changes[0], field: "result.rounding_mode", after: "floor" },
      ],
    };
    fetchMock.mockResolvedValueOnce(
      streamResponse([
        sse("meta", { run_id: "run-1", thread_id: "thread-1" }) +
          sse("proposal", { content: decimalProposal }) +
          sse("terminal", { status: "succeeded" }),
      ]),
    );

    const result = await runObjectMetricDesigner({
      ...baseParams,
      formSnapshot: {
        physicalType: "decimal",
        precision: 18,
        scale: 6,
        roundingMode: "half_even",
      },
    });

    expect(proposalToObjectMetricAiIntent(result.proposal).result).toEqual({
      precision: 20,
      scale: 8,
      rounding_mode: "floor",
    });
  });

  it.each([
    ["result.precision", 0],
    ["result.precision", 5],
    ["result.scale", 19],
    ["result.scale", 2.5],
    ["result.rounding_mode", "unknown"],
    ["result.precision", null],
    ["result.scale", null],
    ["result.rounding_mode", null],
  ])("rejects an invalid decimal format change in %s", async (field, after) => {
    fetchMock.mockResolvedValueOnce(
      streamResponse([
        sse("meta", { run_id: "run-1", thread_id: "thread-1" }) +
          sse("proposal", {
            content: {
              ...proposal,
              changes: [{ ...proposal.changes[0], field, after }],
            },
          }) +
          sse("terminal", { status: "succeeded" }),
      ]),
    );
    await expect(
      runObjectMetricDesigner({
        ...baseParams,
        formSnapshot: {
          physicalType: "decimal",
          precision: 18,
          scale: 6,
          roundingMode: "half_even",
        },
      }),
    ).rejects.toThrow("无效的修改建议");
  });

  it("shows the validation field, reason, and run ID for a failed proposal", async () => {
    const error = {
      code: "BknAgent.MetricDesign.ProposalInvalid",
      detail: "对象指标修改建议不符合字段要求",
      stage: "repair",
      field: "composite.expression",
      reason: "proposal field does not match metric type",
    };
    fetchMock.mockResolvedValueOnce(
      streamResponse([
        sse("meta", { run_id: "run-2533", thread_id: "thread-1" }) +
          sse("terminal", { status: "failed", error }),
      ]),
    );
    await expect(runObjectMetricDesigner(baseParams)).rejects.toThrow(
      /composite\.expression[\s\S]*proposal field does not match metric type[\s\S]*run-2533/,
    );
  });
});

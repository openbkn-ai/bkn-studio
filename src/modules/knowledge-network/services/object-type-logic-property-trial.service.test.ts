/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendRequestMock = vi.hoisted(() => vi.fn());
const recordReceiptMock = vi.hoisted(() => vi.fn());
const withManagedTurnMock = vi.hoisted(() =>
  vi.fn(
    (
      _lifecycle: unknown,
      _question: string,
      run: (turn: {
        nextContext: (tool: string) => unknown;
        recordReceipt: (receipt: unknown) => void;
      }) => Promise<unknown>,
    ) =>
      run({
        nextContext: (tool) => ({
          conversation_id: "conv-1",
          interaction_id: "int-1",
          operation_key: `${tool}#1`,
        }),
        recordReceipt: recordReceiptMock,
      }),
  ),
);
const getRuntimeConfigMock = vi.hoisted(() =>
  vi.fn(() => ({
    auth: {
      tokenManager: {
        getAccessToken: () => "token-1",
        refreshAccessToken: () => Promise.resolve("token-2"),
      },
    },
  })),
);

vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: getRuntimeConfigMock,
}));

vi.mock("@/modules/knowledge-network/services/bkn-lifecycle.service", () => ({
  createBknLifecycle: vi.fn(() => ({})),
  lifecycleEnv: (base: string, knId: string) => ({ base, knId, token: "" }),
  memoryExternalKeyStore: () => ({ read: () => "trial-key", rotate: vi.fn() }),
  withManagedTurn: withManagedTurnMock,
}));

vi.mock("@/modules/knowledge-network/services/context-loader.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/knowledge-network/services/context-loader.service")>();
  return {
    ...actual,
    sendRequest: sendRequestMock,
  };
});

const gmvMetric = {
  dataSource: { id: "metric-1", name: "GMV", type: "metric" as const },
  displayName: "GMV指标",
  name: "gmv_metric",
  type: "metric" as const,
};

describe("object-type-logic-property-trial.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    sendRequestMock.mockReset();
    recordReceiptMock.mockReset();
    withManagedTurnMock.mockClear();
    sendRequestMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      latencyMs: 1,
      sizeBytes: 10,
      text: JSON.stringify({
        datas: [{ gmv_metric: 42 }],
      }),
      receipt: { operationId: "op-1", receiptId: "rcp-1", required: true },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls logic-property-resolver via REST and records managed receipt", async () => {
    const { getObjectTypeLogicPropertyValues } = await import(
      "@/modules/knowledge-network/services/object-type-logic-property-trial.service"
    );

    const rows = await getObjectTypeLogicPropertyValues({
      instanceIdentities: [{ order_id: "1001" }],
      knId: "kn_identifier",
      logicProperties: [gmvMetric],
      networkId: "kn-route-id",
      objectTypeId: "ot-1",
      returnDebug: true,
    });

    expect(withManagedTurnMock).toHaveBeenCalled();
    expect(sendRequestMock).toHaveBeenCalledTimes(1);

    const call = sendRequestMock.mock.calls[0];
    expect(call).toBeDefined();
    const rawBody: unknown = call?.[4];
    if (typeof rawBody !== "string") {
      throw new Error("Expected REST body text in sendRequest call");
    }
    expect(JSON.parse(rawBody)).toEqual({
      _instance_identities: [{ order_id: "1001" }],
      additional_context:
        '对象类详情页实例试算。instant=true；metric 型按即时汇总/当前值查询，不输出趋势 step。试算属性：gmv_metric。实例主键示例：{"order_id":"1001"}。',
      kn_id: "kn_identifier",
      ot_id: "ot-1",
      options: { return_debug: true },
      properties: ["gmv_metric"],
      query: "查询选中实例的GMV指标当前值",
    });

    expect(sendRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ knId: "kn_identifier" }),
      expect.objectContaining({
        id: "get_logic_properties_values",
        path: "/api/agent-retrieval/v1/kn/logic-property-resolver",
      }),
      "rest",
      { response_format: "json" },
      expect.any(String),
      expect.any(Object),
      undefined,
      expect.objectContaining({
        conversation_id: "conv-1",
        interaction_id: "int-1",
        operation_key: "get_logic_properties_values#1",
      }),
    );
    expect(recordReceiptMock).toHaveBeenCalledWith({
      operationId: "op-1",
      receiptId: "rcp-1",
      required: true,
    });
    expect(rows[0]?.values.gmv_metric).toBe(42);
  });

  it("does not fall back to MCP when REST fails", async () => {
    sendRequestMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      latencyMs: 1,
      sizeBytes: 0,
      text: "内部错误",
    });

    const { getObjectTypeLogicPropertyValues } = await import(
      "@/modules/knowledge-network/services/object-type-logic-property-trial.service"
    );

    await expect(
      getObjectTypeLogicPropertyValues({
        instanceIdentities: [{ order_id: "1001" }],
        logicProperties: [gmvMetric],
        networkId: "kn-1",
        objectTypeId: "ot-1",
        returnDebug: false,
      }),
    ).rejects.toThrow("内部错误");

    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    expect(sendRequestMock.mock.calls[0]?.[2]).toBe("rest");
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

describe("object-type.service · getObjectTypeSampleData", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    postMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("queries object type sample data through the managed-proxy ontology-query API", async () => {
    const rawResponse = JSON.stringify({
      columns: [{ data_index: "order_id", title: "订单 ID" }],
      entries: [{ order_id: 1 }],
      name: "采购订单",
      total_count: 1,
    });
    getMock.mockImplementation(
      (_: string, config: { transformResponse?: (data: unknown) => unknown }) =>
        Promise.resolve({ data: config.transformResponse?.(rawResponse) }),
    );
    const { getObjectTypeSampleData } =
      await import("@/modules/knowledge-network/services/object-type.service");
    const { transformPrecisionSafeJSONResponse } =
      await import("@/framework/request/precision-safe-json");

    const result = await getObjectTypeSampleData("kn-1", "purchase_order");

    expect(getMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/object-types/purchase_order/sample-data",
      {
        params: {
          limit: 20,
          need_total: true,
          offset: 0,
        },
        skipErrorToast: true,
        transformResponse: transformPrecisionSafeJSONResponse,
      },
    );
    expect(postMock).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/vega-backend/"),
      expect.anything(),
    );
    expect(result).toEqual({
      columns: [{ dataIndex: "order_id", title: "订单 ID" }],
      name: "采购订单",
      rowTotalCount: 1,
      rows: [{ order_id: 1 }],
    });
  });

  it("preserves unsafe integers from the raw sample-data response", async () => {
    const rawResponse =
      '{"columns":[{"data_index":"order_id"}],"entries":[{"order_id":110101199001152345,"signed":-9223372036854775808,"unsigned":18446744073709551615}],"total_count":1}';
    getMock.mockImplementation(
      (_: string, config: { transformResponse?: (data: unknown) => unknown }) =>
        Promise.resolve({ data: config.transformResponse?.(rawResponse) }),
    );
    const { getObjectTypeSampleData } =
      await import("@/modules/knowledge-network/services/object-type.service");

    await expect(getObjectTypeSampleData("kn-1", "purchase_order")).resolves.toMatchObject({
      rows: [
        {
          order_id: "110101199001152345",
          signed: "-9223372036854775808",
          unsigned: "18446744073709551615",
        },
      ],
    });
  });

  it("loads an exact participant beyond the first sample page by primary-key identity", async () => {
    const rawResponse = '{"datas":[{"order_id":110101199001152345,"amount":25}]}';
    postMock.mockImplementation(
      (_url: string, _body: unknown, config: { transformResponse?: (data: unknown) => unknown }) =>
        Promise.resolve({ data: config.transformResponse?.(rawResponse) }),
    );
    const { getObjectTypeInstanceData } =
      await import("@/modules/knowledge-network/services/object-type.service");
    const { transformPrecisionSafeJSONResponse } =
      await import("@/framework/request/precision-safe-json");

    await expect(
      getObjectTypeInstanceData("kn-1", "order", { order_id: "110101199001152345" }, [
        "order_id",
        "amount",
      ]),
    ).resolves.toEqual({ order_id: "110101199001152345", amount: 25 });
    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/object-types/order/properties",
      {
        _instance_identities: [{ order_id: "110101199001152345" }],
        properties: ["order_id", "amount"],
      },
      {
        headers: { "X-HTTP-Method-Override": "GET" },
        skipErrorToast: true,
        transformResponse: transformPrecisionSafeJSONResponse,
      },
    );
    expect(getMock).not.toHaveBeenCalled();
  });

  it("loads every object type page by default", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `object-${index}`,
      name: `Object ${index}`,
      operations: ["view_detail"],
    }));
    getMock
      .mockResolvedValueOnce({ data: { entries: firstPage, total_count: 101 } })
      .mockResolvedValueOnce({
        data: {
          entries: [{ id: "object-100", name: "Object 100", operations: ["query_data"] }],
          total_count: 101,
        },
      });
    const { listKnowledgeNetworkObjectTypes } =
      await import("@/modules/knowledge-network/services/object-type.service");

    const result = await listKnowledgeNetworkObjectTypes("kn-1", { skipErrorToast: true });

    expect(result).toHaveLength(101);
    expect(result.at(-1)).toMatchObject({ id: "object-100", operations: ["query_data"] });
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/bkn-backend/v1/knowledge-networks/kn-1/object-types",
      {
        params: {
          direction: "desc",
          limit: 100,
          offset: 100,
          sort: "update_time",
        },
        skipErrorToast: true,
      },
    );
  });

  it("loads requested lookup pages concurrently while preserving server order", async () => {
    const pending = new Map<number, (response: unknown) => void>();
    const page = (offset: number, length: number) => ({
      data: {
        entries: Array.from({ length }, (_, index) => ({
          id: `object-${offset + index}`,
          name: `Object ${offset + index}`,
        })),
        total_count: 301,
      },
    });
    getMock.mockImplementation((_url: string, config: { params: { offset: number } }) =>
      config.params.offset === 0
        ? Promise.resolve(page(0, 100))
        : new Promise((resolve) => pending.set(config.params.offset, resolve)),
    );
    const { listKnowledgeNetworkObjectTypes } =
      await import("@/modules/knowledge-network/services/object-type.service");
    const resultPromise = listKnowledgeNetworkObjectTypes("kn-1", { pageConcurrency: 4 });

    await vi.waitFor(() => expect(pending.size).toBe(3));
    pending.get(300)?.(page(300, 1));
    pending.get(200)?.(page(200, 100));
    pending.get(100)?.(page(100, 100));
    const result = await resultPromise;
    expect(result).toHaveLength(301);
    expect(result[100]?.id).toBe("object-100");
    expect(result[200]?.id).toBe("object-200");
    expect(result[300]?.id).toBe("object-300");
  });

  it("requests one server page with search, tag, and stable pagination parameters", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        entries: [{ id: "object-101", name: "Order", operations: ["view_detail"] }],
        total_count: 137,
      },
    });
    const { listKnowledgeNetworkObjectTypePage } =
      await import("@/modules/knowledge-network/services/object-type.service");

    const result = await listKnowledgeNetworkObjectTypePage(
      "kn-1",
      {
        direction: "asc",
        limit: 10,
        namePattern: "  Order  ",
        offset: 100,
        sort: "name",
        tag: "  core  ",
      },
      { skipErrorToast: true },
    );

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/knowledge-networks/kn-1/object-types", {
      params: {
        direction: "asc",
        limit: 10,
        name_pattern: "Order",
        offset: 100,
        sort: "name",
        tag: "core",
      },
      skipErrorToast: true,
    });
    expect(result).toMatchObject({
      entries: [{ id: "object-101", name: "Order", operations: ["view_detail"] }],
      totalCount: 137,
    });
  });
});

describe("object-type.service · validateKnowledgeNetworkObjectType", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    postMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates the mapped object type before mutation", async () => {
    getMock.mockResolvedValue({ data: { entries: [] } });
    postMock.mockResolvedValue({ data: undefined });
    const { validateKnowledgeNetworkObjectType } =
      await import("@/modules/knowledge-network/services/object-type.service");

    await validateKnowledgeNetworkObjectType("kn-1", {
      color: "#1677ff",
      conceptGroupIds: [],
      dataProperties: [],
      description: "",
      logicProperties: [
        {
          dataSource: {
            boxId: "box-1",
            name: "Weather",
            resultPath: "$.data.temperature",
            toolId: "tool-1",
            type: "tool",
          },
          displayName: "Weather",
          name: "weather",
          parameters: [],
          type: "tool",
        },
      ],
      name: "Weather object",
      tags: [],
    });

    expect(postMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/object-types/validation",
      expect.any(Object),
    );
    const firstCall: unknown = postMock.mock.calls[0];
    expect(Array.isArray(firstCall)).toBe(true);
    const [, payload] = firstCall as [
      string,
      {
        entries?: Array<{
          logic_properties?: Array<{
            data_source?: unknown;
          }>;
        }>;
      },
    ];
    expect(payload.entries?.[0]?.logic_properties?.[0]?.data_source).toEqual({
      box_id: "box-1",
      name: "Weather",
      result_path: "$.data.temperature",
      tool_id: "tool-1",
      type: "tool",
    });
  });
});

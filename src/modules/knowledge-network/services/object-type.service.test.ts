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

  it("queries object type sample data through the BKN API", async () => {
    getMock.mockResolvedValue({
      data: {
        columns: [{ data_index: "order_id", title: "订单 ID" }],
        entries: [{ order_id: 1 }],
        name: "采购订单",
        total_count: 1,
      },
    });
    const { getObjectTypeSampleData } = await import(
      "@/modules/knowledge-network/services/object-type.service"
    );

    const result = await getObjectTypeSampleData("kn-1", "purchase_order");

    expect(getMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/object-types/purchase_order/sample-data",
      {
        params: {
          limit: 20,
          need_total: true,
          offset: 0,
        },
      },
    );
    expect(postMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      columns: [{ dataIndex: "order_id", title: "订单 ID" }],
      name: "采购订单",
      rowTotalCount: 1,
      rows: [{ order_id: 1 }],
    });
  });
});

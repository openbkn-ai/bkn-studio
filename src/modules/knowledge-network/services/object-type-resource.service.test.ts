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

describe("object-type-resource.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    postMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Vega paging for the object-type resource preview", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [{ id: "r-1", name: "orders", schema_definition: [{ name: "id" }] }],
      },
    });
    postMock.mockResolvedValue({ data: { entries: [{ id: 1 }], total_count: 1 } });
    const { getObjectTypeResourcePreview } = await import(
      "@/modules/knowledge-network/services/object-type-resource.service"
    );
    const { transformPrecisionSafeJSONResponse } = await import(
      "@/framework/request/precision-safe-json"
    );

    const result = await getObjectTypeResourcePreview("kn-1", "r-1");

    expect(postMock).toHaveBeenCalledWith(
      "/vega-backend/v1/resources/r-1/data",
      {
        need_total: true,
        paging: { limit: 20, mode: "single", offset: 0 },
      },
      {
        headers: { "X-HTTP-Method-Override": "GET" },
        transformResponse: transformPrecisionSafeJSONResponse,
      },
    );
    expect(result?.rowTotalCount).toBe(1);
  });

  it("normalizes resource search names for case-insensitive matching", async () => {
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
    const { queryObjectTypeResources } = await import(
      "@/modules/knowledge-network/services/object-type-resource.service"
    );

    await queryObjectTypeResources("kn-1", {
      dataSourceId: "catalog-1",
      name: "  Supply_DEMO  ",
      page: 2,
      pageSize: 20,
    });

    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/resources", {
      params: {
        catalog_id: "catalog-1",
        limit: 20,
        name: "supply_demo",
        offset: 20,
        sort: "update_time",
      },
    });
  });
});

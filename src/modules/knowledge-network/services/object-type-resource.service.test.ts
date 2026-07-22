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

describe("object-type-resource.service · getObjectTypeResourcePreview", () => {
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

    const result = await getObjectTypeResourcePreview("kn-1", "r-1");

    expect(postMock).toHaveBeenCalledWith(
      "/vega-backend/v1/resources/r-1/data",
      {
        need_total: true,
        paging: { limit: 20, mode: "single", offset: 0 },
      },
      { headers: { "X-HTTP-Method-Override": "GET" } },
    );
    expect(result?.rowTotalCount).toBe(1);
  });
});

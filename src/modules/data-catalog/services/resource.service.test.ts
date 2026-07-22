/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { post: postMock },
}));

describe("resource.service · previewCatalogResource", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Vega paging and the GET method override", async () => {
    postMock.mockResolvedValue({ data: { entries: [{ id: "r-1" }], total_count: 42 } });
    const { previewCatalogResource } = await import(
      "@/modules/data-catalog/services/resource.service"
    );

    const result = await previewCatalogResource("r-1", { limit: 10, offset: 20 });

    expect(postMock).toHaveBeenCalledWith(
      "/vega-backend/v1/resources/r-1/data",
      {
        need_total: true,
        paging: { limit: 10, mode: "single", offset: 20 },
      },
      { headers: { "X-HTTP-Method-Override": "GET" } },
    );
    expect(result).toEqual({ rows: [{ id: "r-1" }], total: 42 });
  });
});

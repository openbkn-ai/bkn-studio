/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

describe("catalog.service · listCatalogs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes the physical type to Vega before pagination", async () => {
    const { listCatalogs } = await import("@/shared/catalog/catalog.service");

    await listCatalogs({ keyword: "", page: 1, pageSize: 50, type: "physical" });

    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/catalogs", {
      params: expect.objectContaining({ type: "physical" }),
    });
  });

  it("omits the type filter when all catalog types are requested", async () => {
    const { listCatalogs } = await import("@/shared/catalog/catalog.service");

    await listCatalogs({ keyword: "", page: 1, pageSize: 50, type: "all" });

    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/catalogs", {
      params: expect.objectContaining({ type: undefined }),
    });
  });
});

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

function lastParams(): Record<string, unknown> {
  const call = getMock.mock.calls.at(-1) as [string, { params?: Record<string, unknown> }] | undefined;
  return call?.[1]?.params ?? {};
}

describe("catalog.service · listCatalogs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes the physical type to Vega before pagination", async () => {
    const { listCatalogs } = await import("@/shared/catalog/catalog.service");

    await listCatalogs({ keyword: "", page: 1, pageSize: 50, type: "physical" });

    expect(lastParams()).toMatchObject({ type: "physical" });
  });

  it("omits the type filter when all catalog types are requested", async () => {
    const { listCatalogs } = await import("@/shared/catalog/catalog.service");

    await listCatalogs({ keyword: "", page: 1, pageSize: 50, type: "all" });

    expect(lastParams()).toMatchObject({ type: undefined });
  });
});

describe("catalog.service · test connection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("tests unsaved connector configuration without creating a catalog", async () => {
    postMock.mockResolvedValue({
      data: { message: "Connection test succeeded.", success: true },
    });
    const { testCatalogConnectionConfig } = await import(
      "@/shared/catalog/catalog.service"
    );

    const result = await testCatalogConnectionConfig({
      connectorConfig: { database: "orders", host: "db.example.com" },
      connectorType: "postgresql",
    });

    expect(postMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/test-connection",
      {
        connector_config: { database: "orders", host: "db.example.com" },
        connector_type: "postgresql",
      },
      { timeout: 60_000 },
    );
    expect(result).toEqual({
      message: "Connection test succeeded.",
      success: true,
    });
  });

  it("returns the business result from an existing catalog test", async () => {
    postMock.mockResolvedValue({
      data: { message: "Connection refused.", success: false },
    });
    const { testCatalogConnection } = await import(
      "@/shared/catalog/catalog.service"
    );

    const result = await testCatalogConnection("catalog-1");

    expect(postMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/catalog-1/test-connection",
      undefined,
      { timeout: 60_000 },
    );
    expect(result).toEqual({
      message: "Connection refused.",
      success: false,
    });
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock, put: putMock },
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
    putMock.mockReset();
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

describe("catalog.service · health check schedule", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes the schedule when creating a physical catalog", async () => {
    postMock.mockResolvedValue({ data: { id: "catalog-1" } });
    const { createPhysicalCatalog } = await import(
      "@/shared/catalog/catalog.service"
    );

    await createPhysicalCatalog(
      {
        connectorConfig: { host: "db.example.com" },
        connectorType: "postgresql",
        description: "",
        enabled: true,
        healthCheckSchedule: { mode: "inherit" },
        name: "orders",
        tags: [],
      },
      {
        allowUnhealthy: true,
        skipErrorToast: true,
      },
    );

    expect(postMock).toHaveBeenCalledWith("/vega-backend/v1/catalogs", {
      connector_config: { host: "db.example.com" },
      connector_type: "postgresql",
      description: "",
      enabled: true,
      health_check_schedule: {
        cron_expr: undefined,
        mode: "inherit",
      },
      name: "orders",
      tags: [],
    }, {
      params: {
        allow_unhealthy: true,
      },
      skipErrorToast: true,
    });
  });

  it("maps a catalog health check schedule", async () => {
    getMock.mockResolvedValue({
      data: {
        catalog_id: "catalog-1",
        cron_expr: "0 * * * *",
        last_run: 1_785_398_400_000,
        mode: "enabled",
        next_run: 1_785_402_000_000,
      },
    });
    const { getCatalogHealthCheckSchedule } = await import(
      "@/shared/catalog/catalog.service"
    );

    const schedule = await getCatalogHealthCheckSchedule("catalog-1");

    expect(getMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/catalog-1/health-check-schedule",
    );
    expect(schedule).toMatchObject({
      catalogId: "catalog-1",
      cronExpr: "0 * * * *",
      mode: "enabled",
    });
    expect(schedule.lastRun).not.toBe("-");
    expect(schedule.nextRun).not.toBe("-");
  });

  it("updates a schedule without sending cron for inherit mode", async () => {
    putMock.mockResolvedValue({
      data: {
        catalog_id: "catalog-1",
        cron_expr: "",
        last_run: 0,
        mode: "inherit",
        next_run: 1_785_402_000_000,
      },
    });
    const { updateCatalogHealthCheckSchedule } = await import(
      "@/shared/catalog/catalog.service"
    );

    const schedule = await updateCatalogHealthCheckSchedule(
      "catalog-1",
      { cronExpr: "0 0 * * *", mode: "inherit" },
    );

    expect(putMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/catalog-1/health-check-schedule",
      {
        cron_expr: undefined,
        mode: "inherit",
      },
    );
    expect(schedule.mode).toBe("inherit");
    expect(schedule.cronExpr).toBe("");
  });
});

describe("catalog.service · mock health check schedule", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps schedule updates when the catalog is loaded again", async () => {
    const {
      createPhysicalCatalog,
      getCatalogHealthCheckSchedule,
      updateCatalogHealthCheckSchedule,
    } = await import("@/shared/catalog/catalog.service");
    const catalogId = await createPhysicalCatalog({
      connectorConfig: { host: "db.example.com" },
      connectorType: "postgresql",
      description: "",
      enabled: true,
      healthCheckSchedule: { cronExpr: "0 */2 * * *", mode: "enabled" },
      name: "orders",
      tags: [],
    });

    await updateCatalogHealthCheckSchedule(catalogId, { mode: "disabled" });

    await expect(getCatalogHealthCheckSchedule(catalogId)).resolves.toMatchObject({
      catalogId,
      cronExpr: "0 */2 * * *",
      mode: "disabled",
      nextRun: "-",
    });
  });
});

describe("catalog.service · allow unhealthy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    putMock.mockReset();
    putMock.mockResolvedValue({ data: undefined });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only sends allow_unhealthy when explicitly requested", async () => {
    const { updateCatalog } = await import(
      "@/shared/catalog/catalog.service"
    );
    const input = {
      connectorConfig: { host: "db.example.com" },
      connectorType: "postgresql",
      description: "",
      enabled: true,
      name: "orders",
      tags: [],
    };

    await updateCatalog("catalog-1", input, { skipErrorToast: true });

    expect(putMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/catalog-1",
      expect.any(Object),
      {
        params: {
          allow_unhealthy: undefined,
        },
        skipErrorToast: true,
      },
    );
  });
});

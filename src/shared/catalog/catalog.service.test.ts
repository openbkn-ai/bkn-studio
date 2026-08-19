/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatCatalogTimestamp } from "@/shared/catalog/catalog-mapper";
import { calculateNextHourlyCronRun } from "@/shared/hourly-cron";

const getMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { delete: deleteMock, get: getMock, post: postMock, put: putMock },
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

describe("catalog.service · deletion preflight", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    deleteMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requests a dry run and maps the complete deletion impact", async () => {
    deleteMock.mockResolvedValue({
      data: {
        blockers: ["discover_tasks_running"],
        build_tasks: { blocking: 0, will_cancel: 1 },
        can_delete: false,
        catalog_health_check_schedules: 1,
        catalog_id: "catalog-1",
        discover_schedules: 2,
        discover_tasks: { blocking: 1, will_cancel: 3 },
        protected_resources: 0,
        resources: 4,
        semantic_understanding_tasks: { blocking: 0, will_cancel: 2 },
      },
    });
    const { previewCatalogDeletion } = await import(
      "@/shared/catalog/catalog.service"
    );

    await expect(previewCatalogDeletion("catalog-1")).resolves.toEqual({
      blockers: ["discover_tasks_running"],
      buildTasks: { blocking: 0, willCancel: 1 },
      canDelete: false,
      catalogHealthCheckSchedules: 1,
      catalogId: "catalog-1",
      discoverSchedules: 2,
      discoverTasks: { blocking: 1, willCancel: 3 },
      protectedResources: 0,
      resources: 4,
      semanticUnderstandingTasks: { blocking: 0, willCancel: 2 },
    });
    expect(deleteMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/catalog-1",
      {
        params: { dry_run: true },
        skipErrorToast: true,
      },
    );
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
      { skipErrorToast: true, timeout: 60_000 },
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
      { skipErrorToast: true, timeout: 60_000 },
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
        update_time: 1_785_398_400_000,
      },
    });
    const { getCatalogHealthCheckSchedule } = await import(
      "@/shared/catalog/catalog.service"
    );

    const schedule = await getCatalogHealthCheckSchedule("catalog-1");

    expect(getMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/catalog-1/health-check-schedule",
      { skipErrorToast: true },
    );
    expect(schedule).toMatchObject({
      catalogId: "catalog-1",
      cronExpr: "0 * * * *",
      expectedUpdateTime: 1_785_398_400_000,
      mode: "enabled",
    });
    expect(schedule.lastRun).not.toBe("-");
    expect(schedule.nextRun).not.toBe("-");
    expect(schedule.updateTime).not.toBe("");
  });

  it("updates a schedule without sending cron for inherit mode", async () => {
    putMock.mockResolvedValue({
      data: {
        catalog_id: "catalog-1",
        cron_expr: "",
        last_run: 0,
        mode: "inherit",
        next_run: 1_785_402_000_000,
        update_time: 124,
      },
    });
    const { updateCatalogHealthCheckSchedule } = await import(
      "@/shared/catalog/catalog.service"
    );

    const schedule = await updateCatalogHealthCheckSchedule(
      "catalog-1",
      { cronExpr: "0 0 * * *", mode: "inherit" },
      123,
    );

    expect(putMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/catalog-1/health-check-schedule",
      {
        cron_expr: undefined,
        expected_update_time: 123,
        mode: "inherit",
      },
      { skipErrorToast: true },
    );
    expect(schedule.mode).toBe("inherit");
    expect(schedule.cronExpr).toBe("");
    expect(schedule.expectedUpdateTime).toBe(124);
    expect(schedule.updateTime).not.toBe("");
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

    const current = await getCatalogHealthCheckSchedule(catalogId);
    await updateCatalogHealthCheckSchedule(
      catalogId,
      { mode: "disabled" },
      current.expectedUpdateTime,
    );

    await expect(getCatalogHealthCheckSchedule(catalogId)).resolves.toMatchObject({
      catalogId,
      cronExpr: "0 */2 * * *",
      mode: "disabled",
      nextRun: "-",
    });

    const disabled = await getCatalogHealthCheckSchedule(catalogId);
    const enabled = await updateCatalogHealthCheckSchedule(
      catalogId,
      { cronExpr: "0 2 * * *", mode: "enabled" },
      disabled.expectedUpdateTime,
    );
    expect(enabled.nextRun).toContain("02:00:00");
  });

  it("schedules inherit mode at the next default cron boundary", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-08-19T10:37:12Z"),
    );
    try {
      const { getCatalogHealthCheckSchedule, updateCatalogHealthCheckSchedule } =
        await import("@/shared/catalog/catalog.service");
      const current = await getCatalogHealthCheckSchedule("cat-001");
      const inherited = await updateCatalogHealthCheckSchedule(
        "cat-001",
        { mode: "inherit" },
        current.expectedUpdateTime,
      );

      expect(inherited.nextRun).toBe(
        formatCatalogTimestamp(calculateNextHourlyCronRun("0 * * * *", Date.now())),
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("rejects stale catalog and health check schedule versions", async () => {
    const {
      getCatalog,
      getCatalogHealthCheckSchedule,
      updateCatalog,
      updateCatalogHealthCheckSchedule,
    } = await import("@/shared/catalog/catalog.service");
    const catalog = await getCatalog("cat-001");
    expect(catalog).not.toBeNull();
    if (!catalog) {
      return;
    }

    await expect(
      updateCatalog("cat-001", {
        connectorConfig: catalog.connectorConfig,
        connectorType: catalog.connectorType,
        description: catalog.description,
        enabled: catalog.enabled,
        expectedUpdateTime: catalog.expectedUpdateTime - 1,
        name: "stale name",
        tags: catalog.tags,
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
    await expect(getCatalog("cat-001")).resolves.toMatchObject({
      expectedUpdateTime: catalog.expectedUpdateTime,
      name: catalog.name,
    });

    const schedule = await getCatalogHealthCheckSchedule("cat-001");
    await expect(
      updateCatalogHealthCheckSchedule(
        "cat-001",
        { mode: "disabled" },
        schedule.expectedUpdateTime - 1,
      ),
    ).rejects.toMatchObject({ response: { status: 409 } });
    await expect(getCatalogHealthCheckSchedule("cat-001")).resolves.toEqual(
      schedule,
    );
  });

  it("matches catalog update validation and not-found precedence", async () => {
    const { getCatalog, setCatalogEnabled, updateCatalog } = await import(
      "@/shared/catalog/catalog.service"
    );
    const catalog = await getCatalog("cat-001");
    expect(catalog).not.toBeNull();
    if (!catalog) {
      return;
    }
    const input = {
      connectorConfig: catalog.connectorConfig,
      connectorType: catalog.connectorType,
      description: catalog.description,
      enabled: catalog.enabled,
      expectedUpdateTime: catalog.expectedUpdateTime - 1,
      name: catalog.name,
      tags: catalog.tags,
    };

    await expect(
      updateCatalog("cat-001", { ...input, expectedUpdateTime: 0 }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.InvalidParameter.RequestBody" },
        status: 400,
      },
    });

    await expect(
      updateCatalog("missing-catalog", input),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.Catalog.NotFound" },
        status: 404,
      },
    });
    await expect(
      updateCatalog("cat-001", { ...input, connectorType: "postgresql" }),
    ).rejects.toMatchObject({
      response: {
        data: {
          error_code: "VegaBackend.Catalog.InvalidParameter.ConnectorType",
        },
        status: 400,
      },
    });
    await expect(
      updateCatalog("cat-001", { ...input, enabled: !catalog.enabled }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.Catalog.EnabledFieldNotAllowed" },
        status: 409,
      },
    });
    await expect(
      setCatalogEnabled("missing-catalog", true),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.Catalog.NotFound" },
        status: 404,
      },
    });
  });

  it("rejects health check schedules for missing and logical catalogs", async () => {
    const {
      getCatalogHealthCheckSchedule,
      updateCatalogHealthCheckSchedule,
    } = await import(
      "@/shared/catalog/catalog.service"
    );

    await expect(
      updateCatalogHealthCheckSchedule("cat-001", { mode: "disabled" }, 0),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.InvalidParameter.RequestBody" },
        status: 400,
      },
    });

    await expect(
      getCatalogHealthCheckSchedule("missing-catalog"),
    ).rejects.toMatchObject({ response: { status: 404 } });
    await expect(
      getCatalogHealthCheckSchedule("adp_bkn_catalog"),
    ).rejects.toMatchObject({ response: { status: 400 } });
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
      expectedUpdateTime: 123,
      name: "orders",
      tags: [],
    };

    await updateCatalog("catalog-1", input, { skipErrorToast: true });

    expect(putMock).toHaveBeenCalledWith(
      "/vega-backend/v1/catalogs/catalog-1",
      expect.objectContaining({ expected_update_time: 123 }),
      {
        params: {
          allow_unhealthy: undefined,
        },
        skipErrorToast: true,
      },
    );
  });
});

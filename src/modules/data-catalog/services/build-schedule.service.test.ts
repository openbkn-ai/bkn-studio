/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const getCatalogMock = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: request }));
vi.mock("@/shared/catalog", () => ({ getCatalog: getCatalogMock, postCatalogDiscover: vi.fn() }));

const input = {
  name: "Nightly rebuild",
  resourceId: "res-customers",
  cronExpr: "CRON_TZ=UTC 0 2 * * *",
  executeType: "full" as const,
};
const backend = {
  id: "schedule-1",
  name: "Nightly rebuild",
  resource_id: "res-customers",
  resource_name: "customers",
  catalog_id: "cat-001",
  catalog_name: "customer_master",
  cron_expr: input.cronExpr,
  execute_type: "full",
  enabled: true,
  start_time: 0,
  end_time: 0,
  last_run: 100,
  next_run: 200,
  last_status: "failed",
  last_message: "Resource primary key configuration is invalid.",
  update_time: 300,
  creator: { id: "creator", name: "Original creator", type: "user" },
};

beforeEach(() => {
  vi.resetModules();
  Object.values(request).forEach((method) => method.mockReset());
  getCatalogMock
    .mockReset()
    .mockImplementation((id: string) => Promise.resolve({ id, operations: ["task_manage"] }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("build schedule API contract", () => {
  beforeEach(() => vi.stubEnv("VITE_USE_MOCK", "false"));

  it("maps the latest result and all list filters without treating success as Task success", async () => {
    request.get.mockResolvedValue({ data: { entries: [backend], total_count: 32 } });
    const { listBuildSchedulePage } = await import("./build-schedule.service");
    const result = await listBuildSchedulePage(
      {
        page: 2,
        pageSize: 10,
        resourceId: "res-customers",
        catalogId: "cat-001",
        name: "Nightly",
        enabled: false,
        executeType: "full",
        sort: "next_run",
        direction: "asc",
      },
      { skipErrorToast: true },
    );
    expect(request.get).toHaveBeenCalledWith("/vega-backend/v1/build-schedules", {
      skipErrorToast: true,
      params: {
        name: "Nightly",
        resource_id: "res-customers",
        catalog_id: "cat-001",
        enabled: false,
        execute_type: "full",
        offset: 10,
        limit: 10,
        sort: "next_run",
        direction: "asc",
      },
    });
    expect(result.total).toBe(32);
    expect(result.items[0]).toMatchObject({
      id: backend.id,
      resourceId: backend.resource_id,
      catalogId: backend.catalog_id,
      executeType: "full",
      lastStatus: "failed",
      lastMessage: backend.last_message,
      lastRun: 100,
      nextRun: 200,
      updateTime: 300,
      creator: backend.creator,
    });
  });

  it("maps all six statuses and treats absent legacy outcomes conservatively", async () => {
    const { getBuildSchedule } = await import("./build-schedule.service");
    for (const status of ["never", "unknown", "triggering", "success", "skipped", "failed"]) {
      request.get.mockResolvedValueOnce({ data: { ...backend, last_status: status } });
      expect((await getBuildSchedule(backend.id)).lastStatus).toBe(status);
    }
    request.get.mockResolvedValueOnce({ data: { ...backend, last_status: undefined } });
    expect((await getBuildSchedule(backend.id)).lastStatus).toBe("unknown");
  });

  it("creates disabled schedules and never sends result or creator fields", async () => {
    request.post.mockResolvedValue({ data: { id: "created" } });
    const { createBuildSchedule } = await import("./build-schedule.service");
    await expect(
      createBuildSchedule({
        ...input,
        ...{ lastStatus: "success", lastMessage: "forged", creator: { id: "forged" } },
      }),
    ).resolves.toBe("created");
    expect(request.post).toHaveBeenCalledWith(
      "/vega-backend/v1/build-schedules",
      {
        name: input.name,
        resource_id: input.resourceId,
        cron_expr: input.cronExpr,
        execute_type: "full",
        enabled: false,
        start_time: 0,
        end_time: 0,
      },
      {},
    );
    expect(request.get).not.toHaveBeenCalled();
  });

  it("preserves the current enabled state when omitted and submits the original expected version", async () => {
    request.get.mockResolvedValue({ data: backend });
    request.put.mockResolvedValue({ data: undefined });
    const { updateBuildSchedule } = await import("./build-schedule.service");
    await updateBuildSchedule("schedule-1", input, 123, { skipErrorToast: true });
    expect(request.put).toHaveBeenCalledWith(
      "/vega-backend/v1/build-schedules/schedule-1",
      {
        name: input.name,
        resource_id: input.resourceId,
        cron_expr: input.cronExpr,
        execute_type: "full",
        enabled: true,
        start_time: 0,
        end_time: 0,
        expected_update_time: 123,
      },
      { skipErrorToast: true },
    );
  });

  it("uses dedicated state actions and propagates version conflicts", async () => {
    request.post.mockResolvedValue({ data: undefined });
    request.delete.mockResolvedValue({ data: undefined });
    const conflict = new Error("version conflict");
    request.put.mockRejectedValue(conflict);
    const { updateBuildSchedule, setBuildScheduleEnabled, deleteBuildSchedule } =
      await import("./build-schedule.service");
    await expect(updateBuildSchedule("schedule-1", { ...input, enabled: true }, 300)).rejects.toBe(
      conflict,
    );
    expect(request.get).not.toHaveBeenCalled();
    await setBuildScheduleEnabled("schedule-1", false);
    await setBuildScheduleEnabled("schedule-1", true);
    await deleteBuildSchedule("schedule-1");
    expect(request.post).toHaveBeenCalledWith(
      "/vega-backend/v1/build-schedules/schedule-1/disable",
      undefined,
      {},
    );
    expect(request.post).toHaveBeenCalledWith(
      "/vega-backend/v1/build-schedules/schedule-1/enable",
      undefined,
      {},
    );
    expect(request.delete).toHaveBeenCalledWith("/vega-backend/v1/build-schedules/schedule-1", {});
  });
});

describe("build schedule mock semantics", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-14T12:15:00Z"));
  });

  it("allows multiple plans before a baseline exists, without creating Tasks or scheduling timers", async () => {
    const service = await import("./build-schedule.service");
    const { mockBuildTasks, mockResources } = await import("./mock-db");
    const resource = mockResources.find((item) => item.id === input.resourceId)!;
    resource.indexConfig = undefined;
    resource.localIndexStatus = "unavailable";
    const initialTasks = mockBuildTasks.length;
    const first = await service.createBuildSchedule(input);
    const second = await service.createBuildSchedule({ ...input, executeType: "incremental" });
    expect(first).not.toBe(second);
    expect(await service.getBuildSchedule(first)).toMatchObject({
      enabled: false,
      lastStatus: "never",
      lastRun: 0,
      lastMessage: "",
    });
    expect(mockBuildTasks).toHaveLength(initialTasks);
    expect(vi.getTimerCount()).toBe(0);
    expect(
      (await service.listBuildSchedulePage({ resourceId: input.resourceId })).items.map(
        (item) => item.id,
      ),
    ).toEqual(expect.arrayContaining([first, second]));
  });

  it("rejects stale versions, rebound resources and state changes through PUT", async () => {
    const service = await import("./build-schedule.service");
    const id = await service.createBuildSchedule(input);
    const current = await service.getBuildSchedule(id);
    await service.updateBuildSchedule(id, { ...input, name: "Updated" }, current.updateTime);
    await expect(service.updateBuildSchedule(id, input, current.updateTime)).rejects.toMatchObject({
      response: { status: 409, data: { error_code: "VegaBackend.BuildSchedule.UpdateConflict" } },
    });
    const updated = await service.getBuildSchedule(id);
    await expect(
      service.updateBuildSchedule(id, { ...input, resourceId: "res-orders" }, updated.updateTime),
    ).rejects.toMatchObject({
      response: { data: { error_code: "VegaBackend.BuildSchedule.ResourceMismatch" } },
    });
    await expect(
      service.updateBuildSchedule(id, { ...input, enabled: true }, updated.updateTime),
    ).rejects.toMatchObject({
      response: { data: { error_code: "VegaBackend.BuildSchedule.EnabledFieldNotAllowed" } },
    });
  });

  it("preserves creator and recent errors across edits and state actions, and returns detached snapshots", async () => {
    const service = await import("./build-schedule.service");
    const current = await service.getBuildSchedule("bs-customers-incremental");
    const edited = { ...input, enabled: true, executeType: "incremental" as const };
    await service.updateBuildSchedule(current.id, edited, current.updateTime);
    await service.setBuildScheduleEnabled(current.id, false);
    await service.setBuildScheduleEnabled(current.id, true);
    const result = await service.getBuildSchedule(current.id);
    expect(result.creator).toEqual(current.creator);
    expect(result.lastStatus).toBe("failed");
    expect(result.lastMessage).toBe(current.lastMessage);
    result.name = "local mutation";
    expect((await service.getBuildSchedule(current.id)).name).toBe(input.name);
  });

  it("filters and counts before pagination, including enabled=false", async () => {
    const service = await import("./build-schedule.service");
    const result = await service.listBuildSchedulePage({
      page: 1,
      pageSize: 1,
      catalogId: "cat-001",
      enabled: true,
      executeType: "incremental",
      sort: "name",
      direction: "asc",
    });
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("bs-customers-incremental");
    expect((await service.listBuildSchedulePage({ enabled: false })).total).toBe(1);
  });

  it("enforces task-manage permission for mutations and hides inaccessible list entries", async () => {
    getCatalogMock.mockResolvedValue({ id: "cat-001", operations: ["view_detail"] });
    const service = await import("./build-schedule.service");
    expect(await service.listBuildSchedulePage({})).toEqual({ items: [], total: 0 });
    await expect(service.getBuildSchedule("bs-customers-full")).rejects.toMatchObject({
      response: { status: 403 },
    });
    await expect(service.createBuildSchedule(input)).rejects.toMatchObject({
      response: { status: 403 },
    });
    await expect(service.setBuildScheduleEnabled("bs-customers-full", true)).rejects.toMatchObject({
      response: { status: 403 },
    });
  });

  it("rejects invalid cron, timezone, execution type and validity window", async () => {
    const { createBuildSchedule } = await import("./build-schedule.service");
    for (const [change, code] of [
      [{ cronExpr: "*/30 * * * *" }, "InvalidCronExpr"],
      [{ cronExpr: "CRON_TZ=Invalid/Zone 0 * * * *" }, "InvalidCronExpr"],
      [{ startTime: 20, endTime: 10 }, "InvalidTimeRange"],
      [{ executeType: "streaming" }, "InvalidExecuteType"],
    ] as const) {
      await expect(
        createBuildSchedule({ ...input, ...change } as typeof input),
      ).rejects.toMatchObject({
        response: { status: 400, data: { error_code: `VegaBackend.BuildSchedule.${code}` } },
      });
    }
  });

  it("removes a plan without changing generated Task history or its provenance", async () => {
    const { deleteBuildSchedule } = await import("./build-schedule.service");
    const { mockBuildTasks } = await import("./mock-db");
    const task = mockBuildTasks.find((item) => item.scheduleId === "bs-orders-incremental");
    expect(task).toBeDefined();
    const before = structuredClone(task);
    await deleteBuildSchedule("bs-orders-incremental");
    expect(mockBuildTasks.find((item) => item.id === task!.id)).toEqual(before);
  });
});

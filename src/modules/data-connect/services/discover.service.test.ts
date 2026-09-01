/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, put: putMock },
}));

describe("discover.service · task status contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves cancelled tasks returned by Vega", async () => {
    getMock.mockResolvedValue({
      data: {
        entries: [
          {
            catalog_id: "catalog-1",
            create_time: 100,
            finish_time: 300,
            id: "task-1",
            last_progress_time: 250,
            start_time: 200,
            status: "cancelled",
            queue_priority: 30,
            resource_id: "resource-1",
          },
        ],
        total_count: 1,
      },
    });
    const { listDataConnectDiscoverTasks } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    const result = await listDataConnectDiscoverTasks({
      page: 1,
      pageSize: 20,
      statuses: ["cancelled"],
    });

    expect(result.items[0]?.status).toBe("cancelled");
    expect(result.items[0]?.createTime).toBe(100);
    expect(result.items[0]?.startTime).toBe(200);
    expect(result.items[0]?.finishTime).toBe(300);
    expect(result.items[0]?.lastProgressTime).toBe(250);
    expect(result.items[0]?.queuePriority).toBe(30);
    expect(result.items[0]?.resourceId).toBe("resource-1");
    expect(result.items[0]).not.toHaveProperty("startTimeValue");
    expect(result.items[0]).not.toHaveProperty("finishTimeValue");
    expect(getMock).toHaveBeenCalledOnce();
    expect(getMock.mock.calls[0]?.[0]).toBe("/vega-backend/v1/discover-tasks");
    const config = getMock.mock.calls[0]?.[1] as { params: Record<string, unknown> };
    expect(config.params.status).toEqual(["cancelled"]);
    expect(config.params.resource_id).toBeUndefined();
  });

  it("maps a resource task filter without exposing priority as a sort", async () => {
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
    const { listDataConnectDiscoverTasks } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    await listDataConnectDiscoverTasks({ page: 1, pageSize: 20, resourceId: "resource-1" });

    const config = getMock.mock.calls[0]?.[1] as { params: Record<string, unknown> };
    expect(config.params.resource_id).toBe("resource-1");
    expect(config.params).not.toHaveProperty("queue_priority");
  });
});

describe("discover.service · update schedule", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    putMock.mockReset();
    putMock.mockResolvedValue({ data: undefined });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the version read by the editor", async () => {
    const { updateDataConnectDiscoverSchedule } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    await updateDataConnectDiscoverSchedule("schedule-1", {
      catalogId: "catalog-1",
      cronExpr: "0 0 * * *",
      enabled: true,
      expectedUpdateTime: 123,
      name: "nightly",
      strategy: "full_sync",
    });

    expect(putMock).toHaveBeenCalledWith(
      "/vega-backend/v1/discover-schedules/schedule-1",
      expect.objectContaining({ expected_update_time: 123 }),
    );
  });

  it("keeps a formatted update time and the raw expected version", async () => {
    getMock.mockResolvedValue({
      data: {
        catalog_id: "catalog-1",
        create_time: 100,
        cron_expr: "0 0 * * *",
        enabled: true,
        end_time: 0,
        id: "schedule-1",
        last_run: 0,
        name: "nightly",
        next_run: 200,
        start_time: 0,
        strategy: "full_sync",
        update_time: 123,
      },
    });
    const { getDataConnectDiscoverSchedule } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    const schedule = await getDataConnectDiscoverSchedule("schedule-1");

    expect(schedule?.expectedUpdateTime).toBe(123);
    expect(schedule?.updateTime).toEqual(expect.any(String));
  });
});

describe("discover.service · mock task sorting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sorts by the selected lifecycle timestamp", async () => {
    const { listDataConnectDiscoverTasks } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    const result = await listDataConnectDiscoverTasks({
      direction: "asc",
      page: 1,
      pageSize: 20,
      sort: "last_progress_time",
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "discover-task-1005",
      "discover-task-1004",
      "discover-task-1003",
      "discover-task-1001",
      "discover-task-1002",
    ]);
  });

  it("covers every Vega discover-task status", async () => {
    const { listDataConnectDiscoverTasks } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    const result = await listDataConnectDiscoverTasks({ page: 1, pageSize: 20 });

    expect(new Set(result.items.map((task) => task.status))).toEqual(new Set([
      "pending",
      "running",
      "completed",
      "failed",
      "cancelled",
    ]));
  });

  it("includes a partially progressed cancelled mock task", async () => {
    const { listDataConnectDiscoverTasks } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    const result = await listDataConnectDiscoverTasks({
      page: 1,
      pageSize: 20,
      statuses: ["cancelled"],
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "discover-task-1004",
        progress: 44,
        status: "cancelled",
      }),
    ]);
  });

  it("does not associate manually triggered mock tasks with a discover schedule", async () => {
    const { listDataConnectDiscoverTasks } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    const result = await listDataConnectDiscoverTasks({ page: 1, pageSize: 20 });

    const manualTasks = result.items.filter((item) => item.triggerType === "manual");
    expect(manualTasks).not.toHaveLength(0);
    manualTasks.forEach((item) => expect(item.scheduleId).toBeUndefined());
  });

  it("rejects a stale discover schedule version", async () => {
    const {
      getDataConnectDiscoverSchedule,
      updateDataConnectDiscoverSchedule,
    } = await import("@/modules/data-connect/services/discover.service");
    const schedule = await getDataConnectDiscoverSchedule("discover-schedule-001");
    expect(schedule).not.toBeNull();
    if (!schedule) {
      return;
    }

    await expect(
      updateDataConnectDiscoverSchedule(schedule.id, {
        catalogId: schedule.catalogId,
        cronExpr: schedule.cronExpr,
        enabled: schedule.enabled,
        expectedUpdateTime: schedule.expectedUpdateTime - 1,
        name: "stale name",
        strategy: schedule.strategy,
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
    await expect(getDataConnectDiscoverSchedule(schedule.id)).resolves.toEqual(
      schedule,
    );
  });

  it("matches discover schedule update validation and not-found precedence", async () => {
    const {
      getDataConnectDiscoverSchedule,
      setDataConnectDiscoverScheduleEnabled,
      updateDataConnectDiscoverSchedule,
    } = await import("@/modules/data-connect/services/discover.service");
    const schedule = await getDataConnectDiscoverSchedule("discover-schedule-001");
    expect(schedule).not.toBeNull();
    if (!schedule) {
      return;
    }
    const input = {
      catalogId: schedule.catalogId,
      cronExpr: schedule.cronExpr,
      enabled: schedule.enabled,
      expectedUpdateTime: schedule.expectedUpdateTime - 1,
      name: schedule.name,
      strategy: schedule.strategy,
    };

    await expect(
      updateDataConnectDiscoverSchedule(schedule.id, {
        ...input,
        expectedUpdateTime: 0,
      }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.InvalidParameter.RequestBody" },
        status: 400,
      },
    });

    await expect(
      updateDataConnectDiscoverSchedule("missing-schedule", input),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.DiscoverSchedule.NotFound" },
        status: 404,
      },
    });
    await expect(
      updateDataConnectDiscoverSchedule(schedule.id, {
        ...input,
        catalogId: "cat-002",
      }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.DiscoverSchedule.CatalogMismatch" },
        status: 409,
      },
    });
    await expect(
      updateDataConnectDiscoverSchedule(schedule.id, {
        ...input,
        enabled: !schedule.enabled,
      }),
    ).rejects.toMatchObject({
      response: {
        data: {
          error_code: "VegaBackend.DiscoverSchedule.EnabledFieldNotAllowed",
        },
        status: 409,
      },
    });
    await expect(
      setDataConnectDiscoverScheduleEnabled("missing-schedule", true),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.DiscoverSchedule.NotFound" },
        status: 404,
      },
    });
  });

  it("calculates the next run when a mock schedule is created or enabled", async () => {
    const {
      createDataConnectDiscoverSchedule,
      getDataConnectDiscoverSchedule,
      listDataConnectDiscoverSchedules,
      setDataConnectDiscoverScheduleEnabled,
      updateDataConnectDiscoverSchedule,
    } = await import("@/modules/data-connect/services/discover.service");
    const now = Date.now();

    await createDataConnectDiscoverSchedule({
      catalogId: "cat-001",
      cronExpr: "0 * * * *",
      enabled: true,
      name: "Next run on create",
      strategy: "full_sync",
    });
    const created = (
      await listDataConnectDiscoverSchedules({ keyword: "", page: 1, pageSize: 100 })
    ).items.find((item) => item.name === "Next run on create");
    expect(created?.nextRunValue).toBeGreaterThan(now);
    expect(created?.nextRun).not.toBe("-");

    await createDataConnectDiscoverSchedule({
      catalogId: "cat-001",
      cronExpr: "0 * * * *",
      enabled: false,
      name: "Disabled next run",
      strategy: "full_sync",
    });
    const disabledCreated = (
      await listDataConnectDiscoverSchedules({ keyword: "", page: 1, pageSize: 100 })
    ).items.find((item) => item.name === "Disabled next run");
    expect(disabledCreated?.nextRunValue).toBeGreaterThan(now);
    expect(disabledCreated?.nextRun).not.toBe("-");

    const disabled = await getDataConnectDiscoverSchedule("discover-schedule-003");
    expect(disabled).not.toBeNull();
    if (!disabled) {
      return;
    }
    await setDataConnectDiscoverScheduleEnabled(disabled.id, true);
    const enabled = await getDataConnectDiscoverSchedule(disabled.id);
    expect(enabled?.nextRunValue).toBeGreaterThan(now);
    expect(enabled?.nextRun).not.toBe("-");

    if (!enabled) {
      return;
    }
    await updateDataConnectDiscoverSchedule(enabled.id, {
      catalogId: enabled.catalogId,
      cronExpr: "15 * * * *",
      enabled: enabled.enabled,
      expectedUpdateTime: enabled.expectedUpdateTime,
      name: enabled.name,
      strategy: enabled.strategy,
    });
    const updated = await getDataConnectDiscoverSchedule(enabled.id);
    expect(new Date(updated?.nextRunValue ?? 0).getMinutes()).toBe(15);
    expect(updated?.nextRunValue).not.toBe(enabled.nextRunValue);
  });

  it("rejects an invalid or sub-hour cron in mock mode", async () => {
    const {
      createDataConnectDiscoverSchedule,
      getDataConnectDiscoverSchedule,
      updateDataConnectDiscoverSchedule,
    } = await import("@/modules/data-connect/services/discover.service");

    await expect(
      createDataConnectDiscoverSchedule({
        catalogId: "cat-001",
        cronExpr: "*/30 * * * *",
        enabled: true,
        name: "Too frequent",
        strategy: "full_sync",
      }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.DiscoverSchedule.InvalidCronExpr" },
        status: 400,
      },
    });

    const current = await getDataConnectDiscoverSchedule("discover-schedule-001");
    expect(current).not.toBeNull();
    if (!current) {
      return;
    }
    await expect(
      updateDataConnectDiscoverSchedule(current.id, {
        catalogId: current.catalogId,
        cronExpr: "0 invalid * * *",
        enabled: current.enabled,
        expectedUpdateTime: current.expectedUpdateTime,
        name: current.name,
        strategy: current.strategy,
      }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.DiscoverSchedule.InvalidCronExpr" },
        status: 400,
      },
    });
  });

  it("rejects an invalid time range in mock mode", async () => {
    const { createDataConnectDiscoverSchedule } = await import(
      "@/modules/data-connect/services/discover.service"
    );

    await expect(
      createDataConnectDiscoverSchedule({
        catalogId: "cat-001",
        cronExpr: "0 * * * *",
        enabled: true,
        endTime: 100,
        name: "Invalid time range",
        startTime: 200,
        strategy: "full_sync",
      }),
    ).rejects.toMatchObject({
      response: {
        data: { error_code: "VegaBackend.DiscoverSchedule.InvalidTimeRange" },
        status: 400,
      },
    });
  });
});

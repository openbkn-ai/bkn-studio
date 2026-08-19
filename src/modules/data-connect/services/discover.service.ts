/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  throwMockRequestError,
  validateMockExpectedUpdateTime,
} from "@/framework/request/mock-error";
import i18n from "@/app/locales/i18n";
import { postCatalogDiscover } from "@/shared/catalog";
import type {
  DataConnectDiscoverSchedule,
  DataConnectDiscoverScheduleListQuery,
  DataConnectDiscoverScheduleListResult,
  DataConnectDiscoverSchedulePayload,
  DataConnectDiscoverScheduleUpdatePayload,
  DataConnectDiscoverStrategy,
  DataConnectDiscoverTask,
  DataConnectDiscoverTaskListQuery,
  DataConnectDiscoverTaskListResult,
  DataConnectDiscoverTaskStatus,
  DataConnectDiscoverTaskSummary,
  DataConnectDiscoverTaskTriggerType,
} from "@/modules/data-connect/types/discover";
import { isValidDiscoverScheduleTimeRange } from "@/modules/data-connect/utils/discover-schedule-time";
import {
  calculateNextHourlyCronRun,
  isHourlyCron,
} from "@/modules/data-connect/utils/health-check-cron";

type BackendAccountInfo = {
  id?: string | null;
  name?: string | null;
};

type BackendDiscoverSchedule = {
  catalog_id: string;
  catalog_name?: string;
  create_time?: number;
  creator?: BackendAccountInfo;
  cron_expr: string;
  enabled: boolean;
  end_time?: number;
  id: string;
  last_run?: number;
  name: string;
  next_run?: number;
  start_time?: number;
  strategy?: string;
  update_time?: number;
  updater?: BackendAccountInfo;
};

type BackendDiscoverTask = {
  catalog_id: string;
  catalog_name?: string;
  create_time?: number;
  creator?: BackendAccountInfo;
  finish_time?: number;
  id: string;
  last_progress_time?: number;
  message?: string;
  progress?: number;
  result?: {
    catalog_id?: string;
    failed_count?: number;
    message?: string;
    new_count?: number;
    restored_count?: number;
    stale_count?: number;
    unchanged_count?: number;
    updated_count?: number;
  };
  schedule_id?: string;
  start_time?: number;
  status?: string;
  strategy?: string;
  trigger_type?: string;
};

type BackendDiscoverTaskSummary = Omit<BackendDiscoverTask, "message" | "result"> & {
  result?: Omit<NonNullable<BackendDiscoverTask["result"]>, "message">;
};

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

function discoverMockText(key: string, options?: Record<string, unknown>) {
  return i18n.t(`dataConnect.discoverMock.${key}`, options);
}

let mockSchedules: DataConnectDiscoverSchedule[] = [
  {
    id: "discover-schedule-001",
    name: discoverMockText("customerSyncSchedule"),
    catalogId: "cat-001",
    cronExpr: "0 2 * * *",
    startTime: "2026-06-01 02:00:00",
    endTime: "-",
    enabled: true,
    strategy: "full_sync",
    lastRun: "2026-06-03 02:00:11",
    nextRun: "2026-06-04 02:00:00",
    creatorName: "Platform Admin",
    updaterName: "Platform Admin",
    createTime: "2026-06-01 10:00:00",
    expectedUpdateTime: Date.parse("2026-06-03T02:00:11Z"),
    updateTime: "2026-06-03 02:00:11",
  },
  {
    id: "discover-schedule-002",
    name: discoverMockText("knowledgeIndexSchedule"),
    catalogId: "cat-002",
    cronExpr: "30 * * * *",
    startTime: "2026-06-02 09:00:00",
    endTime: "-",
    enabled: true,
    strategy: "create_only",
    lastRun: "2026-06-03 11:30:08",
    nextRun: "2026-06-03 12:30:00",
    creatorName: "Search Team",
    updaterName: "Search Team",
    createTime: "2026-06-02 09:00:00",
    expectedUpdateTime: Date.parse("2026-06-03T11:30:08Z"),
    updateTime: "2026-06-03 11:30:08",
  },
  {
    id: "discover-schedule-003",
    name: discoverMockText("financeCleanupSchedule"),
    catalogId: "cat-003",
    cronExpr: "0 3 * * 1",
    startTime: "2026-05-26 03:00:00",
    endTime: "-",
    enabled: false,
    strategy: "cleanup_only",
    lastRun: "2026-06-02 03:00:00",
    nextRun: "2026-06-09 03:00:00",
    creatorName: "Data Ops",
    updaterName: "Data Ops",
    createTime: "2026-05-26 03:00:00",
    expectedUpdateTime: Date.parse("2026-06-02T03:00:00Z"),
    updateTime: "2026-06-02 03:00:00",
  },
];

let mockTasks: DataConnectDiscoverTask[] = [
  {
    id: "discover-task-1001",
    catalogId: "cat-001",
    scheduleId: "discover-schedule-001",
    strategy: "full_sync",
    triggerType: "scheduled",
    status: "completed",
    progress: 100,
    message: discoverMockText("syncCompleted", { count: 48 }),
    startTime: Date.parse("2026-06-03T02:00:11"),
    finishTime: Date.parse("2026-06-03T02:12:04"),
    lastProgressTime: Date.parse("2026-06-03T02:11:50"),
    creatorName: "Platform Admin",
    createTime: Date.parse("2026-06-03T02:00:11"),
  },
  {
    id: "discover-task-1002",
    catalogId: "cat-002",
    scheduleId: "discover-schedule-002",
    strategy: "create_only",
    triggerType: "scheduled",
    status: "running",
    progress: 56,
    message: discoverMockText("pullingIndexChanges"),
    startTime: Date.parse("2026-06-03T11:30:08"),
    lastProgressTime: Date.parse("2026-06-03T11:42:20"),
    creatorName: "Search Team",
    createTime: Date.parse("2026-06-03T11:30:08"),
  },
  {
    id: "discover-task-1003",
    catalogId: "cat-003",
    scheduleId: "discover-schedule-003",
    strategy: "cleanup_only",
    triggerType: "manual",
    status: "failed",
    progress: 100,
    message: discoverMockText("cleanupTimeout"),
    startTime: Date.parse("2026-06-02T03:00:00"),
    finishTime: Date.parse("2026-06-02T03:03:15"),
    lastProgressTime: Date.parse("2026-06-02T03:02:55"),
    creatorName: "Data Ops",
    createTime: Date.parse("2026-06-02T03:00:00"),
  },
];

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 180);
  });

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(i18n.language || "en-US", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(value)
    .replace(/\//g, "-");
}

function normalizeStrategy(value?: string): DataConnectDiscoverStrategy {
  switch (value) {
    case "create_only":
    case "cleanup_only":
      return value;
    default:
      return "full_sync";
  }
}

function normalizeTaskStatus(value?: string): DataConnectDiscoverTaskStatus {
  switch (value) {
    case "running":
    case "completed":
    case "failed":
    case "cancelled":
      return value;
    default:
      return "pending";
  }
}

function normalizeTriggerType(value?: string): DataConnectDiscoverTaskTriggerType {
  return value === "scheduled" ? "scheduled" : "manual";
}

function mapSchedule(item: BackendDiscoverSchedule): DataConnectDiscoverSchedule {
  return {
    id: item.id,
    name: item.name,
    catalogId: item.catalog_id,
    catalogName: item.catalog_name,
    cronExpr: item.cron_expr,
    startTime: formatTimestamp(item.start_time),
    startTimeValue: item.start_time,
    endTime: formatTimestamp(item.end_time),
    endTimeValue: item.end_time,
    enabled: item.enabled,
    strategy: normalizeStrategy(item.strategy),
    lastRun: formatTimestamp(item.last_run),
    lastRunValue: item.last_run,
    nextRun: formatTimestamp(item.next_run),
    nextRunValue: item.next_run,
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
    createTime: formatTimestamp(item.create_time),
    expectedUpdateTime: item.update_time ?? 0,
    updateTime: formatTimestamp(item.update_time),
  };
}

function mapTask(item: BackendDiscoverTask): DataConnectDiscoverTask {
  return {
    id: item.id,
    catalogId: item.catalog_id,
    catalogName: item.catalog_name,
    scheduleId: item.schedule_id ?? "",
    strategy: normalizeStrategy(item.strategy),
    triggerType: normalizeTriggerType(item.trigger_type),
    status: normalizeTaskStatus(item.status),
    progress: item.progress ?? 0,
    result: item.result
      ? {
          catalogId: item.result.catalog_id ?? item.catalog_id,
          failedCount: item.result.failed_count ?? 0,
          message: item.result.message ?? "",
          newCount: item.result.new_count ?? 0,
          restoredCount: item.result.restored_count ?? 0,
          staleCount: item.result.stale_count ?? 0,
          unchangedCount: item.result.unchanged_count ?? 0,
          updatedCount: item.result.updated_count ?? 0,
        }
      : undefined,
    message: item.message ?? "",
    startTime: item.start_time,
    finishTime: item.finish_time,
    lastProgressTime: item.last_progress_time,
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    createTime: item.create_time ?? 0,
  };
}

function toTaskSummary(task: DataConnectDiscoverTask): DataConnectDiscoverTaskSummary {
  const fullResult = task.result;
  const result = fullResult
    ? {
        catalogId: fullResult.catalogId,
        failedCount: fullResult.failedCount,
        newCount: fullResult.newCount,
        restoredCount: fullResult.restoredCount,
        staleCount: fullResult.staleCount,
        unchangedCount: fullResult.unchangedCount,
        updatedCount: fullResult.updatedCount,
      }
    : undefined;

  return {
    catalogId: task.catalogId,
    catalogName: task.catalogName,
    createTime: task.createTime,
    creatorName: task.creatorName,
    finishTime: task.finishTime,
    id: task.id,
    lastProgressTime: task.lastProgressTime,
    progress: task.progress,
    result,
    scheduleId: task.scheduleId,
    startTime: task.startTime,
    status: task.status,
    strategy: task.strategy,
    triggerType: task.triggerType,
  };
}

function mapTaskSummary(item: BackendDiscoverTaskSummary): DataConnectDiscoverTaskSummary {
  return toTaskSummary(mapTask(item));
}

function filterSchedules(
  items: DataConnectDiscoverSchedule[],
  query: DataConnectDiscoverScheduleListQuery,
) {
  const keyword = query.keyword.trim().toLowerCase();

  return items.filter((item) => {
    const matchesKeyword =
      keyword.length === 0 || item.name.toLowerCase().includes(keyword);
    const matchesCatalog = !query.catalogId || item.catalogId === query.catalogId;
    const matchesEnabled =
      query.enabled === undefined || item.enabled === query.enabled;

    return matchesKeyword && matchesCatalog && matchesEnabled;
  });
}

function filterTasks(items: DataConnectDiscoverTask[], query: DataConnectDiscoverTaskListQuery) {
  const filtered = items.filter((item) => {
    const matchesCatalog = !query.catalogId || item.catalogId === query.catalogId;
    const matchesSchedule =
      !query.scheduleId || item.scheduleId === query.scheduleId;
    const matchesStatus = !query.status || item.status === query.status;
    const matchesStrategy = !query.strategy || item.strategy === query.strategy;
    const matchesTriggerType =
      !query.triggerType || item.triggerType === query.triggerType;

    return (
      matchesCatalog &&
      matchesSchedule &&
      matchesStatus &&
      matchesStrategy &&
      matchesTriggerType
    );
  });
  const direction = query.direction === "asc" ? 1 : -1;
  const timestampOf = (task: DataConnectDiscoverTask) => {
    switch (query.sort) {
      case "start_time":
        return task.startTime ?? 0;
      case "finish_time":
        return task.finishTime ?? 0;
      case "last_progress_time":
        return task.lastProgressTime ?? 0;
      default:
        return task.createTime;
    }
  };
  return filtered.sort((left, right) => (timestampOf(left) - timestampOf(right)) * direction);
}

export async function listDataConnectDiscoverSchedules(
  query: DataConnectDiscoverScheduleListQuery,
): Promise<DataConnectDiscoverScheduleListResult> {
  if (useMock) {
    const filtered = filterSchedules(mockSchedules, query);
    const startIndex = (query.page - 1) * query.pageSize;

    return wait({
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    });
  }

  const response = await http.get<ListResponse<BackendDiscoverSchedule>>(
    "/vega-backend/v1/discover-schedules",
    {
      params: {
        catalog_id: query.catalogId,
        direction: "desc",
        enabled: query.enabled,
        limit: query.pageSize,
        name: query.keyword.trim() || undefined,
        offset: (query.page - 1) * query.pageSize,
        sort: "update_time",
      },
    },
  );

  return {
    items: response.data.entries.map(mapSchedule),
    total: response.data.total_count,
  };
}

export async function getDataConnectDiscoverSchedule(id: string) {
  if (useMock) {
    return wait(mockSchedules.find((item) => item.id === id) ?? null);
  }

  const response = await http.get<BackendDiscoverSchedule>(
    `/vega-backend/v1/discover-schedules/${id}`,
  );

  return mapSchedule(response.data);
}

export async function createDataConnectDiscoverSchedule(
  input: DataConnectDiscoverSchedulePayload,
) {
  if (useMock) {
    validateMockDiscoverCron(input.cronExpr);
    validateMockDiscoverTimeRange(input.startTime, input.endTime);
    const now = Date.now();
    const nextRunValue = calculateNextHourlyCronRun(
      input.cronExpr,
      now,
      input.startTime,
    );
    mockSchedules = [
      {
        id: crypto.randomUUID(),
        name: input.name,
        catalogId: input.catalogId,
        cronExpr: input.cronExpr,
        startTime: formatTimestamp(input.startTime),
        startTimeValue: input.startTime,
        endTime: formatTimestamp(input.endTime),
        endTimeValue: input.endTime,
        enabled: input.enabled,
        strategy: input.strategy,
        lastRun: "-",
        nextRun: formatTimestamp(nextRunValue),
        nextRunValue,
        creatorName: "Local Admin",
        updaterName: "Local Admin",
        createTime: formatTimestamp(now),
        expectedUpdateTime: now,
        updateTime: formatTimestamp(now),
      },
      ...mockSchedules,
    ];
    await wait(undefined);
    return;
  }

  await http.post("/vega-backend/v1/discover-schedules", {
    catalog_id: input.catalogId,
    cron_expr: input.cronExpr,
    enabled: input.enabled,
    end_time: input.endTime ?? 0,
    name: input.name,
    start_time: input.startTime ?? 0,
    strategy: input.strategy,
  });
}

export async function updateDataConnectDiscoverSchedule(
  id: string,
  input: DataConnectDiscoverScheduleUpdatePayload,
) {
  if (useMock) {
    const current = mockSchedules.find((item) => item.id === id);
    if (!current) {
      throwMockRequestError(
        404,
        "VegaBackend.DiscoverSchedule.NotFound",
        "Discover schedule not found.",
      );
    }
    validateMockDiscoverCron(input.cronExpr);
    validateMockDiscoverTimeRange(input.startTime, input.endTime);
    validateMockExpectedUpdateTime(input.expectedUpdateTime);
    if (current.catalogId !== input.catalogId) {
      throwMockRequestError(
        409,
        "VegaBackend.DiscoverSchedule.CatalogMismatch",
        "Discover schedule catalog cannot be changed.",
      );
    }
    if (current.enabled !== input.enabled) {
      throwMockRequestError(
        409,
        "VegaBackend.DiscoverSchedule.EnabledFieldNotAllowed",
        "Use the enable or disable action to change discover schedule state.",
      );
    }
    if (current.expectedUpdateTime !== input.expectedUpdateTime) {
      throwMockRequestError(
        409,
        "VegaBackend.DiscoverSchedule.UpdateConflict",
        "Discover schedule has been updated. Reload it and try again.",
      );
    }
    const now = Date.now();
    const nextRunValue = calculateNextHourlyCronRun(
      input.cronExpr,
      now,
      input.startTime,
    );
    mockSchedules = mockSchedules.map((item) =>
      item.id === id
        ? {
            ...item,
            name: input.name,
            cronExpr: input.cronExpr,
            startTime: formatTimestamp(input.startTime),
            startTimeValue: input.startTime,
            endTime: formatTimestamp(input.endTime),
            endTimeValue: input.endTime,
            strategy: input.strategy,
            nextRun: formatTimestamp(nextRunValue),
            nextRunValue,
            expectedUpdateTime: now,
            updateTime: formatTimestamp(now),
          }
        : item,
    );
    await wait(undefined);
    return;
  }

  await http.put(`/vega-backend/v1/discover-schedules/${id}`, {
    catalog_id: input.catalogId,
    cron_expr: input.cronExpr,
    enabled: input.enabled,
    expected_update_time: input.expectedUpdateTime,
    end_time: input.endTime ?? 0,
    name: input.name,
    start_time: input.startTime ?? 0,
    strategy: input.strategy,
  });
}

function validateMockDiscoverCron(cronExpr: string): void {
  if (!isHourlyCron(cronExpr)) {
    throwMockRequestError(
      400,
      "VegaBackend.DiscoverSchedule.InvalidCronExpr",
      "cron_expr must be a valid five-field cron with an interval of at least one hour.",
    );
  }
}

function validateMockDiscoverTimeRange(
  startTime?: number,
  endTime?: number,
): void {
  if (!isValidDiscoverScheduleTimeRange(startTime, endTime)) {
    throwMockRequestError(
      400,
      "VegaBackend.DiscoverSchedule.InvalidTimeRange",
      "start_time must be less than or equal to end_time.",
    );
  }
}

export async function setDataConnectDiscoverScheduleEnabled(
  id: string,
  enabled: boolean,
) {
  if (useMock) {
    const current = mockSchedules.find((item) => item.id === id);
    if (!current) {
      throwMockRequestError(
        404,
        "VegaBackend.DiscoverSchedule.NotFound",
        "Discover schedule not found.",
      );
    }
    const now = Date.now();
    const nextRunValue = enabled
      ? calculateNextHourlyCronRun(
          current.cronExpr,
          now,
          current.startTimeValue,
        )
      : current.nextRunValue;
    mockSchedules = mockSchedules.map((item) =>
      item.id === id
        ? {
            ...item,
            enabled,
            nextRun: formatTimestamp(nextRunValue),
            nextRunValue,
            expectedUpdateTime: now,
            updateTime: formatTimestamp(now),
          }
        : item,
    );
    await wait(undefined);
    return;
  }

  await http.post(
    `/vega-backend/v1/discover-schedules/${id}/${enabled ? "enable" : "disable"}`,
  );
}

export async function deleteDataConnectDiscoverSchedule(id: string) {
  if (useMock) {
    mockSchedules = mockSchedules.filter((item) => item.id !== id);
    mockTasks = mockTasks.filter((item) => item.scheduleId !== id);
    await wait(undefined);
    return;
  }

  await http.delete(`/vega-backend/v1/discover-schedules/${id}`);
}

export async function listDataConnectDiscoverTasks(
  query: DataConnectDiscoverTaskListQuery,
): Promise<DataConnectDiscoverTaskListResult> {
  if (useMock) {
    const filtered = filterTasks(mockTasks, query);
    const startIndex = (query.page - 1) * query.pageSize;

    return wait({
      items: filtered.slice(startIndex, startIndex + query.pageSize).map(toTaskSummary),
      total: filtered.length,
    });
  }

  const response = await http.get<ListResponse<BackendDiscoverTaskSummary>>(
    "/vega-backend/v1/discover-tasks",
    {
      params: {
        catalog_id: query.catalogId,
        direction: query.direction ?? "desc",
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
        schedule_id: query.scheduleId,
        sort: query.sort ?? "create_time",
        status: query.status,
        strategy: query.strategy,
        trigger_type: query.triggerType,
      },
    },
  );

  return {
    items: response.data.entries.map(mapTaskSummary),
    total: response.data.total_count,
  };
}

export async function getDataConnectDiscoverTask(id: string) {
  if (useMock) {
    return wait(mockTasks.find((item) => item.id === id) ?? null);
  }

  const response = await http.get<BackendDiscoverTask>(
    `/vega-backend/v1/discover-tasks/${id}`,
  );

  return mapTask(response.data);
}

export async function deleteDataConnectDiscoverTask(id: string) {
  if (useMock) {
    mockTasks = mockTasks.filter((item) => item.id !== id);
    await wait(undefined);
    return;
  }

  await http.delete(`/vega-backend/v1/discover-tasks/${id}`);
}

export async function triggerDataConnectDiscover(
  catalogId: string,
  strategy?: DataConnectDiscoverStrategy,
) {
  if (useMock) {
    const now = Date.now();
    const task: DataConnectDiscoverTask = {
      id: crypto.randomUUID(),
      catalogId,
      scheduleId: "",
      strategy: strategy ?? "full_sync",
      triggerType: "manual",
      status: "pending",
      progress: 0,
      message: discoverMockText("manualTaskCreated"),
      startTime: now,
      creatorName: "Local Admin",
      createTime: now,
    };
    mockTasks = [task, ...mockTasks];
    await wait({ id: task.id });
    return { id: task.id };
  }

  const result = await postCatalogDiscover(catalogId, { strategy, wait: false });
  return result ?? { id: catalogId };
}

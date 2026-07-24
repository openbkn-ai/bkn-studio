/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { postCatalogDiscover } from "@/shared/catalog";
import type {
  DataConnectDiscoverSchedule,
  DataConnectDiscoverScheduleListQuery,
  DataConnectDiscoverScheduleListResult,
  DataConnectDiscoverSchedulePayload,
  DataConnectDiscoverStrategy,
  DataConnectDiscoverTask,
  DataConnectDiscoverTaskListQuery,
  DataConnectDiscoverTaskListResult,
  DataConnectDiscoverTaskStatus,
  DataConnectDiscoverTaskTriggerType,
} from "@/modules/data-connect/types/discover";

type BackendAccountInfo = {
  id?: string | null;
  name?: string | null;
};

type BackendDiscoverSchedule = {
  catalog_id: string;
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
  create_time?: number;
  creator?: BackendAccountInfo;
  finish_time?: number;
  id: string;
  message?: string;
  progress?: number;
  schedule_id?: string;
  start_time?: number;
  status?: string;
  strategy?: string;
  trigger_type?: string;
};

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

let mockSchedules: DataConnectDiscoverSchedule[] = [
  {
    id: "discover-schedule-001",
    name: "客户主数据每日同步",
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
    updateTime: "2026-06-03 02:00:11",
  },
  {
    id: "discover-schedule-002",
    name: "知识索引增量探查",
    catalogId: "cat-002",
    cronExpr: "*/30 * * * *",
    startTime: "2026-06-02 09:00:00",
    endTime: "-",
    enabled: true,
    strategy: "create_only",
    lastRun: "2026-06-03 11:30:08",
    nextRun: "2026-06-03 12:00:00",
    creatorName: "Search Team",
    updaterName: "Search Team",
    createTime: "2026-06-02 09:00:00",
    updateTime: "2026-06-03 11:30:08",
  },
  {
    id: "discover-schedule-003",
    name: "财务数仓清理任务",
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
    message: "同步完成，共处理 48 张表。",
    startTime: "2026-06-03 02:00:11",
    finishTime: "2026-06-03 02:12:04",
    creatorName: "Platform Admin",
    createTime: "2026-06-03 02:00:11",
  },
  {
    id: "discover-task-1002",
    catalogId: "cat-002",
    scheduleId: "discover-schedule-002",
    strategy: "create_only",
    triggerType: "scheduled",
    status: "running",
    progress: 56,
    message: "正在拉取索引增量变更。",
    startTime: "2026-06-03 11:30:08",
    finishTime: "-",
    creatorName: "Search Team",
    createTime: "2026-06-03 11:30:08",
  },
  {
    id: "discover-task-1003",
    catalogId: "cat-003",
    scheduleId: "discover-schedule-003",
    strategy: "cleanup_only",
    triggerType: "manual",
    status: "failed",
    progress: 100,
    message: "连接超时，清理任务未能完成。",
    startTime: "2026-06-02 03:00:00",
    finishTime: "2026-06-02 03:03:15",
    creatorName: "Data Ops",
    createTime: "2026-06-02 03:00:00",
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

  return new Intl.DateTimeFormat("zh-CN", {
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
    updateTime: formatTimestamp(item.update_time),
  };
}

function mapTask(item: BackendDiscoverTask): DataConnectDiscoverTask {
  return {
    id: item.id,
    catalogId: item.catalog_id,
    scheduleId: item.schedule_id ?? "",
    strategy: normalizeStrategy(item.strategy),
    triggerType: normalizeTriggerType(item.trigger_type),
    status: normalizeTaskStatus(item.status),
    progress: item.progress ?? 0,
    message: item.message ?? "",
    startTime: formatTimestamp(item.start_time),
    startTimeValue: item.start_time,
    finishTime: formatTimestamp(item.finish_time),
    finishTimeValue: item.finish_time,
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    createTime: formatTimestamp(item.create_time),
  };
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
  if (query.sort === "default") {
    const rank = { running: 1, pending: 2, failed: 3, completed: 4 };
    return filtered.sort((left, right) => rank[left.status] - rank[right.status] || right.createTime.localeCompare(left.createTime));
  }
  const direction = query.direction === "asc" ? 1 : -1;
  const valueOf = (item: DataConnectDiscoverTask) => item.createTime;
  return filtered.sort((left, right) => (valueOf(left) > valueOf(right) ? direction : valueOf(left) < valueOf(right) ? -direction : 0));
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
    const now = Date.now();
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
        nextRun: "-",
        creatorName: "Local Admin",
        updaterName: "Local Admin",
        createTime: formatTimestamp(now),
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
  input: DataConnectDiscoverSchedulePayload,
) {
  if (useMock) {
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
            updateTime: formatTimestamp(Date.now()),
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
    end_time: input.endTime ?? 0,
    name: input.name,
    start_time: input.startTime ?? 0,
    strategy: input.strategy,
  });
}

export async function setDataConnectDiscoverScheduleEnabled(
  id: string,
  enabled: boolean,
) {
  if (useMock) {
    mockSchedules = mockSchedules.map((item) =>
      item.id === id
        ? {
            ...item,
            enabled,
            updateTime: formatTimestamp(Date.now()),
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
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    });
  }

  const response = await http.get<ListResponse<BackendDiscoverTask>>(
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
    items: response.data.entries.map(mapTask),
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
      message: "手动探查任务已创建，等待执行。",
      startTime: formatTimestamp(now),
      startTimeValue: now,
      finishTime: "-",
      finishTimeValue: undefined,
      creatorName: "Local Admin",
      createTime: formatTimestamp(now),
    };
    mockTasks = [task, ...mockTasks];
    await wait({ id: task.id });
    return { id: task.id };
  }

  const result = await postCatalogDiscover(catalogId, { strategy, wait: false });
  return result ?? { id: catalogId };
}

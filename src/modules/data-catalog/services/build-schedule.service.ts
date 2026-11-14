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
import { getCatalog } from "@/shared/catalog";
import { calculateNextHourlyCronRun } from "@/shared/hourly-cron";
import { isHourlyCron, normalizeScheduleLastStatus } from "@/shared/schedule";
import {
  emitMockChange,
  mockBuildSchedules,
  mockCatalogName,
  mockResources,
  mockSlug,
} from "./mock-db";
import type {
  BuildSchedule,
  BuildScheduleInput,
  BuildSchedulePageQuery,
  BuildSchedulePageResult,
} from "../types/build-schedule";

type RequestOptions = { skipErrorToast?: boolean };

type BackendBuildSchedule = {
  id: string;
  name: string;
  resource_id: string;
  resource_name?: string;
  catalog_id: string;
  catalog_name?: string;
  cron_expr: string;
  execute_type: "full" | "incremental";
  enabled: boolean;
  start_time?: number;
  end_time?: number;
  last_run: number;
  next_run: number;
  last_status?: unknown;
  last_message?: string;
  creator?: { id: string; name?: string; type: string };
  create_time?: number;
  updater?: { id: string; name?: string; type: string };
  update_time: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const baseURL = "/vega-backend/v1/build-schedules";

function mapBuildSchedule(record: BackendBuildSchedule): BuildSchedule {
  return {
    id: record.id,
    name: record.name,
    resourceId: record.resource_id,
    resourceName: record.resource_name,
    catalogId: record.catalog_id,
    catalogName: record.catalog_name,
    cronExpr: record.cron_expr,
    executeType: record.execute_type,
    enabled: record.enabled,
    startTime: record.start_time ?? 0,
    endTime: record.end_time ?? 0,
    lastRun: record.last_run,
    nextRun: record.next_run,
    lastStatus: normalizeScheduleLastStatus(record.last_status, record.last_run),
    lastMessage: record.last_message ?? "",
    creator: record.creator,
    createTime: record.create_time,
    updater: record.updater,
    updateTime: record.update_time,
  };
}

function requestBody(input: BuildScheduleInput, enabled = input.enabled ?? false) {
  return {
    name: input.name,
    resource_id: input.resourceId,
    cron_expr: input.cronExpr,
    execute_type: input.executeType,
    enabled,
    start_time: input.startTime ?? 0,
    end_time: input.endTime ?? 0,
  };
}

function validateMockInput(input: BuildScheduleInput): number {
  if (!input.name.trim() || [...input.name].length > 255 || !input.resourceId) {
    throwMockRequestError(
      400,
      "VegaBackend.BuildSchedule.InvalidParameter",
      "Invalid schedule configuration.",
    );
  }
  if (!["full", "incremental"].includes(input.executeType)) {
    throwMockRequestError(
      400,
      "VegaBackend.BuildSchedule.InvalidExecuteType",
      "Unsupported build execution type.",
    );
  }
  if ([...input.cronExpr].length > 100 || !isHourlyCron(input.cronExpr)) {
    throwMockRequestError(
      400,
      "VegaBackend.BuildSchedule.InvalidCronExpr",
      "Invalid cron expression; adjacent executions must be at least one hour apart.",
    );
  }
  const start = input.startTime ?? 0;
  const end = input.endTime ?? 0;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < 0 ||
    (end > 0 && start > end)
  ) {
    throwMockRequestError(
      400,
      "VegaBackend.BuildSchedule.InvalidTimeRange",
      "Invalid schedule validity window.",
    );
  }
  const next = calculateNextHourlyCronRun(input.cronExpr, Date.now(), start);
  if (next === undefined) {
    throwMockRequestError(
      400,
      "VegaBackend.BuildSchedule.InvalidCronExpr",
      "The cron expression has no future execution.",
    );
  }
  return next;
}

async function requireMockCatalog(catalogId: string) {
  const catalog = await getCatalog(catalogId);
  if (!catalog) {
    throwMockRequestError(404, "VegaBackend.Catalog.NotFound", "Catalog not found.");
  }
  if (!catalog.operations?.some((operation) => operation === "task_manage" || operation === "*")) {
    throwMockRequestError(
      403,
      "Public.Forbidden",
      "Catalog task management permission is required.",
    );
  }
}

function requireMockSchedule(id: string): BuildSchedule {
  const schedule = mockBuildSchedules.find((item) => item.id === id);
  if (!schedule) {
    throwMockRequestError(404, "VegaBackend.BuildSchedule.NotFound", "Build schedule not found.");
  }
  return schedule;
}

export async function listBuildSchedulePage(
  query: BuildSchedulePageQuery,
  options: RequestOptions = {},
): Promise<BuildSchedulePageResult> {
  const limit = query.pageSize ?? 20;
  const offset = ((query.page ?? 1) - 1) * limit;
  if (!useMock) {
    const response = await http.get<{ entries: BackendBuildSchedule[]; total_count: number }>(
      baseURL,
      {
        ...options,
        params: {
          name: query.name || undefined,
          resource_id: query.resourceId || undefined,
          catalog_id: query.catalogId || undefined,
          enabled: query.enabled,
          execute_type: query.executeType || undefined,
          offset,
          limit,
          sort: query.sort ?? "update_time",
          direction: query.direction ?? "desc",
        },
      },
    );
    return { items: response.data.entries.map(mapBuildSchedule), total: response.data.total_count };
  }

  const catalogs = await Promise.all(
    [...new Set(mockBuildSchedules.map((item) => item.catalogId))].map((id) => getCatalog(id)),
  );
  const visible = new Set(
    catalogs
      .filter((catalog) =>
        catalog?.operations?.some((operation) => operation === "task_manage" || operation === "*"),
      )
      .map((catalog) => catalog!.id),
  );
  const items = mockBuildSchedules.filter(
    (schedule) =>
      visible.has(schedule.catalogId) &&
      (!query.resourceId || schedule.resourceId === query.resourceId) &&
      (!query.catalogId || schedule.catalogId === query.catalogId) &&
      (!query.name || schedule.name.includes(query.name)) &&
      (query.enabled === undefined || schedule.enabled === query.enabled) &&
      (!query.executeType || schedule.executeType === query.executeType),
  );
  const sort = query.sort ?? "update_time";
  const direction = query.direction === "asc" ? 1 : -1;
  const keyOf = (item: BuildSchedule): number | string => {
    switch (sort) {
      case "name":
        return item.name;
      case "create_time":
        return item.createTime ?? 0;
      case "next_run":
        return item.nextRun;
      default:
        return item.updateTime;
    }
  };
  items.sort((left, right) => {
    const a = keyOf(left);
    const b = keyOf(right);
    return (a < b ? -1 : a > b ? 1 : left.id.localeCompare(right.id)) * direction;
  });
  return {
    items: structuredClone(limit < 0 ? items : items.slice(offset, offset + limit)),
    total: items.length,
  };
}

export async function getBuildSchedule(
  id: string,
  options: RequestOptions = {},
): Promise<BuildSchedule> {
  if (useMock) {
    const schedule = requireMockSchedule(id);
    await requireMockCatalog(schedule.catalogId);
    return structuredClone(schedule);
  }
  const response = await http.get<BackendBuildSchedule>(
    `${baseURL}/${encodeURIComponent(id)}`,
    options,
  );
  return mapBuildSchedule(response.data);
}

export async function createBuildSchedule(
  input: BuildScheduleInput,
  options: RequestOptions = {},
): Promise<string> {
  if (!useMock) {
    const response = await http.post<{ id: string }>(baseURL, requestBody(input), options);
    return response.data.id;
  }
  const nextRun = validateMockInput(input);
  const resource = mockResources.find((item) => item.id === input.resourceId);
  if (!resource) {
    throwMockRequestError(404, "VegaBackend.Resource.NotFound", "Resource not found.");
  }
  await requireMockCatalog(resource.catalogId);
  if (resource.category !== "table") {
    throwMockRequestError(
      400,
      "VegaBackend.BuildSchedule.InvalidParameter",
      "Build schedules require a table resource.",
    );
  }
  const now = Date.now();
  const id = `bs-${mockSlug(12)}`;
  mockBuildSchedules.unshift({
    id,
    name: input.name,
    resourceId: resource.id,
    resourceName: resource.name,
    catalogId: resource.catalogId,
    catalogName: mockCatalogName(resource.catalogId),
    cronExpr: input.cronExpr,
    executeType: input.executeType,
    enabled: input.enabled ?? false,
    startTime: input.startTime ?? 0,
    endTime: input.endTime ?? 0,
    lastRun: 0,
    nextRun,
    lastStatus: "never",
    lastMessage: "",
    creator: { id: "local-mock-admin", name: "Platform Admin", type: "user" },
    updater: { id: "local-mock-admin", name: "Platform Admin", type: "user" },
    createTime: now,
    updateTime: now,
  });
  emitMockChange();
  return id;
}

export async function updateBuildSchedule(
  id: string,
  input: BuildScheduleInput,
  expectedUpdateTime: number,
  options: RequestOptions = {},
): Promise<void> {
  if (!useMock) {
    const enabled = input.enabled ?? (await getBuildSchedule(id, options)).enabled;
    await http.put(
      `${baseURL}/${encodeURIComponent(id)}`,
      {
        ...requestBody(input, enabled),
        expected_update_time: expectedUpdateTime,
      },
      options,
    );
    return;
  }
  const current = requireMockSchedule(id);
  await requireMockCatalog(current.catalogId);
  validateMockExpectedUpdateTime(expectedUpdateTime);
  if (expectedUpdateTime !== current.updateTime) {
    throwMockRequestError(
      409,
      "VegaBackend.BuildSchedule.UpdateConflict",
      "The schedule has changed; reload and retry.",
    );
  }
  const nextRun = validateMockInput(input);
  if (input.resourceId !== current.resourceId) {
    throwMockRequestError(
      409,
      "VegaBackend.BuildSchedule.ResourceMismatch",
      "The bound resource cannot be changed.",
    );
  }
  if (input.enabled !== undefined && input.enabled !== current.enabled) {
    throwMockRequestError(
      409,
      "VegaBackend.BuildSchedule.EnabledFieldNotAllowed",
      "Use the enable or disable action to change state.",
    );
  }
  Object.assign(current, {
    name: input.name,
    cronExpr: input.cronExpr,
    executeType: input.executeType,
    startTime: input.startTime ?? 0,
    endTime: input.endTime ?? 0,
    nextRun,
    updateTime: Math.max(Date.now(), current.updateTime + 1),
    updater: { id: "local-mock-admin", name: "Platform Admin", type: "user" },
  });
  emitMockChange();
}

export async function setBuildScheduleEnabled(
  id: string,
  enabled: boolean,
  options: RequestOptions = {},
): Promise<void> {
  if (!useMock) {
    await http.post(
      `${baseURL}/${encodeURIComponent(id)}/${enabled ? "enable" : "disable"}`,
      undefined,
      options,
    );
    return;
  }
  const current = requireMockSchedule(id);
  await requireMockCatalog(current.catalogId);
  const nextRun = enabled ? validateMockInput(current) : current.nextRun;
  Object.assign(current, {
    enabled,
    nextRun,
    updateTime: Math.max(Date.now(), current.updateTime + 1),
    updater: { id: "local-mock-admin", name: "Platform Admin", type: "user" },
  });
  emitMockChange();
}

export async function deleteBuildSchedule(id: string, options: RequestOptions = {}): Promise<void> {
  if (!useMock) {
    await http.delete(`${baseURL}/${encodeURIComponent(id)}`, options);
    return;
  }
  const current = requireMockSchedule(id);
  await requireMockCatalog(current.catalogId);
  mockBuildSchedules.splice(mockBuildSchedules.indexOf(current), 1);
  emitMockChange();
}

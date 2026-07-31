/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  findMockCatalog,
  getMockCatalogs,
  prependMockCatalog,
  removeMockCatalog,
  updateMockCatalog,
} from "@/shared/catalog/catalog-mock";
import {
  filterCatalogs,
  formatCatalogTimestamp,
  inferConnectorCategory,
  mapBackendCatalog,
  type BackendCatalog,
} from "@/shared/catalog/catalog-mapper";
import type {
  CatalogConnectionTestInput,
  CatalogConnectionTestResult,
  CatalogHealthCheckSchedule,
  CatalogHealthCheckScheduleInput,
  CatalogListQuery,
  CatalogListResult,
  CatalogMutationOptions,
  CatalogRecord,
} from "@/shared/catalog/types";

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

type BackendCatalogHealthCheckSchedule = {
  catalog_id: string;
  cron_expr?: string;
  last_run: number;
  mode: CatalogHealthCheckSchedule["mode"];
  next_run: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const mockHealthCheckSchedules = new Map<string, CatalogHealthCheckSchedule>();

const wait = async <T,>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

export async function listCatalogs(query: CatalogListQuery): Promise<CatalogListResult> {
  if (useMock) {
    const filtered = filterCatalogs(getMockCatalogs(), query);
    const startIndex = (query.page - 1) * query.pageSize;

    return wait({
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    });
  }

  const response = await http.get<ListResponse<BackendCatalog>>("/vega-backend/v1/catalogs", {
    params: {
      connector_type: query.connectorType || undefined,
      direction: "desc",
      limit: query.pageSize,
      name: query.keyword.trim() || undefined,
      offset: (query.page - 1) * query.pageSize,
      sort: "update_time",
      type: query.type === "all" ? undefined : query.type,
    },
  });

  const mapped = response.data.entries.map(mapBackendCatalog);
  const filtered = filterCatalogs(mapped, query);
  const usesClientTypeFilter = query.type && query.type !== "all";

  return {
    items: filtered,
    total: usesClientTypeFilter ? filtered.length : response.data.total_count,
  };
}

export async function getCatalog(id: string) {
  if (useMock) {
    return wait(findMockCatalog(id));
  }

  const response = await http.get<{ entries: BackendCatalog[] }>(
    `/vega-backend/v1/catalogs/${id}`,
  );

  const catalog = response.data.entries?.[0];
  return catalog ? mapBackendCatalog(catalog) : null;
}

export async function deleteCatalog(id: string) {
  if (useMock) {
    removeMockCatalog(id);
    mockHealthCheckSchedules.delete(id);
    await wait(undefined);
    return;
  }

  await http.delete(`/vega-backend/v1/catalogs/${id}`);
}

export async function setCatalogEnabled(id: string, enabled: boolean) {
  if (useMock) {
    updateMockCatalog(id, (record) => ({
      ...record,
      enabled,
      status: enabled ? "enabled" : "disabled",
      updateTime: formatCatalogTimestamp(Date.now()),
      healthStatus: enabled ? record.healthStatus : "unchecked",
    }));
    await wait(undefined);
    return;
  }

  await http.post(`/vega-backend/v1/catalogs/${id}/${enabled ? "enable" : "disable"}`);
}

export async function createLogicalCatalog(input: { description?: string; name: string }) {
  if (useMock) {
    prependMockCatalog({
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description ?? "",
      connectorType: "",
      category: "table",
      mode: "local",
      enabled: true,
      status: "enabled",
      healthStatus: "healthy",
      healthCheckResult: "",
      lastCheckTime: "-",
      updateTime: formatCatalogTimestamp(Date.now()),
      createTime: formatCatalogTimestamp(Date.now()),
      updaterName: "Local Admin",
      creatorName: "Local Admin",
      tags: [],
      connectorConfig: {},
      metadata: {},
      operations: ["view", "delete"],
      type: "logical",
    });
    await wait(undefined);
    return;
  }

  await http.post("/vega-backend/v1/catalogs", {
    description: input.description ?? "",
    enabled: true,
    name: input.name,
    tags: [],
    type: "logical",
  });
}

export function appendMockPhysicalCatalog(record: CatalogRecord) {
  prependMockCatalog(record);
}

export function updateMockCatalogRecord(
  id: string,
  patch: Partial<CatalogRecord> | ((record: CatalogRecord) => CatalogRecord),
) {
  updateMockCatalog(id, patch);
}

export async function updateCatalog(
  id: string,
  input: {
    connectorConfig: Record<string, unknown>;
    connectorType: string;
    description: string;
    enabled: boolean;
    name: string;
    tags: string[];
  },
  options: CatalogMutationOptions = {},
) {
  if (useMock) {
    updateMockCatalog(id, (record) => ({
      ...record,
      name: input.name,
      description: input.description,
      tags: input.tags,
      connectorConfig: input.connectorConfig,
      updateTime: formatCatalogTimestamp(Date.now()),
    }));
    await wait(undefined);
    return;
  }

  await http.put(
    `/vega-backend/v1/catalogs/${id}`,
    {
      connector_config: input.connectorConfig,
      connector_type: input.connectorType,
      description: input.description,
      enabled: input.enabled,
      id,
      name: input.name,
      tags: input.tags,
    },
    {
      params: {
        allow_unhealthy: options.allowUnhealthy || undefined,
      },
      skipErrorToast: options.skipErrorToast,
    },
  );
}

export async function createPhysicalCatalog(input: {
  connectorConfig: Record<string, unknown>;
  connectorType: string;
  description: string;
  enabled: boolean;
  name: string;
  tags: string[];
  healthCheckSchedule?: CatalogHealthCheckScheduleInput;
  category?: string;
  mode?: string;
},
options: CatalogMutationOptions = {},
): Promise<string> {
  if (useMock) {
    const id = crypto.randomUUID();
    mockHealthCheckSchedules.set(id, buildMockHealthCheckSchedule(
      id,
      input.healthCheckSchedule ?? { mode: "inherit" },
    ));
    prependMockCatalog({
      id,
      name: input.name,
      description: input.description,
      connectorType: input.connectorType,
      category: input.category ?? inferConnectorCategory(input.connectorType),
      mode: input.mode ?? "local",
      enabled: input.enabled,
      status: input.enabled ? "enabled" : "disabled",
      healthStatus: "unchecked",
      healthCheckResult: "",
      lastCheckTime: "-",
      updateTime: formatCatalogTimestamp(Date.now()),
      createTime: formatCatalogTimestamp(Date.now()),
      updaterName: "Local Admin",
      creatorName: "Local Admin",
      tags: input.tags,
      connectorConfig: input.connectorConfig,
      metadata: {},
      operations: ["view", "edit", "delete", "test_connection", "enable", "disable"],
      type: "physical",
    });
    await wait(undefined);
    return id;
  }

  const response = await http.post<{ id?: string }>(
    "/vega-backend/v1/catalogs",
    {
      connector_config: input.connectorConfig,
      connector_type: input.connectorType,
      description: input.description,
      enabled: input.enabled,
      name: input.name,
      tags: input.tags,
      health_check_schedule: input.healthCheckSchedule
        ? mapHealthCheckScheduleInput(input.healthCheckSchedule)
        : undefined,
    },
    {
      params: {
        allow_unhealthy: options.allowUnhealthy || undefined,
      },
      skipErrorToast: options.skipErrorToast,
    },
  );

  return response.data.id ?? "";
}

export async function testCatalogConnectionConfig(
  input: CatalogConnectionTestInput,
): Promise<CatalogConnectionTestResult> {
  if (useMock) {
    return wait({
      message: "Connection test succeeded.",
      success: true,
    });
  }

  const response = await http.post<CatalogConnectionTestResult>(
    "/vega-backend/v1/catalogs/test-connection",
    {
      connector_config: input.connectorConfig,
      connector_type: input.connectorType,
    },
    { skipErrorToast: true, timeout: 60_000 },
  );

  return response.data;
}

export async function testCatalogConnection(
  id: string,
): Promise<CatalogConnectionTestResult> {
  if (useMock) {
    return wait({
      message: "Connection test succeeded.",
      success: true,
    });
  }

  const response = await http.post<CatalogConnectionTestResult>(
    `/vega-backend/v1/catalogs/${id}/test-connection`,
    undefined,
    { skipErrorToast: true, timeout: 60_000 },
  );

  return response.data;
}

export async function getCatalogHealthCheckSchedule(
  catalogId: string,
): Promise<CatalogHealthCheckSchedule> {
  if (useMock) {
    const schedule =
      mockHealthCheckSchedules.get(catalogId) ??
      buildMockHealthCheckSchedule(catalogId, { mode: "inherit" });
    mockHealthCheckSchedules.set(catalogId, schedule);
    return wait(schedule);
  }

  const response = await http.get<BackendCatalogHealthCheckSchedule>(
    `/vega-backend/v1/catalogs/${catalogId}/health-check-schedule`,
    { skipErrorToast: true },
  );

  return mapHealthCheckSchedule(response.data);
}

export async function updateCatalogHealthCheckSchedule(
  catalogId: string,
  input: CatalogHealthCheckScheduleInput,
): Promise<CatalogHealthCheckSchedule> {
  if (useMock) {
    const schedule = buildMockHealthCheckSchedule(
      catalogId,
      input,
      mockHealthCheckSchedules.get(catalogId),
    );
    mockHealthCheckSchedules.set(catalogId, schedule);
    return wait(schedule);
  }

  const response = await http.put<BackendCatalogHealthCheckSchedule>(
    `/vega-backend/v1/catalogs/${catalogId}/health-check-schedule`,
    mapHealthCheckScheduleInput(input),
    { skipErrorToast: true },
  );

  return mapHealthCheckSchedule(response.data);
}

function mapHealthCheckScheduleInput(input: CatalogHealthCheckScheduleInput) {
  return {
    cron_expr: input.mode === "enabled" ? input.cronExpr?.trim() : undefined,
    mode: input.mode,
  };
}

function buildMockHealthCheckSchedule(
  catalogId: string,
  input: CatalogHealthCheckScheduleInput,
  previous?: CatalogHealthCheckSchedule,
): CatalogHealthCheckSchedule {
  return {
    catalogId,
    cronExpr:
      input.mode === "enabled"
        ? input.cronExpr?.trim() ?? ""
        : input.mode === "disabled"
          ? previous?.cronExpr ?? ""
          : "",
    lastRun: "-",
    mode: input.mode,
    nextRun:
      input.mode === "disabled"
        ? "-"
        : formatCatalogTimestamp(Date.now() + 3_600_000),
  };
}

function mapHealthCheckSchedule(
  schedule: BackendCatalogHealthCheckSchedule,
): CatalogHealthCheckSchedule {
  return {
    catalogId: schedule.catalog_id,
    cronExpr: schedule.cron_expr ?? "",
    lastRun: formatCatalogTimestamp(schedule.last_run),
    mode: schedule.mode,
    nextRun: formatCatalogTimestamp(schedule.next_run),
  };
}

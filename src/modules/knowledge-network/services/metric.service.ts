/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  unwrapSingleEntryResponse,
  type SingleEntryResponse,
} from "@/framework/request/normalize";
import type {
  KnowledgeNetworkMetricMutationPayload,
  KnowledgeNetworkMetricRecord,
  MetricDataQueryParams,
  MetricDataQueryResult,
  MetricListQuery,
  MetricListResult,
} from "@/modules/knowledge-network/types/knowledge-network";
import type {
  BackendListResponse,
  BackendMetric,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  mapMetric,
  toBackendMetricEntry,
} from "@/modules/knowledge-network/services/mappers";
import {
  mockMetrics,
  syncKnowledgeNetworkStatistics,
} from "@/modules/knowledge-network/services/mock/state";
import {
  formatTimestamp,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";

export type MetricApiAvailability = "unknown" | "ready" | "unsupported";

let metricApiAvailability: MetricApiAvailability = "unknown";

function updateMetricApiAvailability(status: MetricApiAvailability) {
  metricApiAvailability = status;
}

function getErrorStatus(error: unknown) {
  return (error as { response?: { status?: number } }).response?.status;
}

export function getMetricApiAvailability() {
  return metricApiAvailability;
}

function filterAndSortMockMetrics(
  metrics: KnowledgeNetworkMetricRecord[],
  query: MetricListQuery = {},
): MetricListResult {
  const keyword = query.keyword?.trim().toLowerCase();
  const filtered = metrics.filter((item) => {
    const matchesKeyword =
      !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      item.id.toLowerCase().includes(keyword);
    const matchesTag = !query.tag || query.tag === "all" || item.tags.includes(query.tag);
    return matchesKeyword && matchesTag;
  });

  const sort = query.sort === "name" ? "name" : "update_time";
  const direction = query.direction ?? "desc";
  const sorted = [...filtered].sort((left, right) => {
    const leftValue = sort === "name" ? left.name : left.updateTime;
    const rightValue = sort === "name" ? right.name : right.updateTime;
    const compared = leftValue.localeCompare(rightValue);
    return direction === "asc" ? compared : -compared;
  });
  const offset = query.offset ?? 0;
  const limit = query.limit ?? sorted.length;

  return {
    entries: sorted.slice(offset, offset + limit),
    totalCount: sorted.length,
  };
}

export async function listKnowledgeNetworkMetrics(
  networkId: string,
  query: MetricListQuery = {},
): Promise<MetricListResult> {
  if (useMock) {
    updateMetricApiAvailability("ready");
    return wait(filterAndSortMockMetrics(mockMetrics[networkId] ?? [], query));
  }

  try {
    const response = await http.get<BackendListResponse<BackendMetric>>(
      `/bkn-backend/v1/knowledge-networks/${networkId}/metrics`,
      {
        params: {
          direction: query.direction ?? "desc",
          limit: query.limit ?? 20,
          name_pattern: query.keyword || undefined,
          offset: query.offset ?? 0,
          sort: query.sort ?? "update_time",
          tag: query.tag && query.tag !== "all" ? query.tag : undefined,
        },
      },
    );
    updateMetricApiAvailability("ready");
    return {
      entries: response.data.entries.map(mapMetric),
      totalCount: response.data.total_count,
    };
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      updateMetricApiAvailability("unsupported");
      return { entries: [], totalCount: 0 };
    }

    throw error;
  }
}

export async function getKnowledgeNetworkMetric(networkId: string, metricId: string) {
  if (useMock) {
    updateMetricApiAvailability("ready");
    return wait((mockMetrics[networkId] ?? []).find((item) => item.id === metricId) ?? null);
  }

  try {
    const response = await http.get<SingleEntryResponse<BackendMetric>>(
      `/bkn-backend/v1/knowledge-networks/${networkId}/metrics/${metricId}`,
    );

    updateMetricApiAvailability("ready");
    const item = unwrapSingleEntryResponse(response.data);
    return item ? mapMetric(item) : null;
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      updateMetricApiAvailability("unsupported");
    }

    throw error;
  }
}

export async function createKnowledgeNetworkMetric(
  networkId: string,
  input: KnowledgeNetworkMetricMutationPayload,
) {
  if (useMock) {
    const nextItem: KnowledgeNetworkMetricRecord = {
      calculationFormula: input.calculationFormula,
      description: input.description,
      id: crypto.randomUUID(),
      metricType: input.metricType,
      name: input.name,
      scopeRef: input.scopeRef,
      scopeType: input.scopeType,
      tags: input.tags,
      timeDimension: input.timeDimension,
      unit: input.unit,
      unitType: input.unitType,
      updateTime: formatTimestamp(Date.now()),
      updaterName: "Local Admin",
    };

    mockMetrics[networkId] = [nextItem, ...(mockMetrics[networkId] ?? [])];
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    updateMetricApiAvailability("ready");
    return nextItem;
  }

  try {
    const response = await http.post<SingleEntryResponse<BackendMetric>>(
      `/bkn-backend/v1/knowledge-networks/${networkId}/metrics`,
      {
        entries: [toBackendMetricEntry(input)],
      },
      {
        headers: { "x-http-method-override": "POST" },
        params: { strict_mode: false },
      },
    );

    updateMetricApiAvailability("ready");
    const item = unwrapSingleEntryResponse(response.data);
    return item ? mapMetric(item) : null;
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      updateMetricApiAvailability("unsupported");
    }

    throw error;
  }
}

export async function updateKnowledgeNetworkMetric(
  networkId: string,
  metricId: string,
  input: KnowledgeNetworkMetricMutationPayload,
) {
  if (useMock) {
    mockMetrics[networkId] = (mockMetrics[networkId] ?? []).map((item) =>
      item.id === metricId
        ? {
            ...item,
            calculationFormula: input.calculationFormula,
            description: input.description,
            metricType: input.metricType,
            name: input.name,
            scopeRef: input.scopeRef,
            scopeType: input.scopeType,
            tags: input.tags,
            timeDimension: input.timeDimension,
            unit: input.unit,
            unitType: input.unitType,
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    await wait(undefined);
    updateMetricApiAvailability("ready");
    return mockMetrics[networkId]?.find((item) => item.id === metricId) ?? null;
  }

  try {
    const response = await http.put<BackendMetric>(
      `/bkn-backend/v1/knowledge-networks/${networkId}/metrics/${metricId}`,
      {
        ...toBackendMetricEntry(input),
        strict_mode: false,
      },
    );

    updateMetricApiAvailability("ready");
    return mapMetric(response.data);
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      updateMetricApiAvailability("unsupported");
    }

    throw error;
  }
}

export async function deleteKnowledgeNetworkMetric(networkId: string, metricId: string) {
  if (useMock) {
    mockMetrics[networkId] = (mockMetrics[networkId] ?? []).filter((item) => item.id !== metricId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    updateMetricApiAvailability("ready");
    return;
  }

  try {
    await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}/metrics/${metricId}`);
    updateMetricApiAvailability("ready");
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      updateMetricApiAvailability("unsupported");
    }

    throw error;
  }
}

export async function deleteKnowledgeNetworkMetrics(networkId: string, metricIds: string[]) {
  if (metricIds.length === 0) {
    return;
  }

  if (useMock) {
    mockMetrics[networkId] = (mockMetrics[networkId] ?? []).filter(
      (item) => !metricIds.includes(item.id),
    );
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    updateMetricApiAvailability("ready");
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}/metrics/${metricIds.join(",")}`);
  updateMetricApiAvailability("ready");
}

type MetricTimeWindow = {
  end?: number;
  instant?: boolean;
  start?: number;
};

type BackendMetricDataResponse = {
  datas?: Array<{
    growth_rates?: Array<number | string>;
    growth_values?: Array<number | string>;
    labels?: Record<string, string> | string[];
    proportions?: Array<number | string>;
    time_strs?: string[];
    times?: Array<number | string>;
    values?: Array<number | string>;
  }>;
  overall_ms?: number;
  vega_duration_ms?: number;
};

function getRelativeTimeWindow(timeRange: MetricDataQueryParams["timeRange"]): MetricTimeWindow {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  switch (timeRange) {
    case "last_1h":
      return { end: now, start: now - oneHour };
    case "last_7d":
      return { end: now, start: now - 7 * oneDay };
    case "last_30d":
      return { end: now, start: now - 30 * oneDay };
    case "calendar_day": {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { end: now, start: start.getTime() };
    }
    case "last_24h":
    default:
      return { end: now, start: now - oneDay };
  }
}

function toTimestamp(value: unknown): number | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (typeof value === "object" && "valueOf" in value) {
    const parsed = Number((value as { valueOf: () => unknown }).valueOf());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function buildMetricDataQueryPayload(params: MetricDataQueryParams) {
  const time =
    params.timeRange === "custom"
      ? {
          end: toTimestamp(params.customEndTime),
          start: toTimestamp(params.customStartTime),
        }
      : getRelativeTimeWindow(params.timeRange);

  const payload: Record<string, unknown> = {
    limit: params.limit,
    time: {
      ...time,
      instant: params.mode === "instant",
    },
  };

  if (params.mode === "sameperiod") {
    payload.metrics = {
      sameperiod_config: {
        method: [params.samePeriodMethod ?? "growth_value"],
        offset: params.samePeriodOffset ?? 1,
        time_granularity: params.samePeriodGranularity ?? "day",
      },
      type: "sameperiod",
    };
  }

  if (params.mode === "proportion") {
    payload.metrics = {
      type: "proportion",
    };
  }

  return payload;
}

function normalizeMetricDataResponse(
  data: BackendMetricDataResponse | MetricDataQueryResult,
  mode: MetricDataQueryParams["mode"],
): MetricDataQueryResult {
  if ("rows" in data && "columns" in data) {
    return data;
  }

  const firstData = data.datas?.[0];
  if (!firstData) {
    return {
      columns: [],
      durationMs: data.overall_ms ?? data.vega_duration_ms,
      rows: [],
    };
  }

  if (mode === "instant") {
    return {
      columns: [
        { key: "metric", title: "Metric" },
        { key: "value", title: "Value" },
      ],
      durationMs: data.overall_ms ?? data.vega_duration_ms,
      rows: [{ metric: "value", value: firstData.values?.[0] ?? "--" }],
      visualHint: "instant-card",
    };
  }

  if (mode === "proportion") {
    const labels = Array.isArray(firstData.labels)
      ? firstData.labels
      : Object.values(firstData.labels ?? {});
    const values = firstData.proportions ?? firstData.values ?? [];

    return {
      columns: [
        { key: "dimension", title: "Dimension" },
        { key: "value", title: "Value" },
      ],
      durationMs: data.overall_ms ?? data.vega_duration_ms,
      rows: values.map((value, index) => ({
        dimension: labels[index] ?? `Item ${index + 1}`,
        value,
      })),
      visualHint: "proportion-bars",
    };
  }

  const times = firstData.time_strs ?? firstData.times ?? [];
  const valueKey = mode === "sameperiod" ? "current" : "value";

  return {
    columns:
      mode === "sameperiod"
        ? [
            { key: "timestamp", title: "Timestamp" },
            { key: "current", title: "Current" },
            { key: "growthValue", title: "Growth value" },
            { key: "growthRate", title: "Growth rate" },
          ]
        : [
            { key: "timestamp", title: "Timestamp" },
            { key: "value", title: "Value" },
          ],
    durationMs: data.overall_ms ?? data.vega_duration_ms,
    rows: (firstData.values ?? []).map((value, index) => ({
      growthRate: firstData.growth_rates?.[index] ?? "",
      growthValue: firstData.growth_values?.[index] ?? "",
      timestamp: times[index] ?? index,
      [valueKey]: value,
    })),
    visualHint: "trend-bars",
  };
}

export async function queryKnowledgeNetworkMetricData(
  networkId: string,
  metricId: string,
  params: MetricDataQueryParams,
): Promise<MetricDataQueryResult> {
  if (useMock) {
    const metric = (mockMetrics[networkId] ?? []).find((item) => item.id === metricId);
    await wait(undefined);
    updateMetricApiAvailability("ready");
    const unitSuffix = metric?.unit === "%" ? "%" : metric?.unit ? ` ${metric.unit}` : "";

    if (params.mode === "instant") {
      return {
        columns: [
          { key: "metric", title: "Metric" },
          { key: "value", title: "Value" },
        ],
        durationMs: 128,
        rows: [
          {
            metric: metric?.name ?? metricId,
            value: metric?.id === "metric-risk-hit-rate" ? `72.5${unitSuffix}` : `0${unitSuffix}`,
          },
        ],
        visualHint: "instant-card",
      };
    }

    if (params.mode === "proportion") {
      return {
        columns: [
          { key: "dimension", title: "Dimension" },
          { key: "value", title: metric?.name ?? "Value" },
        ],
        durationMs: 186,
        rows: [
          { dimension: "High", value: `45.2${unitSuffix}` },
          { dimension: "Medium", value: `27.3${unitSuffix}` },
          { dimension: "Low", value: `27.5${unitSuffix}` },
        ],
        visualHint: "proportion-bars",
      };
    }

    if (params.mode === "sameperiod") {
      return {
        columns: [
          { key: "timestamp", title: "Timestamp" },
          { key: "current", title: metric?.name ?? "Current" },
          { key: "growthValue", title: "Growth value" },
          { key: "growthRate", title: "Growth rate" },
        ],
        durationMs: 233,
        rows: [
          { current: `68.2${unitSuffix}`, growthRate: "4.2%", growthValue: "2.8", timestamp: "2026-06-05 08:00" },
          { current: `70.1${unitSuffix}`, growthRate: "5.1%", growthValue: "3.4", timestamp: "2026-06-05 09:00" },
          { current: `72.5${unitSuffix}`, growthRate: "6.0%", growthValue: "4.1", timestamp: "2026-06-05 10:00" },
        ],
        visualHint: "trend-bars",
      };
    }

    return {
      columns: [
        { key: "timestamp", title: "Timestamp" },
        { key: "value", title: metric?.name ?? "Value" },
      ],
      durationMs: 214,
      rows: [
        { timestamp: "2026-06-05 08:00", value: `68.2${unitSuffix}` },
        { timestamp: "2026-06-05 09:00", value: `70.1${unitSuffix}` },
        { timestamp: "2026-06-05 10:00", value: `72.5${unitSuffix}` },
        { timestamp: "2026-06-05 11:00", value: `71.8${unitSuffix}` },
      ],
      visualHint: "trend-bars",
    };
  }

  try {
    const response = await http.post<BackendMetricDataResponse | MetricDataQueryResult>(
      `/ontology-query/v1/knowledge-networks/${networkId}/metrics/${metricId}/data`,
      buildMetricDataQueryPayload(params),
      {
        params: {
          fill_null: params.fillNull,
        },
      },
    );

    updateMetricApiAvailability("ready");
    return normalizeMetricDataResponse(response.data, params.mode);
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      updateMetricApiAvailability("unsupported");
    }

    throw error;
  }
}

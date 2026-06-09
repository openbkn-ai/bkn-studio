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

export async function listKnowledgeNetworkMetrics(networkId: string) {
  if (useMock) {
    updateMetricApiAvailability("ready");
    return wait(mockMetrics[networkId] ?? []);
  }

  try {
    const response = await http.get<BackendListResponse<BackendMetric>>(
      `/bkn-backend/v1/knowledge-networks/${networkId}/metrics`,
      { params: { limit: 200, offset: 0, sort: "update_time", direction: "desc" } },
    );
    updateMetricApiAvailability("ready");
    return response.data.entries.map(mapMetric);
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      updateMetricApiAvailability("unsupported");
      return [];
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
        strict_mode: false,
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
    const response = await http.post<MetricDataQueryResult>(
      `/ontology-query/v1/knowledge-networks/${networkId}/metrics/${metricId}/data`,
      {
        fill_null: params.fillNull,
        limit: params.limit,
        mode: params.mode,
        time_range: params.timeRange,
      },
      {
        params: {
          fill_null: params.fillNull,
        },
      },
    );

    updateMetricApiAvailability("ready");
    return response.data;
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      updateMetricApiAvailability("unsupported");
    }

    throw error;
  }
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { mockModelStatisticsOverview } from "@/modules/model-resources/services/mock/fixtures";
import type {
  ModelStatisticsOverview,
  ModelStatisticsOverviewQuery,
} from "@/modules/model-resources/types/statistics";
import {
  normalizeStatisticsDate,
  parseStatisticsNumber,
  sortStatisticsPoints,
  unwrapStatisticsRecord,
} from "@/modules/model-resources/utils/statistics-chart";

const API_PREFIX = "/mf-model-manager/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

type BackendStatisticsOverview = {
  summary?: {
    total_usage?: number;
    error_rate?: number;
    avg_response_time?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  trends?: unknown[];
  qps_data?: unknown[];
};

type BackendTrendPoint = {
  date?: string;
  date_group?: string;
  input_tokens?: number;
  output_tokens?: number;
  avg_total_time?: number;
  avg_first_time?: number;
  avg_rate?: number;
};

type BackendQpsPoint = {
  avg_qps?: number | string;
  date?: string;
  date_group?: string;
};

function unwrapOverviewPayload(payload: unknown): BackendStatisticsOverview {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const record = payload as Record<string, unknown>;

  if ("summary" in record || "trends" in record || "qps_data" in record) {
    return record;
  }

  if ("data" in record) {
    return unwrapOverviewPayload(record.data);
  }

  return {};
}

function mapTrendPoint(raw: unknown) {
  const item = unwrapStatisticsRecord<BackendTrendPoint>(raw);

  if (!item) {
    return null;
  }

  return {
    date: normalizeStatisticsDate(item.date ?? item.date_group),
    inputTokens: item.input_tokens ?? 0,
    outputTokens: item.output_tokens ?? 0,
    avgTotalTime: parseStatisticsNumber(item.avg_total_time),
    avgFirstTime: parseStatisticsNumber(item.avg_first_time),
    avgRate: parseStatisticsNumber(item.avg_rate),
  };
}

function mapQpsPoint(raw: unknown) {
  const item = unwrapStatisticsRecord<BackendQpsPoint>(raw);

  if (!item) {
    return null;
  }

  const date = normalizeStatisticsDate(item.date ?? item.date_group);

  if (!date) {
    return null;
  }

  return {
    date,
    avgQps: parseStatisticsNumber(item.avg_qps),
  };
}

function mapStatisticsOverview(payload: unknown): ModelStatisticsOverview {
  const source = unwrapOverviewPayload(payload);

  const trends = sortStatisticsPoints(
    (source.trends ?? [])
      .map(mapTrendPoint)
      .filter((item): item is NonNullable<typeof item> => Boolean(item?.date)),
  );

  const qpsData = sortStatisticsPoints(
    (source.qps_data ?? [])
      .map(mapQpsPoint)
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  );

  return {
    summary: {
      totalUsage: source.summary?.total_usage ?? 0,
      errorRate: parseStatisticsNumber(source.summary?.error_rate),
      avgResponseTime: parseStatisticsNumber(source.summary?.avg_response_time),
      totalTokens: source.summary?.total_tokens ?? 0,
      inputTokens: source.summary?.input_tokens ?? 0,
      outputTokens: source.summary?.output_tokens ?? 0,
    },
    trends,
    qpsData,
  };
}

export async function getModelStatisticsOverview(
  query: ModelStatisticsOverviewQuery,
): Promise<ModelStatisticsOverview> {
  if (useMock) {
    return mockModelStatisticsOverview;
  }

  const response = await http.get<unknown>(`${API_PREFIX}/llm/monitor/overview`, {
    params: {
      ...(query.modelId && query.modelId !== "all" ? { model_id: query.modelId } : {}),
      start_time: query.startTime,
      end_time: query.endTime,
    },
  });

  return mapStatisticsOverview(response.data);
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

export type MetricsTotalPending = {
  value: number | null;
};

export function createMetricsTotalPending(): MetricsTotalPending {
  return { value: null };
}

export function clearMetricsTotalPending(pending: MetricsTotalPending): void {
  pending.value = null;
}

export function rememberMetricsTotal(pending: MetricsTotalPending, metricsTotal: number): void {
  pending.value = metricsTotal;
}

export function consumePendingMetricsTotal(pending: MetricsTotalPending): number | null {
  const metricsTotal = pending.value;
  pending.value = null;
  return metricsTotal;
}

export function mergeKnowledgeNetworkMetricsTotal(
  detail: KnowledgeNetworkRecord,
  metricsTotal: number,
): KnowledgeNetworkRecord {
  return {
    ...detail,
    statistics: {
      ...detail.statistics,
      metricsTotal,
    },
  };
}

export function applyKnowledgeNetworkMetricsTotal(
  detail: KnowledgeNetworkRecord | null,
  metricsTotal: number,
  pending: MetricsTotalPending,
): KnowledgeNetworkRecord | null {
  if (!detail) {
    rememberMetricsTotal(pending, metricsTotal);
    return detail;
  }

  clearMetricsTotalPending(pending);
  return mergeKnowledgeNetworkMetricsTotal(detail, metricsTotal);
}

export function mergePendingMetricsTotalIntoDetail(
  detail: KnowledgeNetworkRecord,
  pending: MetricsTotalPending,
): KnowledgeNetworkRecord {
  const metricsTotal = consumePendingMetricsTotal(pending);
  if (metricsTotal === null) {
    return detail;
  }

  return mergeKnowledgeNetworkMetricsTotal(detail, metricsTotal);
}

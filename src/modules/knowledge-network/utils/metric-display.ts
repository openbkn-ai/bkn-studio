/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkObjectTypeRecord,
  MetricUnit,
  MetricUnitType,
} from "@/modules/knowledge-network/types/knowledge-network";

export function resolveMetricBoundObjectTypeName(
  metric: Pick<KnowledgeNetworkMetricRecord, "scopeRef" | "scopeType">,
  objectTypes: KnowledgeNetworkObjectTypeRecord[],
  emptyLabel = "--",
): string {
  if (metric.scopeType === "object_type") {
    return objectTypes.find((item) => item.id === metric.scopeRef)?.name ?? metric.scopeRef ?? emptyLabel;
  }

  return metric.scopeRef || emptyLabel;
}

export function formatMetricUnitTypeLabel(
  unitType: MetricUnitType | undefined,
  t: (key: string) => string,
  emptyLabel = "--",
): string {
  if (!unitType) {
    return emptyLabel;
  }

  return t(`knowledgeNetwork.metricUnitTypeOption.${unitType}`);
}

export function formatMetricUpdaterName(
  updaterName: string | undefined,
  emptyLabel = "--",
): string {
  const trimmed = updaterName?.trim();
  if (!trimmed || trimmed === "--" || trimmed === "-") {
    return emptyLabel;
  }

  return trimmed;
}

export function formatMetricUnitLabel(
  unit: MetricUnit | undefined,
  t: (key: string, options?: { defaultValue?: string }) => string,
  emptyLabel = "--",
): string {
  if (!unit) {
    return emptyLabel;
  }

  return t(`knowledgeNetwork.metricUnitOption.${unit}`, { defaultValue: unit });
}

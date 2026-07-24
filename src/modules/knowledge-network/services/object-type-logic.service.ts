/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  KnowledgeNetworkMetricRecord,
  ObjectTypeDataProperty,
  ObjectTypeLogicMetricModelRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  getKnowledgeNetworkMetric,
  listKnowledgeNetworkMetrics,
} from "@/modules/knowledge-network/services/metric.service";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";
import {
  buildMockObjectTypeDetail,
  mockMetrics,
  mockObjectTypeLogicMetricModels,
} from "@/modules/knowledge-network/services/mock/state";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";
import { mapMetricAnalysisDimensionFields } from "@/modules/knowledge-network/utils/metric-property-display";

function mapKnowledgeNetworkMetricToLogicMetricRecord(
  metric: KnowledgeNetworkMetricRecord,
  scopeProperties: ObjectTypeDataProperty[] = [],
): ObjectTypeLogicMetricModelRecord {
  const analysisDimensions = metric.calculationFormula.analysisDimensions ?? [];

  return {
    analysisDimensions: mapMetricAnalysisDimensionFields(analysisDimensions, scopeProperties),
    groupName: metric.tags[0] ?? "",
    id: metric.id,
    name: metric.name,
  };
}

async function loadScopeObjectTypeProperties(networkId: string, scopeRef: string) {
  if (!networkId || !scopeRef) {
    return [];
  }

  if (useMock) {
    return buildMockObjectTypeDetail(networkId, scopeRef)?.dataProperties ?? [];
  }

  const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, scopeRef);
  return detail?.dataProperties ?? [];
}

export async function listObjectTypeLogicMetricModels(networkId: string, scopeRef: string) {
  if (!networkId || !scopeRef) {
    return [];
  }

  const scopeProperties = await loadScopeObjectTypeProperties(networkId, scopeRef);

  if (useMock) {
    const metrics = (mockMetrics[networkId] ?? []).filter((item) => item.scopeRef === scopeRef);
    return wait(
      metrics.map((metric) => mapKnowledgeNetworkMetricToLogicMetricRecord(metric, scopeProperties)),
    );
  }

  const result = await listKnowledgeNetworkMetrics(networkId, {
    direction: "desc",
    limit: -1,
    offset: 0,
    scopeRef,
    sort: "update_time",
  });

  return result.entries.map((metric) =>
    mapKnowledgeNetworkMetricToLogicMetricRecord(metric, scopeProperties),
  );
}

export async function listObjectTypeLogicMetricModelFields(networkId: string, metricId: string) {
  if (!networkId || !metricId) {
    return [];
  }

  if (useMock) {
    const metric = Object.values(mockMetrics).flat().find((item) => item.id === metricId);
    if (metric) {
      const scopeProperties = await loadScopeObjectTypeProperties(networkId, metric.scopeRef);
      return wait(
        mapMetricAnalysisDimensionFields(
          metric.calculationFormula.analysisDimensions ?? [],
          scopeProperties,
        ),
      );
    }

    const model = mockObjectTypeLogicMetricModels.find((item) => item.id === metricId);
    return wait(
      (model?.analysisDimensions ?? []).map((item) => ({
        displayName: item.displayName,
        name: item.name,
        type: item.type,
      })),
    );
  }

  const metric = await getKnowledgeNetworkMetric(networkId, metricId);
  if (!metric) {
    return [];
  }

  const scopeProperties = await loadScopeObjectTypeProperties(networkId, metric.scopeRef);
  return mapMetricAnalysisDimensionFields(
    metric.calculationFormula.analysisDimensions ?? [],
    scopeProperties,
  );
}

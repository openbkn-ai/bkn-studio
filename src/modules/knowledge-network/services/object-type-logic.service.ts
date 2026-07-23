/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type {
  KnowledgeNetworkMetricRecord,
  ObjectTypeDataProperty,
  ObjectTypeLogicMetricModelField,
  ObjectTypeLogicMetricModelRecord,
  ObjectTypeLogicOperatorRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { BackendSmallModel } from "@/modules/knowledge-network/services/mappers/backend-types";
import { mapSmallModel } from "@/modules/knowledge-network/services/mappers";
import {
  getKnowledgeNetworkMetric,
  listKnowledgeNetworkMetrics,
} from "@/modules/knowledge-network/services/metric.service";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";
import {
  buildMockObjectTypeDetail,
  mockMetrics,
  mockObjectTypeLogicMetricModels,
  mockObjectTypeLogicOperators,
  mockObjectTypeSmallModels,
} from "@/modules/knowledge-network/services/mock/state";
import {
  type AgentOperatorListItem,
  listAllPublishedOperators,
} from "@/modules/knowledge-network/services/shared/agent-operator-client";
import { useMock, wait } from "@/modules/knowledge-network/services/shared/runtime";
import { getInputParamsFromToolOpenAPISpec } from "@/modules/knowledge-network/utils/tool-input-params";
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

function mapOperatorListItem(item: AgentOperatorListItem): ObjectTypeLogicOperatorRecord {
  const apiSpec = item.metadata?.api_spec;
  const inputParameters = getInputParamsFromToolOpenAPISpec(apiSpec);

  return {
    apiSpec,
    id: item.operator_id,
    inputParameters: inputParameters.length > 0 ? inputParameters : undefined,
    name: item.name ?? item.operator_id,
  };
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
    const metric = (Object.values(mockMetrics).flat() as KnowledgeNetworkMetricRecord[]).find(
      (item) => item.id === metricId,
    );
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
  ) satisfies ObjectTypeLogicMetricModelField[];
}

export async function listObjectTypeLogicOperators(): Promise<ObjectTypeLogicOperatorRecord[]> {
  if (useMock) {
    return wait(mockObjectTypeLogicOperators.map((item) => ({ ...item })));
  }

  return listAllPublishedOperators(mapOperatorListItem);
}

export async function listObjectTypeSmallModels() {
  if (useMock) {
    return wait(mockObjectTypeSmallModels.map((item) => ({ ...item })));
  }

  const response = await http.get<{ data?: BackendSmallModel[] }>(
    "/bkn-backend/v1/small-models",
    {
      params: {
        model_type: "embedding",
        page: 1,
        size: 9999,
      },
    },
  );

  return (response.data.data ?? []).map(mapSmallModel);
}

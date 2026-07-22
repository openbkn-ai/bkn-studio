/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type {
  KnowledgeNetworkMetricRecord,
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
import {
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

function mapKnowledgeNetworkMetricToLogicMetricRecord(
  metric: KnowledgeNetworkMetricRecord,
): ObjectTypeLogicMetricModelRecord {
  const analysisDimensions = metric.calculationFormula.analysisDimensions ?? [];

  return {
    analysisDimensions: analysisDimensions.map((name) => ({
      displayName: name,
      name,
      type: "string",
    })),
    groupName: metric.tags[0] ?? "",
    id: metric.id,
    name: metric.name,
  };
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

  if (useMock) {
    const metrics = (mockMetrics[networkId] ?? []).filter((item) => item.scopeRef === scopeRef);
    return wait(metrics.map(mapKnowledgeNetworkMetricToLogicMetricRecord));
  }

  const result = await listKnowledgeNetworkMetrics(networkId, {
    direction: "desc",
    limit: -1,
    offset: 0,
    scopeRef,
    sort: "update_time",
  });

  return result.entries.map(mapKnowledgeNetworkMetricToLogicMetricRecord);
}

export async function listObjectTypeLogicMetricModelFields(networkId: string, metricId: string) {
  if (!networkId || !metricId) {
    return [];
  }

  if (useMock) {
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

  return (metric.calculationFormula.analysisDimensions ?? []).map((name) => ({
    displayName: name,
    name,
    type: "string",
  })) satisfies ObjectTypeLogicMetricModelField[];
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

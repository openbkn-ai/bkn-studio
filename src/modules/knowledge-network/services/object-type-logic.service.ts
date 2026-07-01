/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { http } from "@/framework/request/http";
import type { ObjectTypeLogicOperatorRecord } from "@/modules/knowledge-network/types/knowledge-network";
import type { BackendSmallModel } from "@/modules/knowledge-network/services/mappers/backend-types";
import { mapSmallModel } from "@/modules/knowledge-network/services/mappers";
import {
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

type LegacyMetricModelDimension = {
  display_name?: string;
  name: string;
  type?: string;
};

type LegacyMetricModelRecord = {
  analysis_dimensions?: LegacyMetricModelDimension[];
  group_name?: string;
  id: string;
  name: string;
};

type LegacyMetricModelListResponse = {
  entries?: LegacyMetricModelRecord[];
};

async function getLegacyMetricModelDetail(modelId: string): Promise<LegacyMetricModelRecord | null> {
  const response = await http.get<LegacyMetricModelRecord[] | LegacyMetricModelRecord>(
    `/mdl-data-model/v1/metric-models/${modelId}`,
  );

  if (Array.isArray(response.data)) {
    return response.data[0] ?? null;
  }

  return response.data ?? null;
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

export async function listObjectTypeLogicMetricModels() {
  if (useMock) {
    return wait(mockObjectTypeLogicMetricModels.map((item) => ({ ...item })));
  }

  const response = await http.get<LegacyMetricModelListResponse>("/mdl-data-model/v1/metric-models", {
    params: {
      direction: "desc",
      limit: -1,
      offset: 0,
      sort: "update_time",
    },
  });

  return (response.data.entries ?? []).map((item) => ({
    analysisDimensions: (item.analysis_dimensions ?? []).map((dimension) => ({
      displayName: dimension.display_name ?? dimension.name,
      name: dimension.name,
      type: dimension.type ?? "string",
    })),
    groupName: item.group_name ?? "",
    id: item.id,
    name: item.name,
  }));
}

export async function listObjectTypeLogicMetricModelFields(modelId: string) {
  if (useMock) {
    const model = mockObjectTypeLogicMetricModels.find((item) => item.id === modelId);
    return wait(
      (model?.analysisDimensions ?? []).map((item) => ({
        displayName: item.displayName,
        name: item.name,
        type: item.type,
      })),
    );
  }

  try {
    const response = await http.get<LegacyMetricModelDimension[]>(
      `/mdl-uniquery/v1/metric-models/${modelId}/fields`,
    );

    return (response.data ?? []).map((item) => ({
      displayName: item.display_name ?? item.name,
      name: item.name,
      type: item.type ?? "string",
    }));
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) {
      throw error;
    }

    const detail = await getLegacyMetricModelDetail(modelId);

    return (detail?.analysis_dimensions ?? []).map((item) => ({
      displayName: item.display_name ?? item.name,
      name: item.name,
      type: item.type ?? "string",
    }));
  }
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

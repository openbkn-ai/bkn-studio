/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

export type ObjectMetricAnswerModel = { id: string; name: string };

type ModelListResponse = {
  data?: Array<{ model_id: string; model_name: string; model_type: string }>;
};

/** The public model list is filtered by the current user's display grants. */
export async function listObjectMetricAnswerModels(): Promise<ObjectMetricAnswerModel[]> {
  const response = await http.get<ModelListResponse>("/mf-model-manager/v1/llm/list", {
    params: { page: 1, size: 100, model_type: "llm" },
    skipErrorToast: true,
  });
  return (response.data.data ?? [])
    .filter((item) => item.model_type === "llm" && item.model_id && item.model_name)
    .map((item) => ({ id: item.model_id, name: item.model_name }));
}

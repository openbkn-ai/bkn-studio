/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { apiResourceChanges } from "../lib/api-resource";
import {
  parsePrecisionPreservingJSON,
  transformNumberLiteralJSONRequest,
  transformPrecisionSafeJSONResponse,
} from "@/framework/request/precision-safe-json";
import type {
  ApiResource,
  ApiResourceInput,
  ApiResourceQuery,
  ApiResourceResult,
  ApiResourceValidation,
} from "../types/api-resource";

function preciseDefinitionResponse(data: unknown): unknown {
  if (typeof data !== "string" || !data) return data;
  try {
    // Definitions keep JSON number/string identity; table data uses the safe display transformer.
    const precise = parsePrecisionPreservingJSON(data, {
      allowSpecialKeys: true,
      preserveNumberLiterals: true,
    }) as {
      entries?: ApiResource[];
    };
    const response = JSON.parse(data) as { entries?: ApiResource[] };
    response.entries?.forEach((entry, index) => {
      if (entry.category !== "api") return;
      const source = precise.entries?.[index];
      if (source) {
        entry.api_definition = source.api_definition;
        entry.schema_definition = source.schema_definition;
      }
    });
    return response;
  } catch {
    return data;
  }
}

/** Keep business numbers lossless; pagination counts retain the existing safe display type. */
function preciseResultResponse(data: unknown): unknown {
  const result = transformPrecisionSafeJSONResponse(data);
  if (typeof data !== "string" || !result || typeof result !== "object") return result;
  try {
    const precise = parsePrecisionPreservingJSON(data, {
      allowSpecialKeys: true,
    }) as ApiResourceResult;
    if (Array.isArray(precise.entries)) (result as ApiResourceResult).entries = precise.entries;
    return result;
  } catch {
    return result;
  }
}

const options = {
  skipErrorToast: true,
  transformRequest: transformNumberLiteralJSONRequest,
  transformResponse: preciseDefinitionResponse,
};

const saveOptions = { ...options, headers: { "Content-Type": "application/json" } };

export async function getApiResourceConnector(type: string, signal?: AbortSignal) {
  if (import.meta.env.VITE_USE_MOCK !== "false") {
    const { getMockApiResourceConnector } = await import("./api-resource-mock");
    return getMockApiResourceConnector(type, signal);
  }
  const response = await http.get<{ category: string; available: boolean; enabled: boolean }>(
    `/vega-backend/v1/connector-types/${encodeURIComponent(type)}`,
    { signal, skipErrorToast: true },
  );
  return response.data;
}

export async function getApiResource(id: string, signal?: AbortSignal): Promise<ApiResource> {
  if (import.meta.env.VITE_USE_MOCK !== "false") {
    const { getMockApiResource } = await import("./api-resource-mock");
    return getMockApiResource(id, signal);
  }
  const response = await http.get<{ entries: ApiResource[] }>(
    `/vega-backend/v1/resources/${encodeURIComponent(id)}`,
    { ...options, signal },
  );
  const resource = response.data.entries?.[0];
  if (!resource || resource.category !== "api" || resource.api_effect_type !== "read")
    throw new Error("dataCatalog.apiResource.errors.resource");
  return resource;
}

/** Explicit allowlist prevents API definitions from leaking into logical/internal storage fields. */
export function apiResourcePayload(
  input: ApiResourceInput,
  previous?: ApiResource,
  validation?: ApiResourceValidation,
) {
  const changes = apiResourceChanges(input, previous);
  const validationInput = {
    ...(validation && Object.hasOwn(validation, "filter_condition")
      ? { filter_condition: validation.filter_condition }
      : {}),
    ...(validation && Object.hasOwn(validation, "paging") ? { paging: validation.paging } : {}),
  };
  // Omit unchanged sections so the server can reuse the stored definition and credentials.
  return {
    catalog_id: input.catalog_id,
    name: input.name,
    description: input.description,
    tags: input.tags,
    category: "api",
    api_effect_type: "read",
    enabled: input.enabled,
    ...(previous ? { expected_update_time: previous.update_time } : {}),
    ...(changes.definition ? { api_definition: input.api_definition } : {}),
    ...(changes.schema ? { schema_definition: input.schema_definition } : {}),
    ...(changes.requiresValidation && Object.keys(validationInput).length
      ? { validation: validationInput }
      : {}),
  };
}

/** Creating/changing a definition invokes backend candidate validation before persistence. */
export async function saveApiResource(
  input: ApiResourceInput,
  previous?: ApiResource,
  validation?: ApiResourceValidation,
): Promise<string> {
  if (import.meta.env.VITE_USE_MOCK !== "false") {
    const { saveMockApiResource } = await import("./api-resource-mock");
    return saveMockApiResource(input, previous, validation);
  }
  const payload = apiResourcePayload(input, previous, validation);
  if (previous) {
    await http.put(
      `/vega-backend/v1/resources/${encodeURIComponent(previous.id)}`,
      payload,
      saveOptions,
    );
    return previous.id;
  }
  const response = await http.post<{ id: string }>(
    "/vega-backend/v1/resources",
    payload,
    saveOptions,
  );
  return response.data.id;
}

/** Only saved resources can be tested; never call the business target in the browser. */
export async function queryApiResource(
  id: string,
  query: ApiResourceQuery,
  signal?: AbortSignal,
): Promise<ApiResourceResult> {
  if (import.meta.env.VITE_USE_MOCK !== "false") {
    const { queryMockApiResource } = await import("./api-resource-mock");
    return queryMockApiResource(id, query, signal);
  }
  const response = await http.post<ApiResourceResult>(
    `/vega-backend/v1/resources/${encodeURIComponent(id)}/data`,
    {
      ...(Object.hasOwn(query, "filter_condition")
        ? { filter_condition: query.filter_condition }
        : {}),
      ...(Object.hasOwn(query, "paging") ? { paging: query.paging } : {}),
      ...(Object.hasOwn(query, "need_total") ? { need_total: query.need_total } : {}),
    },
    {
      ...options,
      transformResponse: preciseResultResponse,
      headers: { "Content-Type": "application/json", "X-HTTP-Method-Override": "GET" },
      signal,
    },
  );
  return response.data;
}

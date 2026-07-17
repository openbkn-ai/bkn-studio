/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  buildOpenApiFromQuickApi,
  inferQuickApiSchemaFromValue,
  parseQuickApiUrl,
  type QuickApiParameter,
  type QuickApiRequestBody,
  type QuickApiResponse,
} from "@/modules/execution-factory/utils/curl-to-openapi";

export type QuickApiResponseFormValue = {
  statusCode?: string;
  description?: string;
  contentType?: string;
  schemaText?: string;
  exampleText?: string;
};

export type QuickApiContractFormValues = {
  method: string;
  serverUrl: string;
  path: string;
  summary: string;
  description?: string;
  parameters?: QuickApiParameter[];
  requestBodyEnabled?: boolean;
  requestBodyContentType?: string;
  requestBodyRequired?: boolean;
  requestBodySchemaText?: string;
  requestBodyExampleText?: string;
  responses?: QuickApiResponseFormValue[];
};

export function mergeQuickApiParameters(
  detected: QuickApiParameter[],
  manual: QuickApiParameter[] | undefined,
) {
  return [
    ...detected,
    ...(manual ?? []).filter(
      (item) =>
        !detected.some(
          (detectedItem) => detectedItem.in === item.in && detectedItem.name === item.name,
        ),
    ),
  ];
}

export function buildEffectiveQuickApiValues<T extends QuickApiContractFormValues>(
  values: T,
  inputMode: "curl" | "form",
  detectedUrlParameters: QuickApiParameter[],
  detectedCurlContract?: Partial<QuickApiContractFormValues>,
): T {
  if (inputMode === "curl" && detectedCurlContract) {
    return {
      ...values,
      ...detectedCurlContract,
      summary: values.summary || detectedCurlContract.summary || "",
      description: values.description,
    };
  }

  return {
    ...values,
    parameters: mergeQuickApiParameters(detectedUrlParameters, values.parameters),
  };
}

export function resolveQuickApiFormContract<T extends QuickApiContractFormValues & { apiUrl?: string }>(
  values: T,
): T {
  if (values.serverUrl?.trim() && values.path?.trim()) {
    return values;
  }

  const apiUrl = values.apiUrl?.trim();
  if (!apiUrl) {
    return values;
  }

  const parsed = parseQuickApiUrl(apiUrl);
  if (!parsed.ok) {
    return values;
  }

  return {
    ...values,
    serverUrl: parsed.value.serverUrl,
    path: parsed.value.path,
    summary: values.summary?.trim() ? values.summary : parsed.value.summary,
    parameters: mergeQuickApiParameters(parsed.value.queryParams, values.parameters),
  };
}

function parseSchemaText(value?: string): Record<string, unknown> | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Schema must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

const JSON_SCHEMA_KEYWORDS = new Set([
  "$ref",
  "type",
  "properties",
  "items",
  "oneOf",
  "anyOf",
  "allOf",
  "enum",
  "const",
  "format",
  "additionalProperties",
]);

function isLikelyJsonSchema(schema: Record<string, unknown>) {
  return Object.keys(schema).some((key) => JSON_SCHEMA_KEYWORDS.has(key));
}

function parseExampleText(value: string | undefined, contentType?: string): unknown {
  if (!value?.trim()) {
    return undefined;
  }

  if (contentType?.includes("json")) {
    return JSON.parse(value);
  }

  return value;
}

function resolveSchemaAndExample(
  schemaText: string | undefined,
  exampleText: string | undefined,
  contentType?: string,
) {
  let schema = parseSchemaText(schemaText);
  let example = parseExampleText(exampleText, contentType);

  if (schema && !isLikelyJsonSchema(schema)) {
    if (example !== undefined) {
      throw new Error("Schema contains data fields instead of JSON Schema keywords");
    }
    example = schema;
    schema = inferQuickApiSchemaFromValue(example);
  } else if (!schema && example !== undefined) {
    schema = inferQuickApiSchemaFromValue(example);
  }

  return { schema, example };
}

export function buildQuickApiSubmissionFromValues(values: QuickApiContractFormValues) {
  if (!values.serverUrl?.trim() || !values.path?.trim() || !values.summary?.trim()) {
    return undefined;
  }

  try {
    const parameters = (values.parameters ?? [])
      .filter((parameter) => parameter.name?.trim())
      .map((parameter) => ({
        ...parameter,
        name: parameter.name.trim(),
        required: parameter.in === "path" ? true : Boolean(parameter.required),
      }));

    const requestBody: QuickApiRequestBody | undefined = values.requestBodyEnabled
      ? (() => {
          const content = resolveSchemaAndExample(
            values.requestBodySchemaText,
            values.requestBodyExampleText,
            values.requestBodyContentType,
          );
          return {
            contentType: values.requestBodyContentType || "application/json",
            required: values.requestBodyRequired ?? true,
            ...content,
          };
        })()
      : undefined;

    const responses: QuickApiResponse[] = (values.responses ?? [])
      .filter((response) => response.statusCode?.trim())
      .map((response) => {
        const content = resolveSchemaAndExample(
          response.schemaText,
          response.exampleText,
          response.contentType,
        );
        return {
          statusCode: response.statusCode?.trim() ?? "default",
          description: response.description?.trim() || "Response",
          contentType: response.contentType,
          ...content,
        };
      });

    const openapiSpec = buildOpenApiFromQuickApi({
      method: values.method || "GET",
      serverUrl: values.serverUrl.trim(),
      path: values.path.trim(),
      summary: values.summary.trim(),
      description: values.description,
      parameters,
      requestBody,
      responses,
    });

    return {
      openapiSpec,
      serviceUrl: values.serverUrl.trim(),
      method: values.method || "GET",
      path: values.path.trim(),
    };
  } catch {
    return undefined;
  }
}

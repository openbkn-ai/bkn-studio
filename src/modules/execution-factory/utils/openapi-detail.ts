/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ToolIoSpec } from "@/modules/execution-factory/types/tool";

export type OpenApiEndpointDetail = {
  ioSpec?: ToolIoSpec;
  method?: string;
  path?: string;
  serverUrl?: string;
};

const HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
]);

function parseOperationIoSpec(operation: Record<string, unknown>): ToolIoSpec {
  const parameters = Array.isArray(operation.parameters)
    ? operation.parameters
        .filter(
          (item): item is Record<string, unknown> => {
            if (typeof item !== "object" || item === null) {
              return false;
            }
            const record = item as Record<string, unknown>;
            return typeof record.name === "string";
          },
        )
        .map((item) => ({
          name: String(item.name),
          in: typeof item.in === "string" ? item.in : undefined,
          required: typeof item.required === "boolean" ? item.required : undefined,
          description:
            typeof item.description === "string" ? item.description : undefined,
          type:
            typeof (item.schema as { type?: string } | undefined)?.type === "string"
              ? (item.schema as { type: string }).type
              : undefined,
        }))
    : [];

  const requestBody = operation.requestBody as
    | {
        content?: Record<string, { example?: unknown; schema?: unknown }>;
        description?: string;
        required?: boolean;
      }
    | undefined;
  const requestContent = requestBody?.content ?? {};
  const firstRequestContent = Object.values(requestContent)[0];

  const responses: ToolIoSpec["responses"] = {};
  const rawResponses = operation.responses as
    | Record<
        string,
        {
          content?: Record<string, { example?: unknown; schema?: unknown }>;
          description?: string;
        }
      >
    | undefined;

  for (const [statusCode, response] of Object.entries(rawResponses ?? {})) {
    const content = Object.values(response.content ?? {})[0];
    responses[statusCode] = {
      description: response.description,
      example: content?.example,
      schema: content?.schema,
    };
  }

  return {
    parameters,
    requestBodyDescription: requestBody?.description,
    requestBodyRequired: requestBody?.required,
    requestBodyExample: firstRequestContent?.example,
    requestBodySchema: firstRequestContent?.schema,
    responses,
  };
}

export function parseOpenApiEndpointDetail(
  openapiSpec?: string,
): OpenApiEndpointDetail | undefined {
  if (!openapiSpec?.trim()) {
    return undefined;
  }

  let document: Record<string, unknown>;

  try {
    document = JSON.parse(openapiSpec) as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const servers = document.servers as Array<{ url?: string }> | undefined;
  const serverUrl = servers?.[0]?.url;
  const paths = document.paths as Record<string, Record<string, unknown>> | undefined;

  if (!paths) {
    return { serverUrl };
  }

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) {
        continue;
      }

      if (typeof operation !== "object" || operation === null) {
        continue;
      }

      return {
        serverUrl,
        path,
        method: method.toUpperCase(),
        ioSpec: parseOperationIoSpec(operation as Record<string, unknown>),
      };
    }
  }

  return { serverUrl };
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ToolIoParameter, ToolIoSpec } from "@/modules/execution-factory/types/tool";

export { buildDefaultDebugBody } from "@/modules/execution-factory/utils/generate-sample-json";

type ApiSpecMetadata = {
  api_spec?: {
    parameters?: Array<{
      description?: string;
      in?: string;
      name?: string;
      required?: boolean;
      schema?: { type?: string };
    }>;
    request_body?: {
      content?: Record<string, { example?: unknown; schema?: unknown }>;
      description?: string;
      required?: boolean;
    };
    responses?: Record<
      string,
      {
        content?: Record<string, { example?: unknown; schema?: unknown }>;
        description?: string;
      }
    >;
  };
  description?: string;
  method?: string;
  path?: string;
  summary?: string;
};

export function parseToolIoSpec(metadata?: ApiSpecMetadata): ToolIoSpec | undefined {
  if (!metadata?.api_spec) {
    if (metadata?.path || metadata?.method) {
      return {
        parameters: [],
        responses: {},
      };
    }

    return undefined;
  }

  const apiSpec = metadata.api_spec;
  const parameters: ToolIoParameter[] = (apiSpec.parameters ?? [])
    .filter((item) => item.name)
    .map((item) => ({
      name: item.name ?? "unknown",
      in: item.in,
      required: item.required,
      description: item.description,
      type: item.schema?.type,
    }));

  const requestContent = apiSpec.request_body?.content ?? {};
  const firstRequestContent = Object.values(requestContent)[0];

  const responses: ToolIoSpec["responses"] = {};
  for (const [statusCode, response] of Object.entries(apiSpec.responses ?? {})) {
    const content = Object.values(response.content ?? {})[0];
    responses[statusCode] = {
      description: response.description,
      example: content?.example,
      schema: content?.schema,
    };
  }

  return {
    parameters,
    requestBodyDescription: apiSpec.request_body?.description,
    requestBodyRequired: apiSpec.request_body?.required,
    requestBodyExample: firstRequestContent?.example,
    requestBodySchema: firstRequestContent?.schema,
    responses,
  };
}

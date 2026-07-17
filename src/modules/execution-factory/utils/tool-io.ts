/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ToolDebugInput,
  ToolIoParameter,
  ToolIoSpec,
} from "@/modules/execution-factory/types/tool";

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

function pickRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function pickStringRecord(value: unknown): Record<string, string> | undefined {
  const record = pickRecord(value);
  if (!record) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, String(item)]),
  );
}

function hasStructuredDebugPayload(input: Record<string, unknown>) {
  return "query" in input || "header" in input || "body" in input || "path" in input;
}

export function buildToolDebugRequest(
  input?: Record<string, unknown>,
  ioSpec?: ToolIoSpec,
): ToolDebugInput {
  if (!input) {
    return {};
  }

  if (hasStructuredDebugPayload(input)) {
    return {
      body: pickRecord(input.body),
      header: pickRecord(input.header),
      query: pickRecord(input.query),
      path: pickStringRecord(input.path),
    };
  }

  const body: Record<string, unknown> = {};
  const header: Record<string, unknown> = {};
  const query: Record<string, unknown> = {};
  const path: Record<string, string> = {};
  const consumedKeys = new Set<string>();

  for (const parameter of ioSpec?.parameters ?? []) {
    if (!(parameter.name in input)) {
      continue;
    }

    consumedKeys.add(parameter.name);

    if (parameter.in === "header") {
      header[parameter.name] = input[parameter.name];
    } else if (parameter.in === "query") {
      query[parameter.name] = input[parameter.name];
    } else if (parameter.in === "path") {
      path[parameter.name] = String(input[parameter.name]);
    } else {
      body[parameter.name] = input[parameter.name];
    }
  }

  for (const [key, value] of Object.entries(input)) {
    if (!consumedKeys.has(key)) {
      body[key] = value;
    }
  }

  return {
    ...(Object.keys(body).length > 0 ? { body } : {}),
    ...(Object.keys(header).length > 0 ? { header } : {}),
    ...(Object.keys(query).length > 0 ? { query } : {}),
    ...(Object.keys(path).length > 0 ? { path } : {}),
  };
}

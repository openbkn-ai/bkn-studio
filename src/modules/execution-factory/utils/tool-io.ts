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
import { resolveOpenApiLocalRefs } from "@/modules/execution-factory/utils/openapi-operation-io";

export { buildDefaultDebugBody } from "@/modules/execution-factory/utils/generate-sample-json";

type ApiSpecMediaContent = {
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
  schema?: unknown;
};

type ApiSpecResponse = {
  content?: Record<string, ApiSpecMediaContent>;
  description?: string;
  status_code?: string;
  statusCode?: string;
};

type ApiSpecMetadata = {
  api_spec?: {
    components?: {
      schemas?: Record<string, unknown>;
    };
    parameters?: Array<{
      description?: string;
      in?: string;
      name?: string;
      required?: boolean;
      schema?: { type?: string } | unknown;
    }>;
    request_body?: {
      content?: Record<string, ApiSpecMediaContent>;
      description?: string;
      required?: boolean;
    };
    responses?: ApiSpecResponse[] | Record<string, ApiSpecResponse>;
  };
  description?: string;
  method?: string;
  path?: string;
  summary?: string;
};

const PREFERRED_MEDIA_TYPES = [
  "application/json",
  "application/problem+json",
  "text/json",
  "*/*",
];

function pickPreferredContentEntry(
  content?: Record<string, ApiSpecMediaContent>,
): ApiSpecMediaContent | undefined {
  if (!content) {
    return undefined;
  }

  for (const mediaType of PREFERRED_MEDIA_TYPES) {
    const entry = content[mediaType];
    if (entry && typeof entry === "object") {
      return entry;
    }
  }

  const jsonLikeKey = Object.keys(content).find((key) => /json/i.test(key) || key.endsWith("+json"));
  if (jsonLikeKey) {
    return content[jsonLikeKey];
  }

  return Object.values(content)[0];
}

function pickContentExample(content?: ApiSpecMediaContent): unknown {
  if (!content) {
    return undefined;
  }

  if (content.example !== undefined) {
    return content.example;
  }

  if (!content.examples || typeof content.examples !== "object") {
    return undefined;
  }

  for (const example of Object.values(content.examples)) {
    if (example && typeof example === "object" && example.value !== undefined) {
      return example.value;
    }
  }

  return undefined;
}

function resolveSchemaType(schema: unknown): string | undefined {
  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  const record = schema as Record<string, unknown>;
  if (typeof record.type === "string") {
    return record.type;
  }

  if (typeof record.$ref === "string") {
    return record.$ref.split("/").pop();
  }

  return undefined;
}

function schemaDescription(schema: unknown): string | undefined {
  if (!schema || typeof schema !== "object") {
    return undefined;
  }

  const description = (schema as { description?: unknown }).description;
  return typeof description === "string" && description.trim() ? description : undefined;
}

export function normalizeToolApiSpecResponses(
  rawResponses: ApiSpecResponse[] | Record<string, ApiSpecResponse> | undefined,
): Record<string, ApiSpecResponse> {
  if (!rawResponses) {
    return {};
  }

  if (Array.isArray(rawResponses)) {
    const normalized: Record<string, ApiSpecResponse> = {};
    for (const item of rawResponses) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const statusCode = item.status_code ?? item.statusCode;
      if (typeof statusCode !== "string" || !statusCode.trim()) {
        continue;
      }
      normalized[statusCode.trim()] = item;
    }
    return normalized;
  }

  return rawResponses;
}

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
  const document = apiSpec as Record<string, unknown>;

  const parameters: ToolIoParameter[] = (apiSpec.parameters ?? [])
    .map((rawItem) => resolveOpenApiLocalRefs(rawItem, document) as Record<string, unknown>)
    .filter((item) => typeof item.name === "string" && item.name.trim())
    .map((item) => {
      const schema = resolveOpenApiLocalRefs(item.schema, document);
      return {
        name: String(item.name),
        in: typeof item.in === "string" ? item.in : undefined,
        required: item.required === true,
        description: typeof item.description === "string" ? item.description : undefined,
        type: resolveSchemaType(schema),
      };
    });

  const requestBody = resolveOpenApiLocalRefs(apiSpec.request_body, document) as
    | NonNullable<ApiSpecMetadata["api_spec"]>["request_body"]
    | undefined;
  const requestContent = pickPreferredContentEntry(requestBody?.content);
  const requestBodySchema = resolveOpenApiLocalRefs(requestContent?.schema, document);
  const requestBodyExample = pickContentExample(requestContent);
  const requestBodyDescription =
    (typeof requestBody?.description === "string" && requestBody.description.trim()
      ? requestBody.description
      : undefined) ?? schemaDescription(requestBodySchema);

  const responses: ToolIoSpec["responses"] = {};
  for (const [statusCode, response] of Object.entries(
    normalizeToolApiSpecResponses(apiSpec.responses),
  )) {
    const resolvedResponse = resolveOpenApiLocalRefs(response, document) as ApiSpecResponse;
    const content = pickPreferredContentEntry(resolvedResponse.content);
    responses[statusCode] = {
      description:
        typeof resolvedResponse.description === "string"
          ? resolvedResponse.description
          : undefined,
      example: pickContentExample(content),
      schema: resolveOpenApiLocalRefs(content?.schema, document),
    };
  }

  return {
    parameters,
    requestBodyDescription,
    requestBodyRequired: requestBody?.required === true,
    requestBodyExample,
    requestBodySchema,
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

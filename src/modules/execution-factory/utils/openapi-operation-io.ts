/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { OpenApiOperationPreview } from "@/modules/execution-factory/utils/metadata-content";
import { analyzeOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";
import type { ToolIoParameter, ToolIoSpec } from "@/modules/execution-factory/types/tool";

const HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
]);

export type OpenApiOperationWithIo = OpenApiOperationPreview & {
  description?: string;
  io: ToolIoSpec;
};

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

function firstContentEntry(content?: Record<string, unknown>) {
  if (!content) {
    return undefined;
  }

  return Object.values(content)[0] as { example?: unknown; schema?: unknown } | undefined;
}

function parseOperationIo(operation: Record<string, unknown>): ToolIoSpec {
  const parameters: ToolIoParameter[] = [];

  for (const item of (operation.parameters as Array<Record<string, unknown>>) ?? []) {
    if (typeof item.name !== "string") {
      continue;
    }

    parameters.push({
      name: item.name,
      in: typeof item.in === "string" ? item.in : undefined,
      required: item.required === true,
      description: typeof item.description === "string" ? item.description : undefined,
      type: resolveSchemaType(item.schema),
    });
  }

  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  let requestBodyDescription: string | undefined;
  let requestBodyRequired: boolean | undefined;
  let requestBodyExample: unknown;
  let requestBodySchema: unknown;

  if (requestBody && typeof requestBody === "object") {
    requestBodyDescription =
      typeof requestBody.description === "string" ? requestBody.description : undefined;
    requestBodyRequired = requestBody.required === true;
    const content = firstContentEntry(requestBody.content as Record<string, unknown> | undefined);
    requestBodyExample = content?.example;
    requestBodySchema = content?.schema;
  }

  const responses: ToolIoSpec["responses"] = {};

  for (const [statusCode, response] of Object.entries(
    (operation.responses as Record<string, unknown>) ?? {},
  )) {
    if (!response || typeof response !== "object") {
      continue;
    }

    const resp = response as Record<string, unknown>;
    const content = firstContentEntry(resp.content as Record<string, unknown> | undefined);

    responses[statusCode] = {
      description: typeof resp.description === "string" ? resp.description : undefined,
      example: content?.example,
      schema: content?.schema,
    };
  }

  return {
    parameters,
    requestBodyDescription,
    requestBodyRequired,
    requestBodyExample,
    requestBodySchema,
    responses,
  };
}

export function extractOpenApiOperationsIo(openapiSpec?: string): OpenApiOperationWithIo[] {
  if (!openapiSpec?.trim()) {
    return [];
  }

  const analysis = analyzeOpenApiDocumentText(openapiSpec);

  if (!analysis.ok) {
    return [];
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(openapiSpec) as Record<string, unknown>;
  } catch {
    return [];
  }

  const paths = parsed.paths;

  if (!paths || typeof paths !== "object") {
    return [];
  }

  const result: OpenApiOperationWithIo[] = [];

  for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) {
        continue;
      }

      if (!operation || typeof operation !== "object") {
        continue;
      }

      const op = operation as Record<string, unknown>;
      const summary = typeof op.summary === "string" ? op.summary : undefined;
      const description = typeof op.description === "string" ? op.description : undefined;

      result.push({
        path,
        method: method.toUpperCase(),
        summary,
        description,
        io: parseOperationIo(op),
      });
    }
  }

  return result;
}

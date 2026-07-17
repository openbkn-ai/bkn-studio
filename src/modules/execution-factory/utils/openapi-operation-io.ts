/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { OpenApiOperationPreview } from "@/modules/execution-factory/utils/metadata-content";
import {
  analyzeOpenApiDocumentText,
  parseOpenApiDocumentText,
} from "@/modules/execution-factory/utils/metadata-content";
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

const MAX_REF_DEPTH = 50;

function decodeJsonPointerSegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Keep the original segment when the URI fragment is malformed.
  }
  return decoded.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveLocalRef(document: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    return undefined;
  }

  let current: unknown = document;
  for (const rawSegment of ref.slice(2).split("/")) {
    const segment = decodeJsonPointerSegment(rawSegment);

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (
      !current ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function resolveOpenApiLocalRefs(
  value: unknown,
  document: Record<string, unknown>,
  resolvingRefs = new Set<string>(),
  depth = 0,
): unknown {
  if (depth >= MAX_REF_DEPTH || !value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      resolveOpenApiLocalRefs(item, document, resolvingRefs, depth + 1),
    );
  }

  const record = value as Record<string, unknown>;
  const ref = typeof record.$ref === "string" ? record.$ref : undefined;

  if (ref) {
    const siblingEntries = Object.entries(record).filter(([key]) => key !== "$ref");
    if (!ref.startsWith("#/") || resolvingRefs.has(ref)) {
      return Object.fromEntries([
        ["$ref", ref],
        ...siblingEntries.map(([key, item]) => [
          key,
          resolveOpenApiLocalRefs(item, document, resolvingRefs, depth + 1),
        ]),
      ]);
    }

    const target = resolveLocalRef(document, ref);
    if (target !== undefined) {
      const nextResolvingRefs = new Set(resolvingRefs);
      nextResolvingRefs.add(ref);
      const resolvedTarget = resolveOpenApiLocalRefs(
        target,
        document,
        nextResolvingRefs,
        depth + 1,
      );
      const resolvedSiblings = Object.fromEntries(
        siblingEntries.map(([key, item]) => [
          key,
          resolveOpenApiLocalRefs(item, document, resolvingRefs, depth + 1),
        ]),
      );

      if (
        resolvedTarget &&
        typeof resolvedTarget === "object" &&
        !Array.isArray(resolvedTarget)
      ) {
        return {
          ...(resolvedTarget as Record<string, unknown>),
          ...resolvedSiblings,
        };
      }
      return siblingEntries.length > 0 ? resolvedSiblings : resolvedTarget;
    }
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      resolveOpenApiLocalRefs(item, document, resolvingRefs, depth + 1),
    ]),
  );
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

type OpenApiMediaContent = {
  example?: unknown;
  examples?: Record<string, { value?: unknown; externalValue?: string }>;
  schema?: unknown;
};

const PREFERRED_MEDIA_TYPES = [
  "application/json",
  "application/problem+json",
  "text/json",
  "*/*",
];

function pickPreferredContentEntry(
  content?: Record<string, unknown>,
): OpenApiMediaContent | undefined {
  if (!content) {
    return undefined;
  }

  for (const mediaType of PREFERRED_MEDIA_TYPES) {
    const entry = content[mediaType];
    if (entry && typeof entry === "object") {
      return entry as OpenApiMediaContent;
    }
  }

  const jsonLikeKey = Object.keys(content).find((key) => /json/i.test(key) || key.endsWith("+json"));
  if (jsonLikeKey) {
    const entry = content[jsonLikeKey];
    if (entry && typeof entry === "object") {
      return entry as OpenApiMediaContent;
    }
  }

  const first = Object.values(content)[0];
  return first && typeof first === "object" ? (first as OpenApiMediaContent) : undefined;
}

function pickContentExample(content?: OpenApiMediaContent): unknown {
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
    if (!example || typeof example !== "object") {
      continue;
    }
    if ("value" in example && example.value !== undefined) {
      return example.value;
    }
  }

  return undefined;
}

function parameterKey(name: string, location?: string): string {
  return `${location ?? ""}:${name}`;
}

function collectParameters(
  rawParameters: unknown,
  document: Record<string, unknown>,
): ToolIoParameter[] {
  if (!Array.isArray(rawParameters)) {
    return [];
  }

  const parameters: ToolIoParameter[] = [];

  for (const rawItem of rawParameters) {
    const item = resolveOpenApiLocalRefs(rawItem, document) as Record<string, unknown>;
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

  return parameters;
}

export function mergeOpenApiParameters(
  pathParameters: ToolIoParameter[],
  operationParameters: ToolIoParameter[],
): ToolIoParameter[] {
  const merged = new Map<string, ToolIoParameter>();

  for (const parameter of pathParameters) {
    merged.set(parameterKey(parameter.name, parameter.in), parameter);
  }

  for (const parameter of operationParameters) {
    merged.set(parameterKey(parameter.name, parameter.in), parameter);
  }

  return Array.from(merged.values());
}

export function parseOpenApiOperationIo(
  operation: Record<string, unknown>,
  document: Record<string, unknown>,
  pathItem?: Record<string, unknown>,
): ToolIoSpec {
  const parameters = mergeOpenApiParameters(
    collectParameters(pathItem?.parameters, document),
    collectParameters(operation.parameters, document),
  );

  const requestBody = resolveOpenApiLocalRefs(operation.requestBody, document) as
    | Record<string, unknown>
    | undefined;
  let requestBodyDescription: string | undefined;
  let requestBodyRequired: boolean | undefined;
  let requestBodyExample: unknown;
  let requestBodySchema: unknown;

  if (requestBody && typeof requestBody === "object") {
    requestBodyDescription =
      typeof requestBody.description === "string" ? requestBody.description : undefined;
    requestBodyRequired = requestBody.required === true;
    const content = pickPreferredContentEntry(
      requestBody.content as Record<string, unknown> | undefined,
    );
    requestBodyExample = pickContentExample(content);
    requestBodySchema = content?.schema;
  }

  const responses: ToolIoSpec["responses"] = {};

  for (const [statusCode, response] of Object.entries(
    (operation.responses as Record<string, unknown>) ?? {},
  )) {
    if (!response || typeof response !== "object") {
      continue;
    }

    const resp = resolveOpenApiLocalRefs(response, document) as Record<string, unknown>;
    const content = pickPreferredContentEntry(resp.content as Record<string, unknown> | undefined);

    responses[statusCode] = {
      description: typeof resp.description === "string" ? resp.description : undefined,
      example: pickContentExample(content),
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

  const parseResult = parseOpenApiDocumentText(openapiSpec);
  if (!parseResult.ok) {
    return [];
  }
  const parsed = parseResult.document;

  const paths = parsed.paths;

  if (!paths || typeof paths !== "object") {
    return [];
  }

  const result: OpenApiOperationWithIo[] = [];

  for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    const pathRecord = pathItem as Record<string, unknown>;

    for (const [method, operation] of Object.entries(pathRecord)) {
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
        io: parseOpenApiOperationIo(op, parsed, pathRecord),
      });
    }
  }

  return result;
}

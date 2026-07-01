/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import type { ToolIoParameter, ToolIoSpec } from "@/modules/execution-factory/types/tool";

type JsonSchema = Record<string, unknown>;

export type DebugPayloadSource = {
  functionInput?: { inputs?: FunctionParameterDef[] };
  inputSchema?: unknown;
  ioSpec?: ToolIoSpec;
};

function resolveJsonSchemaRef(ref: string, root: JsonSchema): unknown {
  if (!ref.startsWith("#/")) {
    return undefined;
  }

  const segments = ref.slice(2).split("/");
  let current: unknown = root;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as JsonSchema)[segment];
  }

  return current;
}

function sampleForSimpleType(type?: string): unknown {
  switch (type) {
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

export function generateSampleFromJsonSchema(schema: unknown, root?: unknown): unknown {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  const rootSchema = (root ?? schema) as JsonSchema;
  const current = schema as JsonSchema;

  if ("example" in current && current.example !== undefined) {
    return current.example;
  }

  if ("default" in current && current.default !== undefined) {
    return current.default;
  }

  if (typeof current.$ref === "string") {
    const resolved = resolveJsonSchemaRef(current.$ref, rootSchema);
    if (resolved) {
      return generateSampleFromJsonSchema(resolved, rootSchema);
    }
  }

  if (Array.isArray(current.enum) && current.enum.length > 0) {
    return current.enum[0];
  }

  const type = current.type;

  if (type === "string") {
    return typeof current.example === "string"
      ? current.example
      : current.format === "date-time"
        ? "2024-01-01T00:00:00Z"
        : "";
  }

  if (type === "integer" || type === "number") {
    return 0;
  }

  if (type === "boolean") {
    return false;
  }

  if (type === "null") {
    return null;
  }

  if (type === "array") {
    const itemSample = generateSampleFromJsonSchema(current.items ?? { type: "string" }, rootSchema);
    return itemSample === undefined ? [] : [itemSample];
  }

  if (type === "object" || current.properties) {
    const properties = (current.properties ?? {}) as Record<string, JsonSchema>;
    const result: Record<string, unknown> = {};

    for (const [key, propertySchema] of Object.entries(properties)) {
      result[key] = generateSampleFromJsonSchema(propertySchema, rootSchema);
    }

    return result;
  }

  if (Array.isArray(current.oneOf) && current.oneOf[0]) {
    return generateSampleFromJsonSchema(current.oneOf[0], rootSchema);
  }

  if (Array.isArray(current.anyOf) && current.anyOf[0]) {
    return generateSampleFromJsonSchema(current.anyOf[0], rootSchema);
  }

  return null;
}

export function buildSampleFromFunctionInputs(
  inputs: FunctionParameterDef[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const item of inputs) {
    if (!item.name) {
      continue;
    }

    result[item.name] = sampleForSimpleType(item.type);
  }

  return result;
}

export function buildSampleFromToolParameters(
  parameters: ToolIoParameter[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const parameter of parameters) {
    if (parameter.in && !["query", "path", "header"].includes(parameter.in)) {
      continue;
    }

    result[parameter.name] = sampleForSimpleType(parameter.type);
  }

  return result;
}

export function buildDebugPayloadSample(source?: DebugPayloadSource): Record<string, unknown> {
  if (source?.functionInput?.inputs?.length) {
    return buildSampleFromFunctionInputs(source.functionInput.inputs);
  }

  if (source?.inputSchema) {
    const generated = generateSampleFromJsonSchema(source.inputSchema);
    if (generated && typeof generated === "object" && !Array.isArray(generated)) {
      return generated as Record<string, unknown>;
    }
  }

  const ioSpec = source?.ioSpec;

  if (ioSpec?.requestBodyExample && typeof ioSpec.requestBodyExample === "object") {
    return ioSpec.requestBodyExample as Record<string, unknown>;
  }

  if (ioSpec?.requestBodySchema) {
    const generated = generateSampleFromJsonSchema(ioSpec.requestBodySchema);
    if (generated && typeof generated === "object" && !Array.isArray(generated)) {
      return generated as Record<string, unknown>;
    }
  }

  if (ioSpec?.parameters.length) {
    const fromParameters = buildSampleFromToolParameters(ioSpec.parameters);
    if (Object.keys(fromParameters).length > 0) {
      return fromParameters;
    }
  }

  return {};
}

export function buildDefaultDebugBody(source?: DebugPayloadSource | ToolIoSpec): string {
  const normalized: DebugPayloadSource | undefined =
    source && "parameters" in source ? { ioSpec: source } : source;

  return JSON.stringify(buildDebugPayloadSample(normalized), null, 2);
}

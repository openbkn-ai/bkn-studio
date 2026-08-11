/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

/**
 * Function-tool input/output declarations are absent from GET details' function_content and must
 * be reconstructed from api_spec JSON Schema. Without this, the edit form is empty and saving overwrites declared parameters.
 */

/** JSON Schema array elements have no names; use the backend's placeholder name for round trips. */
export const ARRAY_ITEM_NAME = "item";

export type JsonSchema = {
  description?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asSchema(value: unknown): JsonSchema | null {
  return asRecord(value);
}

function jsonContentSchema(content: unknown): JsonSchema | null {
  const record = asRecord(content);
  const json = record ? asRecord(record["application/json"]) : null;
  return json ? asSchema(json.schema) : null;
}

function schemaToParameter(
  name: string,
  schema: JsonSchema,
  required: boolean,
): FunctionParameterDef {
  const type = typeof schema.type === "string" && schema.type ? schema.type : "string";
  const parameter: FunctionParameterDef = {
    name,
    type,
    description: schema.description,
    required,
  };

  if (type === "object") {
    const children = schemaToParameters(schema);
    if (children.length > 0) {
      parameter.sub_parameters = children;
    }
    return parameter;
  }

  if (type === "array") {
    const items = asSchema(schema.items);
    if (items) {
      parameter.sub_parameters = [schemaToParameter(ARRAY_ITEM_NAME, items, true)];
    }
  }

  return parameter;
}

function schemaToParameters(schema: JsonSchema | null): FunctionParameterDef[] {
  const properties = schema ? asRecord(schema.properties) : null;
  if (!properties) {
    return [];
  }

  const required = new Set(Array.isArray(schema?.required) ? schema.required : []);

  return Object.entries(properties).flatMap(([name, rawChild]) => {
    const child = asSchema(rawChild);
    return child ? [schemaToParameter(name, child, required.has(name))] : [];
  });
}

function parseApiSpec(apiSpec: unknown): Record<string, unknown> | null {
  if (typeof apiSpec === "string") {
    try {
      return asRecord(JSON.parse(apiSpec));
    } catch {
      return null;
    }
  }

  return asRecord(apiSpec);
}

/**
 * Output parameters are under `result` in the 200 response. Sibling stdout, stderr, and metrics
 * are sandbox response fields, not user-declared outputs.
 */
function successResultSchema(spec: Record<string, unknown>): JsonSchema | null {
  const responses = spec.responses;
  if (!Array.isArray(responses)) {
    return null;
  }

  const success = responses
    .map(asRecord)
    .find((item) => item !== null && String(item.status_code) === "200");

  const envelope = success ? jsonContentSchema(success.content) : null;
  const properties = envelope ? asRecord(envelope.properties) : null;

  return properties ? asSchema(properties.result) : null;
}

export function parseFunctionParametersFromApiSpec(apiSpec: unknown): {
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
} {
  const spec = parseApiSpec(apiSpec);
  if (!spec) {
    return {};
  }

  const requestBody = asRecord(spec.request_body);
  const inputs = schemaToParameters(requestBody ? jsonContentSchema(requestBody.content) : null);
  const outputs = schemaToParameters(successResultSchema(spec));

  return {
    inputs: inputs.length > 0 ? inputs : undefined,
    outputs: outputs.length > 0 ? outputs : undefined,
  };
}

/**
 * Converts parameters to JSON Schema for Monaco test-input completion and validation. This is the
 * inverse of reconstruction above: objects expand to properties and arrays to items.
 */
function parameterToSchema(parameter: FunctionParameterDef): JsonSchema {
  const type = parameter.type ?? "string";
  const schema: JsonSchema = { type: type === "integer" ? "integer" : type };

  if (parameter.description?.trim()) {
    schema.description = parameter.description;
  }

  if (type === "object") {
    const { properties, required } = parametersToSchemaBody(parameter.sub_parameters ?? []);
    schema.properties = properties;
    if (required.length > 0) {
      schema.required = required;
    }
    return schema;
  }

  if (type === "array") {
    const item = parameter.sub_parameters?.[0];
    schema.items = item ? parameterToSchema(item) : {};
  }

  return schema;
}

function parametersToSchemaBody(parameters: FunctionParameterDef[]) {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  parameters.forEach((parameter) => {
    const name = parameter.name?.trim();
    if (!name) {
      return;
    }

    properties[name] = parameterToSchema(parameter);
    if (parameter.required) {
      required.push(name);
    }
  });

  return { properties, required };
}

export function buildJsonSchemaFromParameters(
  parameters: FunctionParameterDef[] | undefined,
): JsonSchema | null {
  if (!parameters || parameters.length === 0) {
    return null;
  }

  const { properties, required } = parametersToSchemaBody(parameters);
  if (Object.keys(properties).length === 0) {
    return null;
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

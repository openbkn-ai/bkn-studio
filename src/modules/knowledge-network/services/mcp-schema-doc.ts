/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Presentation model for the human-facing MCP documentation view. */
export type McpSchemaField = {
  name: string;
  path: string;
  depth: number;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  enumValues?: unknown[];
  allowsAdditionalProperties: boolean;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function propertiesOf(schema: unknown): JsonRecord {
  const record = asRecord(schema);
  return asRecord(record?.properties) ?? {};
}

function requiredOf(schema: unknown): Set<string> {
  const record = asRecord(schema);
  return new Set(Array.isArray(record?.required) ? record.required.filter((value): value is string => typeof value === "string") : []);
}

function typeOf(schema: unknown): string {
  const record = asRecord(schema);
  if (!record) return "unknown";
  const declared = record.type;
  if (Array.isArray(declared)) return declared.filter((value): value is string => typeof value === "string").join(" | ") || "unknown";
  if (typeof declared === "string") {
    if (declared !== "array") return declared;
    const itemType = typeOf(record.items);
    return itemType === "unknown" ? "array" : `${itemType}[]`;
  }
  if (Array.isArray(record.enum)) return "enum";
  if (record.properties) return "object";
  return "unknown";
}

function fieldOf(name: string, schema: unknown, path: string, depth: number, required: boolean): McpSchemaField {
  const record = asRecord(schema) ?? {};
  return {
    name,
    path,
    depth,
    type: typeOf(schema),
    required,
    description: typeof record.description === "string" ? record.description : undefined,
    defaultValue: record.default,
    enumValues: Array.isArray(record.enum) ? record.enum : undefined,
    allowsAdditionalProperties: record.additionalProperties === true,
  };
}

function nestedFields(schema: unknown, path: string, depth: number): McpSchemaField[] {
  if (depth >= 4) return [];
  const record = asRecord(schema);
  if (!record) return [];
  const objectSchema = record.type === "array" ? record.items : schema;
  const props = propertiesOf(objectSchema);
  const required = requiredOf(objectSchema);
  const suffix = record.type === "array" ? "[]" : "";
  return Object.entries(props).flatMap(([name, child]) => {
    const childPath = `${path}${suffix}.${name}`;
    return [fieldOf(name, child, childPath, depth, required.has(name)), ...nestedFields(child, childPath, depth + 1)];
  });
}

/** Flattens object and array properties while retaining an indentation depth for rendering. */
export function schemaFields(schema: unknown): McpSchemaField[] {
  const props = propertiesOf(schema);
  const required = requiredOf(schema);
  return Object.entries(props).flatMap(([name, child]) => [fieldOf(name, child, name, 0, required.has(name)), ...nestedFields(child, name, 1)]);
}

/** Separates Studio-managed lifecycle data from parameters a person is expected to choose. */
export function splitInputSchemaFields(schema: unknown): { businessFields: McpSchemaField[]; traceFields: McpSchemaField[] } {
  const fields = schemaFields(schema);
  const isTraceField = (field: McpSchemaField) => field.path === "bkn_context" || field.path.startsWith("bkn_context.") || field.path.startsWith("bkn_context[]");
  return {
    businessFields: fields.filter((field) => !isTraceField(field)),
    traceFields: fields.filter(isTraceField),
  };
}

/** Formats the current request editor contents without the managed context injected by Studio. */
export function businessRequestExample(bodyText: string): string {
  try {
    const body = asRecord(JSON.parse(bodyText));
    if (!body) return "{}";
    const businessBody = { ...body };
    delete businessBody.bkn_context;
    return JSON.stringify(businessBody, null, 2);
  } catch {
    return "{}";
  }
}

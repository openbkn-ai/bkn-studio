/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";

export type ActionExecutionInput = {
  dynamic_params?: Record<string, unknown>;
  _instance_identities?: Record<string, unknown>[];
  relation_target?: {
    source_identity: Record<string, unknown>;
    target_identity: Record<string, unknown>;
  };
  object_input?: Record<string, unknown>;
};

export type ActionExecutionSchema = {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, ActionExecutionSchema>;
  required?: string[];
  items?: ActionExecutionSchema;
  minItems?: number;
  maxItems?: number;
  enum?: (string | number | boolean)[];
};

/** Parse only fields exposed by the authoritative execution schema. */
export function parseActionExecutionInput(schema: ActionExecutionSchema, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (schema.type === "object" && schema.properties) {
    const values = value as Record<string, unknown>;
    const entries = Object.entries(schema.properties).flatMap(([key, field]) => {
      const parsed = parseActionExecutionInput(field, values[key]);
      return parsed === undefined ? [] : [[key, parsed]];
    });
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (schema.type === "array" && schema.items?.properties && Array.isArray(value)) {
    return value.map((item) => parseActionExecutionInput(schema.items!, item));
  }
  if (
    ["array", "object", "integer", "number"].includes(schema.type ?? "") &&
    typeof value === "string"
  ) {
    const parsed = parsePrecisionPreservingJSON(value);
    if (schema.type === "array" && !Array.isArray(parsed)) throw new Error("Expected a JSON array");
    if (
      schema.type === "object" &&
      (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    )
      throw new Error("Expected a JSON object");
    if (["integer", "number"].includes(schema.type ?? "")) {
      if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value))
        throw new Error("Expected a JSON number");
      if (schema.type === "integer" && !/^-?(?:0|[1-9]\d*)$/.test(value))
        throw new Error("Expected an integer");
    }
    return parsed;
  }
  return value;
}

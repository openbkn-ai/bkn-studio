/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type SchemaPropertyRow = {
  key: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
};

export function extractSchemaProperties(schema: unknown): SchemaPropertyRow[] {
  if (!schema || typeof schema !== "object") {
    return [];
  }

  const record = schema as Record<string, unknown>;
  const properties = record.properties;

  if (!properties || typeof properties !== "object") {
    return [];
  }

  const requiredSet = new Set(
    Array.isArray(record.required)
      ? record.required.filter((item): item is string => typeof item === "string")
      : [],
  );

  return Object.entries(properties as Record<string, unknown>).map(([name, definition]) => {
    const def =
      definition && typeof definition === "object" ? (definition as Record<string, unknown>) : {};
    const typeValue = def.type;
    const type =
      typeof typeValue === "string"
        ? typeValue
        : Array.isArray(typeValue)
          ? typeValue.join(" | ")
          : "-";

    return {
      key: name,
      name,
      type,
      required: requiredSet.has(name),
      description: typeof def.description === "string" ? def.description : undefined,
    };
  });
}

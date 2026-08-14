/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";

const BUILD_KEY_TYPES = new Set([
  "integer",
  "unsigned integer",
  "string",
  "date",
  "datetime",
  "timestamp",
]);

export function isBuildKeyField(field: ResourceSchemaField): boolean {
  return BUILD_KEY_TYPES.has(field.type.trim().toLowerCase());
}

export function invalidBuildKeyFields(
  schema: ResourceSchemaField[],
  buildKeyFields: string[],
): string[] {
  const fieldsByName = new Map(schema.map((field) => [field.name, field]));
  return buildKeyFields.filter((name) => !fieldsByName.get(name) || !isBuildKeyField(fieldsByName.get(name)!));
}

export function unsupportedSchemaFields(schema: ResourceSchemaField[]): ResourceSchemaField[] {
  return schema.filter((field) => field.type.trim().toLowerCase() === "other");
}

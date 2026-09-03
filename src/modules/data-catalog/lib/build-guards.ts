/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";

const PRIMARY_KEY_TYPES = new Set([
  "integer",
  "unsigned integer",
  "string",
]);

const INCREMENTAL_FIELD_TYPES = new Set([
  ...PRIMARY_KEY_TYPES,
  "date",
  "time",
  "datetime",
  "timestamp",
]);

export function isPrimaryKeyField(field: ResourceSchemaField): boolean {
  return PRIMARY_KEY_TYPES.has(field.type.trim().toLowerCase());
}

export function isIncrementalField(field: ResourceSchemaField): boolean {
  return INCREMENTAL_FIELD_TYPES.has(field.type.trim().toLowerCase());
}

export function invalidKeyFields(
  schema: ResourceSchemaField[],
  keyFields: string[],
  isSupported: (field: ResourceSchemaField) => boolean,
): string[] {
  const fieldsByName = new Map(schema.map((field) => [field.name, field]));
  return keyFields.filter((name) => !fieldsByName.get(name) || !isSupported(fieldsByName.get(name)!));
}

export function unsupportedSchemaFields(schema: ResourceSchemaField[]): ResourceSchemaField[] {
  return schema.filter((field) => field.type.trim().toLowerCase() === "other");
}

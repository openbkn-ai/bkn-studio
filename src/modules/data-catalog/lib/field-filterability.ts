/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";

// Unified logical types that can enable filtering; connectors validate physical capabilities.
const FILTERABLE_FIELD_TYPES = new Set([
  "integer",
  "unsigned integer",
  "large_integer",
  "float",
  "decimal",
  "string",
  "text",
  "date",
  "time",
  "datetime",
  "timestamp",
  "boolean",
  "vector",
]);

export function canEnableFieldFiltering(type: string): boolean {
  return FILTERABLE_FIELD_TYPES.has(type);
}

export function findUnsupportedFilterableField(schema: readonly ResourceSchemaField[]) {
  return schema.find((field) => field.filterable === true && !canEnableFieldFiltering(field.type));
}

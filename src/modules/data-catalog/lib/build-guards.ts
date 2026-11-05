/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  CatalogResource,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";

const PRIMARY_KEY_TYPES = new Set(["integer", "unsigned integer", "string"]);

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
  return keyFields.filter(
    (name) => !fieldsByName.get(name) || !isSupported(fieldsByName.get(name)!),
  );
}

export function excludedBuildSchemaFields(schema: ResourceSchemaField[]): ResourceSchemaField[] {
  return schema.filter((field) => {
    const type = field.type.trim().toLowerCase();
    return type === "binary" || type === "other";
  });
}

/** Checks declarations only; every actual Decimal value is validated by the build worker. */
export function decimalBuildSchemaIssues(
  resource: Pick<CatalogResource, "schema" | "sourceMetadata">,
): ResourceSchemaField[] {
  const columns = new Map(resource.sourceMetadata?.columns?.map((column) => [column.name, column]));
  return resource.schema.filter((field) => {
    if (field.type.trim().toLowerCase() !== "decimal") return false;
    const column = columns.get(field.originalName ?? "");
    let precision: unknown;
    let scale: unknown;
    if (column && column.numPrecision > 0) {
      precision = column.numPrecision;
      scale = column.numScale;
    } else if (
      field.attributes &&
      ("precision" in field.attributes || "scale" in field.attributes)
    ) {
      precision = field.attributes.precision;
      scale = field.attributes.scale;
    } else {
      const match = field.originalType?.match(
        /^\s*(?:decimal|numeric|number|dec|fixed)\s*\(\s*([0-9]+)\s*,\s*(-?[0-9]+)\s*\)(?:\s+unsigned)?\s*$/i,
      );
      precision = match ? Number(match[1]) : undefined;
      scale = match ? Number(match[2]) : undefined;
    }
    return (
      typeof precision !== "number" ||
      !Number.isSafeInteger(precision) ||
      precision < 1 ||
      typeof scale !== "number" ||
      !Number.isSafeInteger(scale) ||
      scale < -2147483648 ||
      scale > 308
    );
  });
}

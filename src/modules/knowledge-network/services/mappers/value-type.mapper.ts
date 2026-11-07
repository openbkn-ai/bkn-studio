/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ValueType,
  ValueTypeBaseType,
  ValueTypeEnumItem,
  ValueTypeInput,
  ValueTypeReference,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { BackendValueType } from "@/modules/knowledge-network/services/mappers/backend-types";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";

export const VALUE_TYPE_BASE_TYPES: readonly ValueTypeBaseType[] = [
  "string",
  "keyword",
  "integer",
  "unsigned integer",
  "float",
  "decimal",
  "date",
  "datetime",
  "timestamp",
];

const isBaseType = (value: unknown): value is ValueTypeBaseType =>
  typeof value === "string" && (VALUE_TYPE_BASE_TYPES as readonly string[]).includes(value);

function readBounds<T extends number | string>(
  value: { max?: unknown; min?: unknown } | null | undefined,
  read: (bound: unknown) => T | undefined,
) {
  if (!value) {
    return undefined;
  }
  const min = read(value.min);
  const max = read(value.max);
  return min === undefined && max === undefined
    ? undefined
    : { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

const readRangeBound = (bound: unknown) =>
  typeof bound === "number" || (typeof bound === "string" && bound !== "") ? bound : undefined;

const readLengthBound = (bound: unknown) =>
  typeof bound === "number" && Number.isInteger(bound) ? bound : undefined;

export function mapValueType(item: BackendValueType): ValueType {
  const enumItems = (item.enum ?? []).map((entry): ValueTypeEnumItem => ({
    ...(entry.deprecated ? { deprecated: true } : {}),
    ...(entry.description ? { description: entry.description } : {}),
    display: entry.display ?? "",
    value: entry.value ?? "",
  }));
  const range = readBounds(item.range, readRangeBound);
  const length = readBounds(item.length, readLengthBound);

  return {
    // An unknown base type is shown as the backend names it; nothing in Studio offers it.
    baseType: (isBaseType(item.base_type)
      ? item.base_type
      : (item.base_type ?? "string")) as ValueTypeBaseType,
    ...(item.color ? { color: item.color } : {}),
    description: item.comment ?? "",
    ...(enumItems.length ? { enum: enumItems } : {}),
    ...(item.icon ? { icon: item.icon } : {}),
    id: item.id,
    ...(length ? { length } : {}),
    name: item.name ?? item.id,
    ...(item.pattern ? { pattern: item.pattern } : {}),
    ...(range ? { range } : {}),
    tags: item.tags ?? [],
    ...(item.unit ? { unit: item.unit } : {}),
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

/** The value type as a create or update sends it. An update replaces it whole. */
export function toBackendValueTypeInput(input: ValueTypeInput): Record<string, unknown> {
  return {
    base_type: input.baseType,
    ...(input.color ? { color: input.color } : {}),
    comment: input.description,
    ...(input.enum?.length
      ? {
          enum: input.enum.map((item) => ({
            ...(item.deprecated ? { deprecated: true } : {}),
            ...(item.description ? { description: item.description } : {}),
            display: item.display,
            value: item.value,
          })),
        }
      : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.id ? { id: input.id } : {}),
    ...(input.length ? { length: input.length } : {}),
    name: input.name,
    ...(input.pattern ? { pattern: input.pattern } : {}),
    ...(input.range ? { range: input.range } : {}),
    tags: input.tags,
    ...(input.unit ? { unit: input.unit } : {}),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Reads `error_details.references` of a `ValueType.Referenced` refusal. */
export function parseValueTypeReferences(details: unknown): ValueTypeReference[] {
  const references = isRecord(details) ? details.references : undefined;
  return (Array.isArray(references) ? references : []).filter(isRecord).flatMap((entry) => {
    const objectTypeId = text(entry.object_type_id);
    const property = text(entry.property);
    return objectTypeId && property
      ? [
          {
            objectTypeId,
            objectTypeName: text(entry.object_type_name) || objectTypeId,
            property,
            propertyType: text(entry.property_type),
          },
        ]
      : [];
  });
}

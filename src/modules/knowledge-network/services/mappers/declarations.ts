/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  DeclarationPassthroughValue,
  PropertyConstraints,
  PropertyDeclarations,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { BackendDataProperty } from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  areDeclarationValuesEqual,
  isPropertyCrs,
  isPropertySemantic,
  normalizeConstraints,
  normalizeDeclarations,
} from "@/modules/knowledge-network/utils/property-declarations";

const KNOWN_CONSTRAINT_KEYS = new Set([
  "crs",
  "length",
  "pattern",
  "range",
  "timezone",
  "unique",
  "unit",
  "value_type",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function readBound(value: unknown): number | string | undefined {
  return typeof value === "number" || (typeof value === "string" && value !== "")
    ? value
    : undefined;
}

function readCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

/**
 * Reads `constraints` as the backend sends them. A key this release does not know, or a known
 * key in a shape it does not read, goes to `passthrough` and is written back unchanged.
 */
export function mapPropertyConstraints(value: unknown): PropertyConstraints | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const constraints: PropertyConstraints = {};
  const passthrough: Record<string, DeclarationPassthroughValue> = {};

  Object.entries(value).forEach(([key, item]) => {
    if (item === null || item === undefined) {
      return;
    }
    // JSON from the backend: never a function, a symbol or undefined.
    const json = item as DeclarationPassthroughValue;
    if (!KNOWN_CONSTRAINT_KEYS.has(key)) {
      passthrough[key] = json;
      return;
    }
    switch (key) {
      case "value_type":
      case "pattern":
      case "unit":
      case "timezone":
        if (typeof item === "string") {
          const field = key === "value_type" ? "valueType" : key;
          constraints[field] = item;
          return;
        }
        break;
      case "unique":
        if (typeof item === "boolean") {
          constraints.unique = item;
          return;
        }
        break;
      case "crs":
        if (isPropertyCrs(item)) {
          constraints.crs = item;
          return;
        }
        break;
      case "range":
        if (isRecord(item)) {
          const min = readBound(item.min);
          const max = readBound(item.max);
          if ((item.min == null || min !== undefined) && (item.max == null || max !== undefined)) {
            constraints.range = { max, min };
            return;
          }
        }
        break;
      case "length":
        if (isRecord(item)) {
          const min = readCount(item.min);
          const max = readCount(item.max);
          if ((item.min == null || min !== undefined) && (item.max == null || max !== undefined)) {
            constraints.length = { max, min };
            return;
          }
        }
        break;
    }
    passthrough[key] = json;
  });

  if (Object.keys(passthrough).length) {
    constraints.passthrough = passthrough;
  }
  return normalizeConstraints(constraints);
}

/** Reads a data property's declarations; a property that makes none has none. */
export function mapPropertyDeclarations(
  item: BackendDataProperty,
): PropertyDeclarations | undefined {
  return normalizeDeclarations({
    aliases: Array.isArray(item.aliases)
      ? item.aliases.filter((alias): alias is string => typeof alias === "string")
      : undefined,
    constraints: mapPropertyConstraints(item.constraints),
    required: item.required === true,
    semantic: isPropertySemantic(item.semantic) ? item.semantic : undefined,
  });
}

function boundsToBackend<T>(range: { max?: T; min?: T }) {
  return {
    ...(range.min !== undefined ? { min: range.min } : {}),
    ...(range.max !== undefined ? { max: range.max } : {}),
  };
}

/** Writes `constraints` the way the backend reads them, keys it does not know included. */
export function toBackendPropertyConstraints(
  constraints: PropertyConstraints,
): Record<string, unknown> {
  return {
    ...constraints.passthrough,
    ...(constraints.valueType ? { value_type: constraints.valueType } : {}),
    ...(constraints.range ? { range: boundsToBackend(constraints.range) } : {}),
    ...(constraints.length ? { length: boundsToBackend(constraints.length) } : {}),
    ...(constraints.pattern ? { pattern: constraints.pattern } : {}),
    ...(constraints.unit ? { unit: constraints.unit } : {}),
    ...(constraints.unique ? { unique: true } : {}),
    ...(constraints.crs ? { crs: constraints.crs } : {}),
    ...(constraints.timezone ? { timezone: constraints.timezone } : {}),
  };
}

/**
 * The fields a save sends for the declarations of one definition, against what it had when it was
 * read: nothing for a field that did not change, the current value for one that did (lists and
 * objects whole), and null for one the user cleared.
 */
export function declarationPatch<T extends object>(
  current: T | undefined,
  baseline: T | undefined,
  fields: readonly (keyof T)[],
  toBackend: (field: keyof T, value: NonNullable<T[keyof T]>) => [string, unknown],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  fields.forEach((field) => {
    const value = current?.[field];
    const before = baseline?.[field];
    if (areDeclarationValuesEqual(value, before)) {
      return;
    }
    if (value === undefined || value === null) {
      const [key] = toBackend(field, before as NonNullable<T[keyof T]>);
      patch[key] = null;
      return;
    }
    const [key, backendValue] = toBackend(field, value);
    patch[key] = backendValue;
  });
  return patch;
}

const PROPERTY_DECLARATION_FIELDS = ["aliases", "constraints", "required", "semantic"] as const;

/**
 * The declaration fields a data property sends. A primary key never sends `required`: it is
 * required by definition, and the backend refuses false or null on it.
 */
export function propertyDeclarationPatch(
  current: PropertyDeclarations | undefined,
  baseline: PropertyDeclarations | undefined,
  options: { primaryKey: boolean },
): Pick<BackendDataProperty, "aliases" | "constraints" | "required" | "semantic"> {
  const fields = options.primaryKey
    ? PROPERTY_DECLARATION_FIELDS.filter((field) => field !== "required")
    : PROPERTY_DECLARATION_FIELDS;

  return declarationPatch(
    normalizeDeclarations(current),
    normalizeDeclarations(baseline),
    fields,
    (field, value) =>
      field === "constraints"
        ? ["constraints", toBackendPropertyConstraints(value as PropertyConstraints)]
        : [field, value],
  );
}

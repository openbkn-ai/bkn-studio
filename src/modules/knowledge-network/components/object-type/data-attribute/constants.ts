/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/knowledge-network";

export const PRIMARY_KEY_TYPES = ["integer", "unsigned integer", "string", "text"] as const;

export const INCREMENTAL_KEY_TYPES = [
  "integer",
  "unsigned integer",
  "datetime",
  "timestamp",
] as const;

export const DISPLAY_KEY_TYPES = [
  "integer",
  "unsigned integer",
  "string",
  "text",
  "float",
  "decimal",
  "date",
  "time",
  "datetime",
  "timestamp",
  "ip",
  "boolean",
] as const;

export const DATA_PROPERTY_TYPES = [
  "string",
  "text",
  "integer",
  "unsigned integer",
  "float",
  "decimal",
  "date",
  "time",
  "datetime",
  "timestamp",
  "ip",
  "boolean",
  "binary",
  "json",
  "point",
  "shape",
  "vector",
  "other",
] as const;

export const canBePrimaryKey = (type?: string) =>
  !!type && (PRIMARY_KEY_TYPES as readonly string[]).includes(type);

export const canBeDisplayKey = (type?: string) =>
  !!type && (DISPLAY_KEY_TYPES as readonly string[]).includes(type);

export const canBeIncrementalKey = (type?: string) =>
  !!type && (INCREMENTAL_KEY_TYPES as readonly string[]).includes(type);

export const DATA_PROPERTY_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export type ObjectTypeDataPropertyValidationResult =
  | {
      messageKey: string;
      valid: false;
    }
  | {
      valid: true;
      value: ObjectTypeDataProperty[];
    };

export function validateObjectTypeDataProperties(
  properties: ObjectTypeDataProperty[],
): ObjectTypeDataPropertyValidationResult {
  const validProperties = properties.filter(
    (item) => item.name.trim() && item.displayName.trim(),
  );

  if (validProperties.length === 0) {
    return { messageKey: "objectTypeDataPropertyRequired", valid: false };
  }

  const invalidProperty = validProperties.find(
    (item) => !DATA_PROPERTY_NAME_PATTERN.test(item.name),
  );
  if (invalidProperty) {
    return { messageKey: "objectTypeIdPattern", valid: false };
  }

  if (!validProperties.some((item) => item.primaryKey)) {
    return { messageKey: "objectTypePrimaryKeyRequired", valid: false };
  }

  if (!validProperties.some((item) => item.displayKey)) {
    return { messageKey: "objectTypeDisplayKeyRequired", valid: false };
  }

  return {
    valid: true,
    value: validProperties.map((item) => ({
      ...item,
      displayName: item.displayName.trim(),
      name: item.name.trim(),
    })),
  };
}

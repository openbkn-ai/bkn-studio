/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropertyLengthRange, PropertyValueRange } from "./declarations";

/** The types a value type can be based on (BKN spec 3.0 §16). */
export type ValueTypeBaseType =
  | "date"
  | "datetime"
  | "decimal"
  | "float"
  | "integer"
  | "keyword"
  | "string"
  | "timestamp"
  | "unsigned integer";

export type ValueTypeEnumItem = {
  deprecated?: boolean;
  description?: string;
  display: string;
  /** The stored value, as text whatever the base type. */
  value: string;
};

/** What a value type's rules amount to, for the list: shown as a tag. */
export type ValueTypeKind = "enum" | "format" | "range" | "unit";

/** The fields a value type is created or updated with. */
export type ValueTypeInput = {
  baseType: ValueTypeBaseType;
  color?: string;
  description: string;
  enum?: ValueTypeEnumItem[];
  icon?: string;
  id?: string;
  length?: PropertyLengthRange;
  name: string;
  pattern?: string;
  range?: PropertyValueRange;
  tags: string[];
  unit?: string;
};

/** A named set of value rules of a network, shared by the data properties that name it. */
export type ValueType = ValueTypeInput & {
  id: string;
  updateTime: string;
  updaterName: string;
};

/** A data property that names a value type, as a refused delete or update lists it. */
export type ValueTypeReference = {
  objectTypeId: string;
  objectTypeName: string;
  property: string;
  propertyType: string;
};

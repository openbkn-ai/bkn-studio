/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { VALUE_TYPE_BASE_TYPES } from "@/modules/knowledge-network/services/mappers/value-type.mapper";
import type {
  ValueType,
  ValueTypeBaseType,
  ValueTypeEnumItem,
  ValueTypeInput,
} from "@/modules/knowledge-network/types/knowledge-network";
import { constraintFieldsForType } from "@/modules/knowledge-network/utils/property-declarations";

type RuleMode = "enum" | "rules";

export type ValueTypeFormValues = {
  baseType: ValueTypeBaseType;
  description?: string;
  enum?: ValueTypeEnumItem[];
  id?: string;
  length?: { max?: number | null; min?: number | null };
  name: string;
  pattern?: string;
  range?: { max?: number | string | null; min?: number | string | null };
  ruleMode: RuleMode;
  tags?: string[];
  unit?: string;
};

export function toFormValues(
  valueType: ValueType | undefined,
  baseType: ValueTypeBaseType,
): ValueTypeFormValues {
  if (!valueType) {
    return { baseType, description: "", enum: [], name: "", ruleMode: "rules", tags: [] };
  }
  return {
    baseType: valueType.baseType,
    description: valueType.description,
    enum: valueType.enum?.map((item) => ({ ...item })) ?? [],
    id: valueType.id,
    length: valueType.length ? { ...valueType.length } : undefined,
    name: valueType.name,
    pattern: valueType.pattern,
    range: valueType.range ? { ...valueType.range } : undefined,
    ruleMode: valueType.enum?.length ? "enum" : "rules",
    tags: [...valueType.tags],
    unit: valueType.unit,
  };
}

function presentBounds<T extends number | string>(range?: {
  max?: T | null;
  min?: T | null;
}): { max?: T; min?: T } | undefined {
  const min = range?.min ?? undefined;
  const max = range?.max ?? undefined;
  const isSet = (bound?: T) => bound !== undefined && bound !== "";
  if (!isSet(min) && !isSet(max)) {
    return undefined;
  }
  return { ...(isSet(min) ? { min } : {}), ...(isSet(max) ? { max } : {}) };
}

/** The value type the form describes; rules the base type does not take are left out. */
export function toInput(values: ValueTypeFormValues, kept?: ValueType): ValueTypeInput {
  const fields = constraintFieldsForType(values.baseType);
  const unit = fields.unit ? values.unit?.trim() || undefined : undefined;
  const common = {
    baseType: values.baseType,
    color: kept?.color,
    description: values.description?.trim() ?? "",
    icon: kept?.icon,
    ...(kept ? {} : values.id?.trim() ? { id: values.id.trim() } : {}),
    name: values.name.trim(),
    tags: values.tags ?? [],
    unit,
  };

  if (values.ruleMode === "enum") {
    return {
      ...common,
      enum: (values.enum ?? []).map((item) => ({
        ...(item.deprecated ? { deprecated: true } : {}),
        ...(item.description?.trim() ? { description: item.description.trim() } : {}),
        display: item.display.trim(),
        value: item.value.trim(),
      })),
    };
  }

  return {
    ...common,
    length: fields.length ? presentBounds(values.length) : undefined,
    pattern: fields.pattern ? values.pattern || undefined : undefined,
    range: fields.range ? presentBounds(values.range) : undefined,
  };
}

export const isBaseType = (value?: string): value is ValueTypeBaseType =>
  Boolean(value) && (VALUE_TYPE_BASE_TYPES as readonly string[]).includes(value!);

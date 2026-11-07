/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type {
  PropertyLengthRange,
  PropertyValueRange,
  ValueType,
} from "@/modules/knowledge-network/types/knowledge-network";

const PREFIX = "knowledgeNetwork.valueTypes";

/** A closed interval as a short text: `≥ 0`, `≤ 100` or `0 – 100`. */
export function formatBounds(range: PropertyLengthRange | PropertyValueRange) {
  const { max, min } = range;
  if (min !== undefined && max !== undefined) {
    return min === max ? String(min) : `${min} – ${max}`;
  }
  if (min !== undefined) {
    return `≥ ${min}`;
  }
  return max !== undefined ? `≤ ${max}` : "";
}

/** The rules of a value type as short phrases, such as `Range ≥ 0` and `Unit CNY`. */
export function describeValueTypeRules(
  valueType: Pick<ValueType, "enum" | "length" | "pattern" | "range" | "unit">,
  t: TFunction,
): string[] {
  const parts: string[] = [];
  if (valueType.enum?.length) {
    parts.push(t(`${PREFIX}.summary.enum`, { count: valueType.enum.length }));
  }
  if (valueType.range) {
    parts.push(t(`${PREFIX}.summary.range`, { range: formatBounds(valueType.range) }));
  }
  if (valueType.length) {
    parts.push(t(`${PREFIX}.summary.length`, { range: formatBounds(valueType.length) }));
  }
  if (valueType.pattern) {
    parts.push(t(`${PREFIX}.summary.pattern`, { pattern: valueType.pattern }));
  }
  if (valueType.unit) {
    parts.push(t(`${PREFIX}.summary.unit`, { unit: valueType.unit }));
  }
  return parts;
}

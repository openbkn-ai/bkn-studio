/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectMetricConditionV1,
  ObjectMetricDerivedSpecV1,
  ObjectMetricOperandV1,
  ObjectMetricPropertyRefV1,
} from "@/modules/knowledge-network/types/object-metric";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";

const comparisonNames: Record<string, string> = {
  get after() {
    return objectMetricText("m05bf631daf34");
  },
  get after_or_equal() {
    return objectMetricText("m20e88f66687e");
  },
  get before() {
    return objectMetricText("mac3abc8a1900");
  },
  get before_or_equal() {
    return objectMetricText("m10981edc118a");
  },
  get between() {
    return objectMetricText("m2805cdf0df59");
  },
  get contains() {
    return objectMetricText("m107319b8b39d");
  },
  get ends_with() {
    return objectMetricText("me3131c75602a");
  },
  get eq() {
    return objectMetricText("m4bc69a0562ff");
  },
  get gt() {
    return objectMetricText("mb4614ab230a5");
  },
  get gte() {
    return objectMetricText("me1feef07d1b8");
  },
  get in() {
    return objectMetricText("m541d9758ac8d");
  },
  get is_empty() {
    return objectMetricText("m6f0db35f5cdb");
  },
  get is_false() {
    return objectMetricText("m0461a3b64d46");
  },
  get is_not_empty() {
    return objectMetricText("m1a160efcb337");
  },
  get is_not_null() {
    return objectMetricText("m35a1640c0161");
  },
  get is_null() {
    return objectMetricText("m56f9835c2cd7");
  },
  get is_true() {
    return objectMetricText("m463fb81cc157");
  },
  get lt() {
    return objectMetricText("ma39accd3595f");
  },
  get lte() {
    return objectMetricText("m035d78382d6f");
  },
  get neq() {
    return objectMetricText("m9678e3a7cb3c");
  },
  get not_between() {
    return objectMetricText("mbd1d591a5fe0");
  },
  get not_contains() {
    return objectMetricText("m5f60ffcf600a");
  },
  get not_in() {
    return objectMetricText("m346b5503cd87");
  },
  get starts_with() {
    return objectMetricText("mf35b23dcbbae");
  },
};

type PropertyLabel = (reference: ObjectMetricPropertyRefV1) => string;

function operandLabel(operand: ObjectMetricOperandV1, propertyLabel?: PropertyLabel) {
  if (operand.source === "property")
    return propertyLabel?.(operand.property_ref) ?? operand.property_ref.property_name;
  if (typeof operand.value === "string") return `“${operand.value}”`;
  if (typeof operand.value === "number") return String(operand.value);
  if (typeof operand.value === "boolean")
    return operand.value ? objectMetricText("mb5141d3d19e9") : objectMetricText("m0c70665b6eb6");
  return "—";
}

export function objectMetricConditionLabel(
  condition: ObjectMetricConditionV1,
  propertyLabel?: PropertyLabel,
): string {
  if (condition.node_type === "predicate") {
    const right =
      condition.right?.map((item) => operandLabel(item, propertyLabel)).join("、") ?? "";
    return `${operandLabel(condition.left, propertyLabel)} ${comparisonNames[condition.comparison_operator] ?? condition.comparison_operator}${right ? ` ${right}` : ""}`;
  }
  const operator = {
    and: objectMetricText("m8913b8b6e1ef"),
    not: objectMetricText("m432b6e3d4bd1"),
    or: objectMetricText("m5b7bbecff860"),
  }[condition.boolean_operator];
  const children = condition.children.map((child) =>
    objectMetricConditionLabel(child, propertyLabel),
  );
  return condition.boolean_operator === "not"
    ? `${operator}（${children[0] ?? ""}）`
    : `（${children.join(` ${operator} `)}）`;
}

export function objectMetricBusinessConditionLabel(
  qualifiers: ObjectMetricDerivedSpecV1["business_qualifiers"],
  propertyLabel?: PropertyLabel,
): string {
  const current = qualifiers.filters
    ? objectMetricText("mba4ee53e00b2", {
        p0: objectMetricConditionLabel(qualifiers.filters, propertyLabel),
      })
    : undefined;
  const related = qualifiers.relation_path?.related_filters
    ? objectMetricText("m640445bff828", {
        p0: objectMetricConditionLabel(qualifiers.relation_path.related_filters, propertyLabel),
      })
    : undefined;
  return [current, related].filter(Boolean).join("；") || objectMetricText("m439992fad3a5");
}

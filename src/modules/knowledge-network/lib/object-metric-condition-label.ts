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
} from "@/modules/knowledge-network/types/object-metric";

const comparisonNames: Record<string, string> = {
  after: "晚于",
  after_or_equal: "不早于",
  before: "早于",
  before_or_equal: "不晚于",
  between: "介于",
  contains: "包含",
  ends_with: "结尾是",
  eq: "等于",
  gt: "大于",
  gte: "大于等于",
  in: "属于",
  is_empty: "为空",
  is_false: "为假",
  is_not_empty: "不为空",
  is_not_null: "不是空值",
  is_null: "是空值",
  is_true: "为真",
  lt: "小于",
  lte: "小于等于",
  neq: "不等于",
  not_between: "不介于",
  not_contains: "不包含",
  not_in: "不属于",
  starts_with: "开头是",
};

function operandLabel(operand: ObjectMetricOperandV1) {
  if (operand.source === "property") return operand.property_ref.property_name;
  if (typeof operand.value === "string") return `“${operand.value}”`;
  if (typeof operand.value === "number") return String(operand.value);
  if (typeof operand.value === "boolean") return operand.value ? "是" : "否";
  return "—";
}

export function objectMetricConditionLabel(condition: ObjectMetricConditionV1): string {
  if (condition.node_type === "predicate") {
    const right = condition.right?.map(operandLabel).join("、") ?? "";
    return `${operandLabel(condition.left)} ${comparisonNames[condition.comparison_operator] ?? condition.comparison_operator}${right ? ` ${right}` : ""}`;
  }
  const operator = { and: "并且", not: "不满足", or: "或者" }[condition.boolean_operator];
  const children = condition.children.map(objectMetricConditionLabel);
  return condition.boolean_operator === "not"
    ? `${operator}（${children[0] ?? ""}）`
    : `（${children.join(` ${operator} `)}）`;
}

export function objectMetricBusinessConditionLabel(
  qualifiers: ObjectMetricDerivedSpecV1["business_qualifiers"],
): string {
  const current = qualifiers.filters
    ? `当前实例：${objectMetricConditionLabel(qualifiers.filters)}`
    : undefined;
  const related = qualifiers.relation_path?.related_filters
    ? `关联实例：${objectMetricConditionLabel(qualifiers.relation_path.related_filters)}`
    : undefined;
  return [current, related].filter(Boolean).join("；") || "未限定";
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isMetricLogicProperty } from "@/modules/knowledge-network/lib/object-type-trial-metrics";
import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

export function buildLogicPropertyTrialQuery(logicProperties: ObjectTypeLogicProperty[]): string {
  const labels = logicProperties
    .map((property) => property.displayName.trim() || property.name)
    .filter(Boolean);

  if (labels.length === 0) {
    return "查询选中实例的逻辑属性当前值";
  }

  return `查询选中实例的${labels.join("、")}当前值`;
}

export function buildLogicPropertyTrialAdditionalContext(
  logicProperties: ObjectTypeLogicProperty[],
  instanceIdentities: Array<Record<string, string | number>>,
): string {
  const hasMetric = logicProperties.some(isMetricLogicProperty);
  const propertyNames = logicProperties.map((property) => property.name).join(", ");

  const parts = [
    "对象类详情页实例试算。",
    hasMetric ? "instant=true；metric 型按即时汇总/当前值查询，不输出趋势 step。" : "",
    propertyNames ? `试算属性：${propertyNames}。` : "",
  ];

  if (instanceIdentities.length > 0) {
    parts.push(`实例主键示例：${JSON.stringify(instanceIdentities[0])}。`);
  }

  return parts.filter(Boolean).join("");
}

export function buildLogicPropertyTrialBody(input: {
  instanceIdentities: Array<Record<string, string | number>>;
  knId: string;
  logicProperties: ObjectTypeLogicProperty[];
  objectTypeId: string;
  returnDebug?: boolean;
}) {
  const propertyNames = input.logicProperties.map((property) => property.name);

  const body: Record<string, unknown> = {
    _instance_identities: input.instanceIdentities,
    additional_context: buildLogicPropertyTrialAdditionalContext(
      input.logicProperties,
      input.instanceIdentities,
    ),
    kn_id: input.knId,
    ot_id: input.objectTypeId,
    properties: propertyNames,
    query: buildLogicPropertyTrialQuery(input.logicProperties),
  };

  if (input.returnDebug) {
    body.options = { return_debug: true };
  }

  return body;
}

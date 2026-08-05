/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  KnowledgeNetworkMetricRecord,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

export function isMetricLogicProperty(property: ObjectTypeLogicProperty) {
  return property.type === "metric" || property.dataSource?.type === "metric";
}

/** Instance trials can only run properties that produce a value for one object instance. */
export function filterInstanceTrialLogicProperties(logicProperties: ObjectTypeLogicProperty[]) {
  return logicProperties.filter((property) => !isMetricLogicProperty(property));
}

export function getLogicPropertyBoundMetricIds(logicProperties: ObjectTypeLogicProperty[]) {
  const boundMetricIds = new Set<string>();

  logicProperties.forEach((property) => {
    if (!isMetricLogicProperty(property)) {
      return;
    }

    const metricId = property.dataSource?.id;
    if (metricId) {
      boundMetricIds.add(metricId);
    }
  });

  return boundMetricIds;
}

/** Metrics scoped to the object type that are not bound by any logic property. */
export function filterUnboundMetricsForTrial(
  metrics: KnowledgeNetworkMetricRecord[],
  logicProperties: ObjectTypeLogicProperty[],
) {
  const boundMetricIds = getLogicPropertyBoundMetricIds(logicProperties);
  return metrics.filter((metric) => !boundMetricIds.has(metric.id));
}

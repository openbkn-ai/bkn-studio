/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

export function isMetricLogicProperty(property: ObjectTypeLogicProperty) {
  return property.type === "metric" || property.dataSource?.type === "metric";
}

/**
 * The object-query endpoint evaluates both tool-backed and metric-backed logical properties for
 * each requested instance. Metric properties used to be removed here as a temporary UI guard,
 * even after the query service gained support for object-metric references; that made a successful
 * binding impossible to verify from the object page.
 */
export function filterInstanceTrialLogicProperties(logicProperties: ObjectTypeLogicProperty[]) {
  return logicProperties.filter(
    (property) =>
      property.type === "tool" ||
      property.dataSource?.type === "tool" ||
      isMetricLogicProperty(property),
  );
}

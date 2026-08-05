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

/** Instance trials can only run properties that produce a value for one object instance. */
export function filterInstanceTrialLogicProperties(logicProperties: ObjectTypeLogicProperty[]) {
  return logicProperties.filter((property) => !isMetricLogicProperty(property));
}

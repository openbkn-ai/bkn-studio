/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ObjectTypeDetail,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/object-type";

export function findMetricLogicProperty(
  objectType: Pick<ObjectTypeDetail, "logicProperties"> | null | undefined,
  metricId: string,
): ObjectTypeLogicProperty | undefined {
  return objectType?.logicProperties?.find(
    (property) => property.metricBinding?.metric_ref.metric_id === metricId,
  );
}

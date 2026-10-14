/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricTypeV1 } from "@/modules/knowledge-network/types/object-metric";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

export function resolveSelectedObjectTypeId(
  current: string,
  objects: Array<Pick<KnowledgeNetworkObjectTypeRecord, "id">>,
  records: Array<{ definition: { owner_object_type_id: string } }>,
) {
  if (current && objects.some((item) => item.id === current)) return current;
  const ownersWithMetrics = new Set(
    records.map((record) => record.definition.owner_object_type_id),
  );
  return objects.find((item) => ownersWithMetrics.has(item.id))?.id ?? objects[0]?.id ?? "";
}

type FilterableObjectMetric = {
  definition: {
    code: string;
    metric_type: ObjectMetricTypeV1;
    name: string;
    owner_object_type_id: string;
  };
};

export function filterObjectMetrics<T extends FilterableObjectMetric>(
  records: T[],
  selectedObjectTypeId: string,
  metricType: ObjectMetricTypeV1 | undefined,
  keyword: string,
) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  return records.filter(
    (record) =>
      (!selectedObjectTypeId || record.definition.owner_object_type_id === selectedObjectTypeId) &&
      (!metricType || record.definition.metric_type === metricType) &&
      (!normalizedKeyword ||
        record.definition.name.toLowerCase().includes(normalizedKeyword) ||
        record.definition.code.toLowerCase().includes(normalizedKeyword)),
  );
}

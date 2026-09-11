/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

const METRIC_OBJECT_TYPE_OPERATIONS = ["view_detail", "query_data"];

export function filterMetricObjectTypeOptions(
  objectTypes: KnowledgeNetworkObjectTypeRecord[],
): KnowledgeNetworkObjectTypeRecord[] {
  return objectTypes.filter((objectType) => {
    const operations = new Set(objectType.operations ?? []);
    return METRIC_OBJECT_TYPE_OPERATIONS.every((operation) => operations.has(operation));
  });
}

export function createFallbackObjectTypeOption(objectTypeId: string): KnowledgeNetworkObjectTypeRecord {
  return {
    color: "#2f54eb",
    conceptGroupIds: [],
    conceptGroupNames: [],
    description: "",
    hasIndex: false,
    id: objectTypeId,
    name: objectTypeId,
    tags: [],
    updateTime: "",
    updaterName: "",
  };
}

export function mergeBoundObjectTypeOption(
  objectTypes: KnowledgeNetworkObjectTypeRecord[],
  boundObjectTypeId: string,
  boundObjectType?: KnowledgeNetworkObjectTypeRecord | null,
) {
  const normalizedId = boundObjectTypeId.trim();

  if (!normalizedId || objectTypes.some((item) => item.id === normalizedId)) {
    return objectTypes;
  }

  return [...objectTypes, boundObjectType ?? createFallbackObjectTypeOption(normalizedId)];
}

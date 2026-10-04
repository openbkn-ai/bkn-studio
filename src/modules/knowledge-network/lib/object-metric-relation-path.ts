/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

function relatedObjectTypeId(
  relation: KnowledgeNetworkRelationTypeRecord,
  sourceObjectTypeId: string,
) {
  if (relation.sourceObjectTypeId === sourceObjectTypeId) return relation.targetObjectTypeId;
  if (relation.targetObjectTypeId === sourceObjectTypeId) return relation.sourceObjectTypeId;
  return undefined;
}

export function availableRelationTypesFrom(
  relationTypes: KnowledgeNetworkRelationTypeRecord[],
  sourceObjectTypeId: string,
  previousObjectTypeId?: string,
  previousRelationTypeId?: string,
) {
  return relationTypes.filter((relation) => {
    const targetObjectTypeId = relatedObjectTypeId(relation, sourceObjectTypeId);
    if (!targetObjectTypeId) return false;
    return !(
      previousObjectTypeId &&
      previousRelationTypeId === relation.id &&
      targetObjectTypeId === previousObjectTypeId
    );
  });
}

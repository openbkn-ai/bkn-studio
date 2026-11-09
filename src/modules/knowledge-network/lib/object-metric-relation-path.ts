/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";
import type {
  ObjectMetricDefinitionV1,
  ObjectMetricRelationDirectionV1,
  ObjectMetricRelationStepV1,
} from "@/modules/knowledge-network/types/object-metric";

type ObjectMetricRelationStepInputV1 = Omit<ObjectMetricRelationStepV1, "direction"> & {
  direction: ObjectMetricRelationDirectionV1 | "outgoing" | "incoming";
};

export function normalizeObjectMetricRelationDirectionV1(
  direction: ObjectMetricRelationStepInputV1["direction"],
): ObjectMetricRelationDirectionV1 {
  if (direction === "forward" || direction === "outgoing") return "forward";
  if (direction === "backward" || direction === "incoming") return "backward";
  throw new Error(`Unsupported object metric relation direction: ${String(direction)}`);
}

export function normalizeObjectMetricRelationStepsV1(
  steps: readonly ObjectMetricRelationStepInputV1[],
): ObjectMetricRelationStepV1[] {
  return steps.map((step) => ({
    ...step,
    direction: normalizeObjectMetricRelationDirectionV1(step.direction),
  }));
}

export function normalizeObjectMetricDefinitionRelationDirectionsV1(
  definition: ObjectMetricDefinitionV1,
): ObjectMetricDefinitionV1 {
  if (definition.specification.kind !== "derived") return definition;
  const relationPath = definition.specification.business_qualifiers.relation_path;
  if (!relationPath) return definition;
  const steps = normalizeObjectMetricRelationStepsV1(relationPath.steps);
  return {
    ...definition,
    specification: {
      ...definition.specification,
      business_qualifiers: {
        ...definition.specification.business_qualifiers,
        relation_path: { ...relationPath, steps },
      },
    },
  };
}

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

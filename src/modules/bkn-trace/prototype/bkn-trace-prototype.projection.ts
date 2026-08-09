/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  BknTracePrototypeFixture,
  KnowledgeNetworkProjection,
  TraceOperationSnapshot,
} from "@/modules/bkn-trace/prototype/bkn-trace-prototype.types";

export function getChronologicalOperations(
  fixture: BknTracePrototypeFixture,
): TraceOperationSnapshot[] {
  return [...fixture.interactions.flatMap((interaction) => interaction.operations)]
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}

export function getKnowledgeNetworkProjection(
  fixture: BknTracePrototypeFixture,
): KnowledgeNetworkProjection {
  const operations = getChronologicalOperations(fixture);

  const observedObjects = fixture.objects.flatMap((object) => {
    const objectOperations = operations.filter(
      (operation) => operation.targetObjectId === object.id,
    );
    if (objectOperations.length === 0) return [];

    const binding = objectOperations.some(
      (operation) => operation.tool === "query_object_instance",
    )
      ? "direct-object-query" as const
      : "deterministic-resource-binding" as const;

    return [{
      ...object,
      binding,
      operationIds: objectOperations.map((operation) => operation.id),
    }];
  });

  return {
    observedObjects,
    relations: fixture.relations.map((relation) => ({
      ...relation,
      state: fixture.observedRelationIds.includes(relation.id)
        ? "observed" as const
        : "network-context" as const,
    })),
    explorationCandidateCount: fixture.explorationCandidateCount,
  };
}

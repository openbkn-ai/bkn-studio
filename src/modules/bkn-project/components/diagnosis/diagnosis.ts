/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  Diagnosis,
  DiagnosisSuggestion,
  WritebackProperty,
  WritebackRole,
} from "@/modules/bkn-project/types/diagnosis";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { KnowledgeNetworkPreviewEdge } from "@/modules/knowledge-network/types/knowledge-network";

/**
 * Object types of the draft outside the largest connected block of a ready diagnosis: the islands
 * the graph rings. Empty when there is no ready diagnosis or the model is one block.
 */
export function islandIds(diagnosis: Diagnosis | null, draft: Draft): Set<string> {
  if (diagnosis?.state !== "ready" || diagnosis.components.length < 2) {
    return new Set();
  }
  const known = new Set(draft.items.objectTypes.map((item) => item.id));
  return new Set(
    diagnosis.components
      .slice(1)
      .flat()
      .filter((id) => known.has(id)),
  );
}

/**
 * The relations an open suggestion would add to the graph: a new one between two types of the
 * draft, or a drafted one it would adopt. Nothing for any other suggestion.
 */
export function previewEdges(
  suggestion: DiagnosisSuggestion | null,
  draft: Draft,
): KnowledgeNetworkPreviewEdge[] {
  const apply = suggestion?.status === "open" ? suggestion.apply : null;
  if (!suggestion || !apply) {
    return [];
  }
  const known = new Set(draft.items.objectTypes.map((item) => item.id));
  if (apply.kind === "create_relation") {
    return known.has(apply.source) && known.has(apply.target)
      ? [
          {
            id: `preview:${suggestion.id}`,
            name: apply.name,
            sourceId: apply.source,
            targetId: apply.target,
          },
        ]
      : [];
  }
  if (apply.kind === "adopt_relation") {
    const relation = draft.items.relationTypes.find((item) => item.id === apply.relationTypeId);
    return relation && known.has(relation.source) && known.has(relation.target)
      ? [
          {
            id: relation.id,
            name: relation.name,
            sourceId: relation.source,
            targetId: relation.target,
          },
        ]
      : [];
  }
  return [];
}

/** The two object types a suggestion's field pair belongs to, when it says. */
export function fieldOwners(
  suggestion: DiagnosisSuggestion,
  draft: Draft,
): { source?: string; target?: string } {
  const apply = suggestion.apply;
  if (apply?.kind === "create_relation") {
    return { source: apply.source, target: apply.target };
  }
  if (apply?.kind === "adopt_relation") {
    const relation = draft.items.relationTypes.find((item) => item.id === apply.relationTypeId);
    return relation ? { source: relation.source, target: relation.target } : {};
  }
  if (apply && "objectTypeId" in apply) {
    return { source: apply.objectTypeId };
  }
  return {};
}

/**
 * A field as people know it: its display name on the object type it belongs to, or on the first
 * object type that has it when the owner is not known; else its name.
 */
export function fieldLabel(draft: Draft, objectTypeId: string | undefined, field: string): string {
  const owner = draft.items.objectTypes.find((item) => item.id === objectTypeId);
  const property =
    owner?.properties.find((item) => item.name === field) ??
    draft.items.objectTypes.flatMap((item) => item.properties).find((item) => item.name === field);
  return property?.displayName || field;
}

/** A share as a whole percentage; null when there is nothing to share. */
export function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((100 * part) / total) : null;
}

/** The decision-tracking pattern's roles, in the order they are read. */
export const WRITEBACK_ROLES: readonly WritebackRole[] = [
  "tracked",
  "id",
  "time",
  "actor",
  "decision",
  "snapshot",
  "outcome",
];

/** A write-back object's drafted properties by role, in the pattern's order; empty roles left out. */
export function writebackGroups(
  properties: readonly WritebackProperty[],
): { properties: WritebackProperty[]; role: WritebackRole }[] {
  return WRITEBACK_ROLES.map((role) => ({
    properties: properties.filter((property) => property.role === role),
    role,
  })).filter((group) => group.properties.length > 0);
}

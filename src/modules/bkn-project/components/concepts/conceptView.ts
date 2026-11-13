/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  Concept,
  ConceptVerdict,
  RequirementConceptMatch,
  RequirementMatchTarget,
} from "@/modules/bkn-project/types/concepts";

/** The key prefix of a requirement concept listed on its own: it belongs to the requirement tab. */
export const REQUIREMENT_CONCEPT = "requirement_concepts/";

/** The key prefix of a catalog table's concept before drafting: judged once extracting models it. */
export const TABLE_CONCEPT = "table_concepts/";

/** Whether the concept is one of a table, listed before extracting made it an item. */
export function tableCandidate(concept: Concept) {
  return concept.key.startsWith(TABLE_CONCEPT);
}

/** Whether the concept is one the network already has: read only here. */
export function inNetwork(concept: Concept) {
  return concept.sources.some((source) => source.kind === "network");
}

/** The concepts of the data side: every concept but the requirement concepts listed on their own. */
export function dataConcepts(concepts: readonly Concept[]) {
  return concepts.filter((concept) => !concept.key.startsWith(REQUIREMENT_CONCEPT));
}

/** structured: bound to a table; unstructured: bound to what a knowledge-base extraction writes. */
export type ConceptKind = "structured" | "unstructured";

export function kindOf(concept: Concept): ConceptKind {
  return concept.binding?.kind === "dataset" ? "unstructured" : "structured";
}

/** Where a data-side concept comes from, as the source filter offers it. */
export type ConceptOrigin = "network" | "table" | "knowledgeBase";

export function originOf(concept: Concept): ConceptOrigin {
  if (inNetwork(concept)) {
    return "network";
  }
  return kindOf(concept) === "unstructured" ? "knowledgeBase" : "table";
}

/**
 * Where a concept stands as the page shows it: waiting for a person, confirmed (what was judged
 * part of the model, waiting or not), the network's, left out, or a table's before extracting.
 */
export type ConceptStatus = "pending" | "confirmed" | "network" | "excluded" | "candidate";

export function statusOf(concept: Concept): ConceptStatus {
  if (tableCandidate(concept)) {
    return "candidate";
  }
  if (inNetwork(concept)) {
    return "network";
  }
  if (concept.state === "pending") {
    return "pending";
  }
  return concept.verdict === "none" ? "excluded" : "confirmed";
}

/** The four figures over the data side: what is listed, waits, is confirmed (the network's too), is out. */
export function conceptStats(concepts: readonly Concept[]) {
  const stats = { confirmed: 0, excluded: 0, network: 0, pending: 0, total: concepts.length };
  for (const concept of concepts) {
    const status = statusOf(concept);
    if (status === "pending") {
      stats.pending++;
    } else if (status === "excluded") {
      stats.excluded++;
    } else if (status === "network") {
      stats.network++;
      stats.confirmed++;
    } else if (status === "confirmed") {
      stats.confirmed++;
    }
  }
  return stats;
}

/** Whether the verdict makes the concept an object, which merging takes. */
export function objectVerdict(verdict: ConceptVerdict) {
  return verdict === "object" || verdict === "event";
}

/**
 * The concepts a concept may be merged into: objects of the same kind of data, standing on their
 * own and not left out. A table's object and a knowledge-base extraction's are never merged.
 */
export function mergeTargets(concept: Concept, concepts: readonly Concept[]) {
  return concepts.filter(
    (other) =>
      other.key !== concept.key &&
      objectVerdict(other.verdict) &&
      kindOf(other) === kindOf(concept) &&
      !tableCandidate(other) &&
      statusOf(other) !== "excluded",
  );
}

/** Whether a concept may be merged into another: an object of an extraction, holding none merged. */
export function mergeable(concept: Concept) {
  return (
    objectVerdict(concept.verdict) &&
    !inNetwork(concept) &&
    !tableCandidate(concept) &&
    !concept.merged.length
  );
}

/** Data concepts sorted for the list: structured then unstructured, the network's last in each. */
export function groupedOrder(concepts: readonly Concept[]) {
  const rank = (concept: Concept) =>
    (kindOf(concept) === "unstructured" ? 2 : 0) + (inNetwork(concept) ? 1 : 0);
  return concepts
    .map((concept, index) => ({ concept, index }))
    .sort((a, b) => rank(a.concept) - rank(b.concept) || a.index - b.index)
    .map(({ concept }) => concept);
}

/** The requirement tab's filters. */
export type RequirementFilter =
  "all" | "pending" | "structured" | "unstructured" | "unmatched" | "excluded";

export function requirementShown(filter: RequirementFilter) {
  return (requirement: RequirementConceptMatch) => {
    switch (filter) {
      case "all":
        return true;
      case "pending":
        return requirement.state === "pending";
      case "unmatched":
        return requirement.state === "unmatched";
      case "excluded":
        return requirement.state === "excluded";
      case "structured":
      case "unstructured":
        return (
          (requirement.state === "pending" || requirement.state === "confirmed") &&
          (requirement.match?.binding?.kind === "dataset" ? "unstructured" : "structured") ===
            filter
        );
    }
  };
}

/** The requirement concepts nothing in the data is yet, which the page asks the person to settle. */
export function unmatched(requirements: readonly RequirementConceptMatch[]) {
  return requirements.filter((requirement) => requirement.state === "unmatched");
}

/** What names a data concept in a match: a table's object by its table, any other by its type. */
export function targetOf(concept: Concept): RequirementMatchTarget | null {
  if (concept.item && concept.item.kind !== "object_types") {
    return null;
  }
  if (concept.binding?.kind === "table" && concept.binding.id) {
    return { id: concept.binding.id, kind: "table" };
  }
  return concept.item ? { id: concept.item.id, kind: "object_type" } : null;
}

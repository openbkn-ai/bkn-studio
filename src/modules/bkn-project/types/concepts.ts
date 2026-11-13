/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** What a concept is judged to be. */
export const CONCEPT_VERDICTS = [
  "object",
  "event",
  "property",
  "values",
  "relation",
  "kinetic",
  "none",
] as const;

export type ConceptVerdict = (typeof CONCEPT_VERDICTS)[number];

/** Where a concept stands: no one judged it, in the model, judged but waiting, or judged. */
export const CONCEPT_STATES = ["pending", "blocked", "judged", "in_model"] as const;

export type ConceptState = (typeof CONCEPT_STATES)[number];

/** Why a concept judged as a model item cannot be adopted yet. */
export type ConceptBlocker = "needs_identity" | "end_not_adopted" | "repair";

export type ConceptSource = {
  /**
   * A table, a knowledge-base document, a requirement concept of the specification, or the
   * project's network, for an object or relation type it already has.
   */
  kind: "table" | "document" | "requirement" | "network";
  id: string;
  name: string;
  /** The requirement documents a requirement concept cites. */
  documentIds: string[];
};

/**
 * The data a concept is bound to: a table of the catalogs (structured), or what a knowledge-base
 * extraction writes (unstructured). Concepts bound to different kinds are never merged.
 */
export type ConceptBinding = {
  kind: "table" | "dataset";
  id: string;
  name: string;
};

/** What a requirement concept is matched to, as a match names it. */
export type RequirementMatchTarget = { kind: "table" | "object_type"; id: string };

/** Where a requirement concept stands: matched and waiting, confirmed, unmatched, or left out. */
export type RequirementMatchState = "pending" | "confirmed" | "unmatched" | "excluded";

/**
 * A requirement concept as the concepts page lists it, with the data concept it is matched to. It
 * is never an item of its own.
 */
export type RequirementConceptMatch = {
  id: string;
  term: string;
  category: string;
  definition: string;
  /** The first passage it quotes. */
  quote: string;
  match: {
    key: string;
    name: string;
    binding: ConceptBinding | null;
    /** Names the concept in a match; null for one that is no object. */
    target: RequirementMatchTarget | null;
  } | null;
  /** Why it is matched, or why nothing in the data is it. */
  basis: string;
  /** ai, person, or name when only its term names the concept; empty when unknown. */
  by: string;
  state: RequirementMatchState;
};

export type ConceptItem = {
  kind: "object_types" | "relation_types" | "value_types";
  id: string;
  adopted: boolean;
};

export type Concept = {
  key: string;
  name: string;
  description: string;
  sources: ConceptSource[];
  /** The draft item it is; null for a requirement concept no item is. */
  item: ConceptItem | null;
  suggested: ConceptVerdict;
  /** A code for why it was suggested, such as code_table. */
  suggestedBecause: string;
  verdict: ConceptVerdict;
  reason: string;
  judged: { by: { id: string; type: string }; time: number } | null;
  state: ConceptState;
  blocked: ConceptBlocker | null;
  /** The concepts merged into this one. */
  merged: { key: string; name: string }[];
  /** Its other names: its item's, and the table name of one semantic understanding named. */
  aliases: string[];
  /** Named by semantic understanding, or added or named from Ask AI. */
  ai: boolean;
  /** The data it is bound to; null for a requirement concept, or one added with no source. */
  binding: ConceptBinding | null;
};

export type Concepts = {
  /** 0 without a ready draft: no draft item's concept can be judged then. */
  draftUpdateTime: number;
  /** The specification's update time, 0 without one: its concepts are judged there. */
  requirementUpdateTime: number;
  concepts: Concept[];
  /** By state, and by verdict as `verdict:<verdict>`. */
  counts: Record<string, number>;
  /** The tables semantic understanding has not named yet: their concepts keep the table name. */
  notUnderstood: number;
  /** The requirement concepts, each with the data concept it is matched to. */
  requirements: RequirementConceptMatch[];
};

/** One of the concepts a split makes. */
export type ConceptPart = { description: string; name: string; verdict: ConceptVerdict };

/**
 * A change Ask AI proposes of the concepts, checked by bkn-project against them as they stand.
 * Adopting one records it as the person's decision, which can be changed again.
 */
export type ConceptRevision = { reason: string } & (
  | { field: "define"; value: { description: string; key: string; name: string } }
  | { field: "verdict"; value: { key: string; verdict: ConceptVerdict } }
  | { field: "merge"; value: { into: string; key: string } }
  | { field: "split"; value: { key: string; parts: ConceptPart[] } }
  | { field: "add"; value: { description: string; name: string; verdict: ConceptVerdict } }
  | { field: "aliases"; value: { aliases: string[]; key: string } }
);

/** Ask AI's answer about the concepts, and the changes it proposes. */
export type ConceptAskAnswer = {
  answer: string;
  dropped: { field: string; reason: string }[];
  revisions: ConceptRevision[];
};

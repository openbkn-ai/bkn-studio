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
  /** A table, a knowledge-base document, or a requirement concept of the specification. */
  kind: "table" | "document" | "requirement";
  id: string;
  name: string;
  /** The requirement documents a requirement concept cites. */
  documentIds: string[];
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
};

export type Concepts = {
  /** 0 without a ready draft: no draft item's concept can be judged then. */
  draftUpdateTime: number;
  /** The specification's update time, 0 without one: its concepts are judged there. */
  requirementUpdateTime: number;
  concepts: Concept[];
  /** By state, and by verdict as `verdict:<verdict>`. */
  counts: Record<string, number>;
};

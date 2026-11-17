/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The network diagnosis of a project's concept model: how connected it is, which references and
 * scenario questions it misses, and ranked suggestions to apply or dismiss. bkn-project computes
 * the facts, an AI pass ranks the suggestions; nothing changes the model until a person applies one.
 */

export type DiagnosisState = "running" | "ready" | "failed";

export type DiagnosisMetrics = {
  /** The largest connected block of adopted object types, out of all of them. */
  connectivity: { components: number; largest: number; objects: number };
  /** References whose values match well enough, and how many of them have a relation. */
  references: { covered: number; total: number };
  /** Scenario questions with a path through the model to answer them. */
  reachability: { reachable: number; total: number };
  /** Requirement concepts with no data and no verdict yet. */
  pendingConcepts: number;
};

export type DiagnosisSuggestionKind =
  | "choose_identity"
  | "adopt_object"
  | "adopt_relation"
  | "create_relation"
  | "exclude_object"
  | "writeback_object"
  | "concept_disposition"
  | "data_quality";

export type DiagnosisGroup = "connect" | "object" | "data";

export type DiagnosisSuggestionStatus = "open" | "applied" | "dismissed";

/** What a write-back property is for, in the decision-tracking pattern. */
export type WritebackRole =
  "id" | "tracked" | "time" | "actor" | "decision" | "snapshot" | "outcome";

export type WritebackProperty = {
  displayName: string;
  name: string;
  role: WritebackRole;
  type: string;
};

export type WritebackAction = {
  kind: "add" | "modify";
  name: string;
  /** Property names the action sets. */
  parameters: string[];
};

/** What applying a suggestion does, by its kind. */
export type DiagnosisApply =
  | { kind: "adopt_relation"; relationTypeId: string }
  | {
      cardinality: string;
      description: string;
      kind: "create_relation";
      mapping: { sourceProperty: string; targetProperty: string }[];
      name: string;
      source: string;
      target: string;
    }
  | { kind: "adopt_object"; objectTypeId: string }
  | { candidates: string[][]; kind: "choose_identity"; objectTypeId: string }
  | { kind: "exclude_object"; objectTypeId: string }
  | {
      actions: WritebackAction[];
      description: string;
      kind: "writeback_object";
      name: string;
      properties: WritebackProperty[];
      trackedObjectTypeId: string;
    }
  | {
      conceptId: string;
      disposition: "property" | "kinetic" | "not_ontology";
      kind: "concept_disposition";
      ownerObjectTypeId?: string;
    };

export type DiagnosisEvidence = {
  /** The type value a polymorphic reference is counted for. */
  condition?: { field: string; value: string };
  hits?: number;
  nulls?: number;
  /** Requirement-document passages that call for it. */
  quotes: { documentId: string; text: string }[];
  rate?: number;
  rows?: number;
  sourceField?: string;
  targetField?: string;
};

export type DiagnosisSuggestion = {
  apply: DiagnosisApply | null;
  evidence: DiagnosisEvidence;
  group: DiagnosisGroup;
  id: string;
  /** Object types it connects, and scenario questions it lets the model answer. */
  impact: { connects: string[]; questions: string[] };
  kind: DiagnosisSuggestionKind;
  rank: number;
  reason: string;
  status: DiagnosisSuggestionStatus;
  title: string;
};

export type Diagnosis = {
  /** Adopted object type ids by connected block, the largest first. */
  components: string[][];
  computedAt: number;
  draftUpdateTime: number;
  /** Why it failed, as a key of business wording; empty when it did not. */
  error: string;
  metrics: DiagnosisMetrics | null;
  runId: string;
  /** The draft changed since it was computed. */
  stale: boolean;
  state: DiagnosisState;
  suggestions: DiagnosisSuggestion[];
};

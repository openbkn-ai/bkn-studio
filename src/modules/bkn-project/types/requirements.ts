/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** `prd`, `policy`, `standard` or `other`: it decides which side prevails in a conflict. */
export type RequirementDocType = string;

/** A requirement document the owner uploaded; lists leave out its content. */
export type RequirementDocument = {
  createTime: number;
  docType: RequirementDocType;
  format: string;
  id: string;
  name: string;
  size: number;
  uploaderId: string;
};

/** A part of a document between headings or blank lines, by character offsets. */
export type RequirementBlock = { end: number; heading: string; id: string; start: number };

export type RequirementDocumentContent = RequirementDocument & {
  blocks: RequirementBlock[];
  content: string;
};

/** How one uploaded file went: `created`, `duplicate` or `rejected` with an error code. */
export type UploadResult = { code: string; documentId: string; name: string; outcome: string };

/** A passage of a document an item quotes. */
export type RequirementCitation = {
  blockId: string;
  documentId: string;
  end: number;
  quote: string;
  start: number;
};

/** The kinds of item a person adds, edits and removes, as the routes name them. */
export type RequirementItemKind = "concepts" | "questions" | "rules" | "scenarios";

/** The kinds of item a person accepts or takes back after AI generated them. */
export type ReviewedKind = "questions" | "scenarios";

/** A drafted object type or relation type, by its draft item id. */
export type RequirementItemRef = { id: string; kind: string };

type Cited = {
  citations: RequirementCitation[];
  edited: boolean;
  /** Why an item without a basis in the documents is needed. */
  supplementReason: string;
};

/**
 * Whether a person accepted what AI generated. Items a person added or edited count as accepted;
 * regenerating keeps the accepted ones as they are.
 */
type Reviewed = { accepted: boolean };

export type RequirementScenario = Cited &
  Reviewed & {
    /** One of its questions may no longer fit the ontology. */
    ontologyChanged: boolean;
    actor: string;
    capabilities: { definition: string; kind: string; name: string }[];
    decision: string;
    id: string;
    knowledge: string[];
    name: string;
    trigger: string;
  };

export type RequirementConcept = Cited & {
  /** object, event, property, relation, evidence or not_ontology. */
  category: string;
  definition: string;
  id: string;
  mapsTo: RequirementItemRef | null;
  notOntologyReason: string;
  term: string;
};

/**
 * What a question is asked about: `{name}` in its template stands for a value of the concept's
 * property. `role` is `record` (a given record) or `reference_time` (the moment a window ends).
 */
export type QuestionInput = {
  conceptId: string;
  name: string;
  property: string;
  /** Drafting named no property of the object type, so the server took its one-field key. */
  propertyFromKey?: boolean;
  role: string;
};

export type RequirementQuestion = Cited &
  Reviewed & {
    answerShape: string;
    id: string;
    /**
     * Null when drafted before questions had inputs, or when every input given was dropped: then
     * nothing is said. An empty list: the question is asked about no given value.
     */
    inputs: QuestionInput[] | null;
    /** `knowledge` (the ontology answers it) or `capability` (another team builds what it needs). */
    layer: string;
    needs: RequirementItemRef[];
    /** `concepts` when the needs follow its concepts, `person` when someone set them. */
    needsSource: string;
    /** Computed on read: `capability_without_basis`. */
    notes: string[];
    /**
     * The ontology it needs changed in structure since it was generated or accepted, so it may no
     * longer fit; renaming does not count.
     */
    ontologyChanged: boolean;
    /** The question counts the latest period up to its reference time. */
    relativeWindow: boolean;
    scenarioIds: string[];
    template: string;
    text: string;
    type: string;
  };

export type RequirementRule = Omit<Cited, "supplementReason"> & {
  compilesTo: string;
  id: string;
  statement: string;
};

export type RequirementConflict = {
  deferred: boolean;
  id: string;
  kind: string;
  resolution: {
    byId: string;
    documentId: string;
    reason: string;
    text: string;
    time: number;
  } | null;
  sides: (RequirementCitation & { position: string })[];
  /** The side the order of authority prefers; empty when the sides weigh the same. */
  suggestedDocumentId: string;
  topic: string;
};

export type RequirementChoice = {
  citations: RequirementCitation[];
  decision: { basis: string; byId: string; optionId: string; time: number } | null;
  id: string;
  options: { consequence: string; id: string; label: string }[];
  question: string;
  reason: string;
  recommendedOptionId: string;
};

export type RequirementSpec = {
  catalogsUnlisted: string[];
  choices: RequirementChoice[];
  concepts: RequirementConcept[];
  conflicts: RequirementConflict[];
  questions: RequirementQuestion[];
  /** Drafted items the checks dropped, with why. */
  rejected: { kind: string; reason: string; text: string }[];
  rules: RequirementRule[];
  scenarios: RequirementScenario[];
  tablesOmitted: number;
};

/** The project's requirement specification, rq-n. */
export type Requirements = {
  /** Why drafting failed, as a code. */
  error: string;
  /** Adopted object types no question rests on yet, such as ones adopted since drafting. */
  ontologyUncovered: { id: string; kind: string; name: string }[];
  spec: RequirementSpec;
  /** The documents, their types, the catalogs or the naming language changed since drafting. */
  stale: boolean;
  /** `drafting`, `ready` or `failed`. */
  status: string;
  undecidedChoices: number;
  unresolvedConflicts: number;
  updateTime: number;
  version: number;
};

/** A test question asked in its scenario question's place, checked against the data. */
export type QuestionTest = {
  /** Written by the server from the question's template, not by the Agent. */
  byServer: boolean;
  check: { outcome: string; reason: string };
  edited: boolean;
  /** `exists`, `not_exists` or `same_record`. */
  expect: string;
  id: string;
  /** `template`, `paraphrase`, `boundary`, `not_exist`, `variant`, or empty. */
  kind: string;
  text: string;
};

/** A scenario question's test questions and development guidance. */
export type QuestionDev = {
  /** False once the requirements were drafted again or the question reworded since. */
  current: boolean;
  deletedTests: number;
  error: string;
  /** Markdown. */
  guidance: string;
  leftOutTests: number;
  /** Why no test was written, as the Agent says it. */
  noTestsReason: string;
  /** Whether what the question needs changed in the draft since; null when unknown. */
  ontologyChanged: boolean | null;
  /** Further questions that need more than this one. */
  outOfScope: string[];
  /** `generating`, `ready` or `failed`. */
  status: string;
  tests: QuestionTest[];
  /** A note on the tests as a whole: `inputs_untested`, `none_checkable`; empty when none. */
  testsNote: string;
  updateTime: number;
};

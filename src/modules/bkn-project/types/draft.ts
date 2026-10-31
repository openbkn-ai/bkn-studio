/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ProjectAccount } from "@/modules/bkn-project/types/project";

/**
 * A project's ontology draft, drafted from the tables of its data catalogs. bkn-project
 * owns every rule; the page shows what it answers and never derives adoption itself.
 */
export type DraftStatus = "drafting" | "failed" | "ready";

/** A table of a data catalog, as the draft refers to it. */
export type DraftTable = {
  catalogId: string;
  name: string;
  /** Why the table could not be read; only on unreadable tables. */
  reason?: string;
  resourceId: string;
};

/**
 * How an object type's records are identified, and what counting the key over the full
 * table found. `source` and `reason` are open: unknown values are shown generically.
 */
export type DraftKeyEvidence = {
  /**
   * Two properties drafting counted unique and non-null together, when the counted field had
   * duplicates: the identity it suggests.
   */
  candidate?: string[];
  computed: boolean;
  distinct: number;
  field?: string;
  nulls: number;
  reason?: string;
  rows: number;
  source: string;
};

export type DraftProperty = {
  description: string;
  displayName: string;
  mappedField: string;
  missingDescription: boolean;
  name: string;
  sourceOfRecord: string;
  type: string;
  valueTypeId?: string;
};

export type DraftObjectType = {
  adopted: boolean;
  description: string;
  displayKey: string;
  id: string;
  /**
   * The update field: the property whose value grows whenever a record changes, which the table's
   * local index refreshes by; empty when none is chosen.
   */
  incrementalKey: string;
  key: DraftKeyEvidence;
  name: string;
  needsIdentity: boolean;
  primaryKeys: string[];
  properties: DraftProperty[];
  table: DraftTable;
};

export type DraftFieldMapping = {
  sourceProperty: string;
  targetProperty: string;
};

/** What joining the relation's fields over the full tables found. */
export type DraftJoinEvidence = {
  computed: boolean;
  hitRate: number;
  hits: number;
  nulls: number;
  orphans: number;
  reason?: string;
  rows: number;
  sourceDistinct: number;
};

export type DraftRelationType = {
  adopted: boolean;
  cardinality: string;
  description: string;
  evidence: DraftJoinEvidence;
  id: string;
  linkTable?: DraftTable;
  mapping: DraftFieldMapping[];
  name: string;
  /** foreign_key, name_match, stem_match, link_table or manual; open like the key source. */
  origin: string;
  /** Through a link table: the source's properties to its fields, then its fields to the target's. */
  sourceMapping: DraftFieldMapping[];
  targetMapping: DraftFieldMapping[];
  source: string;
  target: string;
  /** confirmed for a declared foreign key, unconfirmed for an inferred one. */
  verification: string;
};

export type DraftValueType = {
  adopted: boolean;
  baseType: string;
  codeTable: DraftTable;
  description: string;
  id: string;
  name: string;
  usedBy: { objectType: string; property: string }[];
  values: { display: string; value: string }[];
};

/** A field drafting left out of its object type, and why. */
export type DraftExcludedField = {
  field: string;
  keyword?: string;
  objectType: string;
  reason: string;
};

/** A change a person made to the draft; the newest decisions come last. */
export type DraftDecision = {
  action: string;
  after: unknown;
  before: unknown;
  by: ProjectAccount;
  itemId: string;
  kind: string;
  time: number;
};

/** Catalogs being added to a ready draft: their tables are drafted in the background. */
export type DraftAdding = { by: ProjectAccount; catalogIds: string[]; since: number };

export type DraftItems = {
  /** null unless catalogs are being added; the draft stays editable meanwhile. */
  adding: DraftAdding | null;
  decisions: DraftDecision[];
  excluded: DraftExcludedField[];
  objectTypes: DraftObjectType[];
  relationTypes: DraftRelationType[];
  unreadable: DraftTable[];
  valueTypes: DraftValueType[];
};

export type Draft = {
  createTime: number;
  drafter: ProjectAccount;
  /** interrupted, timeout, or vega-backend's reply; only when failed. */
  error: string;
  items: DraftItems;
  projectId: string;
  status: DraftStatus;
  updateTime: number;
};

/** The kinds of draft item a person edits, as bkn-project names them in the path. */
export type DraftItemKind = "object_types" | "relation_types" | "value_types";

/** A person's edit of one draft item; fields left out stay as they are. */
export type DraftItemEdit = {
  adopted?: boolean;
  description?: string;
  /** Object types only; empty clears it. */
  incrementalKey?: string;
  name?: string;
  /** Why an item is left out, with `adopted: false`; up to 200 characters. */
  reason?: string;
};

/**
 * Where a candidate stands: `pending` until a person confirms it, then `adopted` or `excluded`.
 * Adopting or leaving it out, choosing its identity, saving it whole or making it confirm it;
 * renaming or describing it does not.
 */
export type CandidateState = "adopted" | "excluded" | "pending";

/** An object or relation type of the draft, as the list of candidates to confirm shows it. */
export type Candidate = {
  /** The catalog whose adding drafted it; empty for one the draft was made with. */
  addedByCatalog: string;
  adopted: boolean;
  excludeReason: string;
  id: string;
  kind: "object_types" | "relation_types";
  name: string;
  /** What a ready requirement specification needs it for; null when there is none. */
  neededBy: {
    concepts: { id: string; term: string }[];
    questions: { id: string; text: string }[];
  } | null;
  reviewed: { by: ProjectAccount; time: number } | null;
  state: CandidateState;
  /** The table it comes from, and how many rows it has; null when there is none. */
  table: { name: string; rows: number } | null;
};

/** The candidates in the order to confirm them: what requirements need first, then the rest. */
export type Candidates = {
  counts: Record<CandidateState, number>;
  items: Candidate[];
};

/**
 * An object type as a person saves it from the editor, whole: what it is called and describes,
 * its properties and the columns they map, and which identify, name and update its records. A
 * column newly mapped adds a property, an excluded one mapped again restores it, and a property
 * left out is removed.
 */
export type DraftObjectTypeSave = {
  description: string;
  displayKey: string;
  incrementalKey: string;
  name: string;
  primaryKeys: string[];
  properties: {
    description: string;
    displayName: string;
    /** The column it maps; absent for a property that maps none. */
    mappedField?: string;
    name: string;
    type: string;
  }[];
};

/**
 * A relation type as a person saves it from the editor, whole, as bkn-backend's relation type is:
 * its ends, and how they join, directly by properties of each, or through a link table whose
 * fields each end's properties map.
 */
export type DraftRelationTypeSave = {
  description: string;
  /** Through a link table: the table's data resource, and each end's properties to its fields. */
  link?: {
    resourceId: string;
    sourceMapping: DraftFieldMapping[];
    targetMapping: DraftFieldMapping[];
  };
  /** Directly: the source's properties to the target's. */
  mapping: DraftFieldMapping[];
  name: string;
  source: string;
  target: string;
};

/**
 * How one column of a bound table differs from what it maps: `added` (no property maps it),
 * `removed` (its property's column is gone) or `retyped` (now another type).
 */
export type SourceColumnChange = {
  change: string;
  /** For an added column: `privacy` or `unsupported_type` when drafting would leave it out. */
  excluded: string;
  field: string;
  fieldName: string;
  fromType: string;
  /** The object type is identified or displayed by it. */
  key: boolean;
  property: string;
  propertyName: string;
  /** Relation types that join by it. */
  relations: { id: string; name: string }[];
  toType: string;
  /** BKN cannot map the new type. */
  unsupported: boolean;
};

/** What the tables a project binds look like now, against what the draft and the release map. */
export type SourceChanges = {
  missingTables: { id: string; kind: string; name: string; table: string }[];
  objectTypes: {
    changes: SourceColumnChange[];
    id: string;
    /** Drafting the changes applies them; an object type only published is left as it is. */
    inDraft: boolean;
    name: string;
    published: boolean;
    table: string;
  }[];
  /** Adopted relation types whose link table lost fields they join by. */
  relationTypes: { id: string; name: string; removed: string[]; table: string }[];
  /** Stands for the draft and its tables as read; drafting refuses another. */
  signature: string;
  /** `in_step`, `changed` or `unreachable`. */
  state: string;
};

/**
 * A change Ask AI suggests for an object type: its `name` or `description` (`value`), or its
 * `identity` (`properties`), adopted through the edit that changes that field.
 */
export type AskSuggestion = {
  field: string;
  properties: string[];
  reason: string;
  value: string;
};

/** Ask AI's answer about one object type of the draft; nothing is kept between questions. */
export type AskAnswer = { answer: string; suggestion: AskSuggestion | null };

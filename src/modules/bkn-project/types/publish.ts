/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { DraftTable } from "@/modules/bkn-project/types/draft";

/** Where a project stands, as bkn-project computes it for the caller. */
export type ProjectStage =
  | "archived"
  | "check_needs_attention"
  | "check_not_started"
  | "checking"
  | "confirmed"
  | "deciding"
  | "draft_failed"
  | "drafting"
  | "no_draft"
  | "published"
  | "ready_to_confirm";

/** Something that holds the project back, and who has to act on it. */
export type ProjectBlocker = {
  code: string;
  count: number;
  waitingFor: "editor" | "owner" | "system";
};

/** A request the caller may send next, and whether bkn-project would accept it from them. */
export type ProjectNextAction = {
  /** What confirming would have to accept: `partial_draft`, `undecided_items`. */
  accepts: string[];
  action: string;
  allowed: boolean;
  discardsDecisions: number;
  /** Why it is not allowed: `not_owner`, `running`, or a blocker's code. */
  reason?: string;
  retryAfterS?: number;
  /** For reviewing a release: the patch after the lineage's newest release, which may be changed. */
  suggestedVersion?: string;
};

export type ProjectStatus = {
  blockers: ProjectBlocker[];
  /** The check of the last confirmation; `current` when it checked the draft as it is. */
  check: { current: boolean; status: string } | null;
  /** The last confirmation; `current` when the draft has not changed since. */
  confirmation: { current: boolean; time: number } | null;
  draft: { decisions: number; placeholders: number; status: string; updateTime: number } | null;
  nextActions: ProjectNextAction[];
  /** The project's release, once the newest release is its own and came after its confirmation. */
  release: { inUse: boolean; networkId: string; version: string } | null;
  stage: ProjectStage;
  /** `confirmation_outdated`, `check_outdated`. */
  stale: string[];
  undecided: number;
  /** Conflicts between requirement documents no one ruled on, which confirming has to accept. */
  unresolvedConflicts: number;
};

/** An item to decide before confirming, or one left out that nobody decided on. */
export type PendingItem = {
  blocking: boolean;
  /** Why an undecided item was not adopted: `needs_identity`, a `proposed_because`, … */
  because?: string;
  itemId: string;
  kind: string;
  name: string;
  /** `needs_identity`, `unadopted_ends` or `undecided`. */
  reason: string;
};

export type ProjectPending = {
  draftUpdateTime: number;
  items: PendingItem[];
};

export type ConfirmDraftInput = {
  acceptPartial?: boolean;
  acceptUndecided?: boolean;
  /** Confirms although conflicts between the requirement documents are not resolved. */
  acceptUnresolvedConflicts?: boolean;
  updateTime: number;
};

/** How one count of the check went: counted, not counted and why, or failed and why. */
export type CheckCountState = {
  reason?: string;
  state: "counted" | "failed" | "not_counted";
};

export type CheckKeyResult = CheckCountState & {
  duplicates: number;
  fields: string[];
  nulls: number;
  objectType: string;
  rows: number;
};

export type CheckJoinResult = CheckCountState & {
  hitRate: number;
  nulls: number;
  /** The end this join reaches. */
  objectType: string;
  orphans: number;
  rows: number;
};

export type CheckResults = {
  coverage: { counted: number; total: number };
  /** Properties mapped to a field the privacy rules left out. */
  excludedMapped: { field: string; objectType: string; property: string }[];
  keys: CheckKeyResult[];
  relations: { joins: CheckJoinResult[]; relationType: string }[];
};

export type CheckStatus = "failed" | "issues" | "partial" | "passed" | "running";

/** The check of the last confirmation, counted as the person who ran it. */
export type OntologyCheck = {
  attempt: number;
  /** `interrupted` when a restart stopped it. */
  error: string;
  finishTime: number;
  /** Null while the first attempt is still counting. */
  results: CheckResults | null;
  startTime: number;
  status: CheckStatus;
};

export type IndexState =
  "building" | "not_built" | "not_configured" | "ready" | "stale" | "unreadable";

export type IndexBuildOutcome =
  "created" | "existing" | "failed" | "no_config_permission" | "no_permission" | "not_configurable";

/** What the last confirmation, or the last rebuild, did for one table. */
export type IndexBuild = {
  outcome: IndexBuildOutcome;
  /** For `not_configurable`, the keys that could not be given, comma-separated. */
  reason?: string;
  time: number;
};

export type IndexItem = {
  build: IndexBuild | null;
  id: string;
  /** For `not_configured`: `primary_key_fields`, `incremental_fields`. */
  missing: string[];
  name: string;
  state: IndexState;
  table: DraftTable;
  /** A build running for the table; also on a ready index being rebuilt. */
  task: { id: string; status: string } | null;
};

export type ProjectIndex = {
  counts: Record<string, number>;
  objectTypes: IndexItem[];
  /** False when the caller may not list the catalog's build tasks: a build in progress reads as not built. */
  tasksVisible: boolean;
};

export type UnderstandApplyMode = "fill_empty" | "force";

export type UnderstandInput = {
  /** Understand every table again, not only those never understood. */
  all?: boolean;
  applyMode?: UnderstandApplyMode;
};

/** A catalog semantic understanding was asked for; skipped when the owner may not run tasks there. */
export type UnderstandSubmitted = {
  catalogId: string;
  permitted: boolean;
  tables: number;
};

export type UnderstandingStatus =
  "cancelled" | "completed" | "failed" | "not_started" | "pending" | "running";

export type UnderstandingTable = {
  /** Whether the result was written to the table. */
  applied: boolean;
  /** Null until the table is understood. */
  finishTime: number | null;
  name: string;
  resourceId: string;
  status: UnderstandingStatus;
};

export type UnderstandingCatalog = {
  catalogId: string;
  counts: Partial<Record<UnderstandingStatus, number>>;
  tables: UnderstandingTable[];
  /** False when the caller may not see the catalog's tasks: the progress is unknown. */
  visible: boolean;
};

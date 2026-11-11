/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** An object type or relation type a release names. `kind` is `object_type` or `relation_type`. */
export type ReleaseItem = { id: string; kind: string; name: string };

/**
 * One of the seven release checks. `reason` says why it did not pass; `accept`, when set, is what
 * the owner may accept to publish anyway. `details` depend on the check.
 */
export type ReleaseCheck = {
  accept?: string;
  code: string;
  details?: unknown;
  passed: boolean;
  reason?: string;
};

/** A scenario question of the knowledge layer, placed by where what it needs stands. */
export type ReleaseQuestion = {
  id: string;
  /** What the release lacks for it. */
  missing: ReleaseItem[];
  text: string;
  /** Pairs of object types it needs that nothing adopted in the draft joins. */
  unconnected: { from: ReleaseItem; to: ReleaseItem }[];
};

/** A function or Skill the release reuses, or copies to a new id for `reasons`. */
export type ReleaseCapability = {
  copy: boolean;
  id: string;
  kind: string;
  name: string;
  reasons: string[];
};

/** What publishing the project's branch as `version` would bring, and whether it may. */
export type ReleaseReview = {
  /** What the owner must accept for the release to go, of the checks that did not pass. */
  accepts: string[];
  /** A check that cannot be accepted failed, or a refusal stands. */
  blocked: boolean;
  capabilities: ReleaseCapability[];
  changes: { added: ReleaseItem[]; changed: ReleaseItem[]; other: number; removed: ReleaseItem[] };
  checks: ReleaseCheck[];
  questions: {
    affected: ReleaseQuestion[];
    answerableNew: ReleaseQuestion[];
    total: number;
    unanswerable: ReleaseQuestion[];
    /** Questions that name nothing they need. */
    unjudged: number;
  };
  /** Error codes the release itself would be refused with, such as a version already published. */
  refusals: string[];
  release: { baseVersion: string; networkId: string; networkName: string };
  risks: {
    copies: number;
    existing: ReleaseItem[];
    onlyAdditions: boolean;
    orphans: (ReleaseItem & { orphans: number })[];
    /** The kinetic needs linked to no implementation, applications aside; they never block. */
    unimplementedNeeds: { id: string; kind: string; name: string }[];
  };
  /** Stands for what the review was read from; publishing refuses another. */
  signature: string;
  version: string;
};

/** Preparing a release: the review read, what the owner accepts of the checks that did not pass. */
export type PrepareInput = {
  accepts: string[];
  /** Drops edits made to the network that were never published. */
  overwriteDraftChanges: boolean;
  signature: string;
  version: string;
};

/** Publishing the prepared release. */
export type PublishInput = {
  /** The owner confirmed bringing back what a rollback took out. */
  allowOutdatedBase: boolean;
  notes: string;
  version: string;
};

/** The project's release written into the network's draft and not published yet. */
export type PreparedRelease = {
  publisherId: string;
  /** When it was written into the network. */
  updateTime: number;
  version: string;
};

/**
 * A version of the project's network. `status`: `running`, `history`, `deprecated` or `purged`.
 * `origin`: `project`, `other_project` or `workspace`. `release` is the version of the release
 * that published it, when a release did.
 */
export type NetworkVersion = {
  baseVersion: number;
  createTime: number;
  label: string;
  notes: string;
  origin: string;
  publisherId: string;
  release: string;
  status: string;
  version: number;
};

/**
 * The versions of the project's network, newest first. `fullHistory` is false in the community
 * edition, which keeps only the running and the previous version.
 */
export type ProjectVersions = {
  entries: NetworkVersion[];
  prepared: PreparedRelease | null;
  versioning: {
    /** The network's draft: the version it started from, and whether it was rolled back past. */
    draft: { baseVersion: number; hasChanges: boolean; outdated: boolean };
    fullHistory: boolean;
    previousVersion: number;
    runningVersion: number;
  };
};

/** What publishing did: the version it made, and the one the community edition dropped (0 for none). */
export type PublishResult = { knVersion: number; purgedVersion: number };

/** A test question asked in its scenario question's place, and what it expects of the data. */
export type RegressionTest = { expect: string; id: string; text: string };

/** A scenario question as the regression asked it: by its tests when it has them. */
/**
 * A question of a regression. `noRecord`: it asks about a record and the data had none to fill it
 * with, so it was not asked.
 */
export type RegressionQuestion = {
  id: string;
  noRecord: boolean;
  tests: RegressionTest[];
  text: string;
};

/**
 * How one question or test did. `outcome`: `passed`, `missing` (the release lacks what it
 * needs), `no_answer`, `needs_values`, `not_answered` or `error`. `reason` is the judge's, in the
 * project's naming language.
 */
export type RegressionResult = {
  answer: string;
  errorCode: string;
  missing: ReleaseItem[];
  /** For `data_source_missing`: the items whose tables are gone, so the question was not asked. */
  missingTables: ReleaseItem[];
  outcome: string;
  questionId: string;
  reason: string;
  testId: string;
  /** How each tool call the answer made finished; the page counts them, never names them. */
  toolStatuses: string[];
};

/** How the project's scenario questions did once a release was written into the network. */
export type Regression = {
  attempt: number;
  /** Why a run failed as a whole: `interrupted`, `definitions_unreadable`, `draft_changed`, `index_not_ready`. */
  error: string;
  finishTime: number;
  questions: RegressionQuestion[];
  results: RegressionResult[];
  runnerId: string;
  startTime: number;
  /** `running`, `passed`, `not_passed`, `needs_values`, `failed` or `no_questions`. */
  status: string;
  version: string;
};

/** A version of the network a rollback reads: its number, label and the release that published it. */
export type RollbackVersion = { knVersion: number; label: string; version: string };

/**
 * What switching the network's running version back to `to` would do: the scenario questions it
 * changes, and why it cannot go, if it cannot.
 */
export type RollbackPlan = {
  from: RollbackVersion;
  fullHistory: boolean;
  questions: ReleaseReview["questions"];
  /** Why switching back cannot go, such as `Rollback.NoPrevious`. */
  refusals: string[];
  /** Stands for the plan; switching refuses a plan that no longer stands. */
  signature: string;
  /** null when there is no version to go back to. */
  to: RollbackVersion | null;
};

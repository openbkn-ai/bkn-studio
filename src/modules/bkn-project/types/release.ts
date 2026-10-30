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
  };
  /** Stands for what the review was read from; publishing refuses another. */
  signature: string;
  version: string;
};

export type PublishInput = {
  accepts: string[];
  notes: string;
  signature: string;
  version: string;
};

/** A release of a network's lineage, by this project or another. */
export type LineageRelease = {
  createTime: number;
  networkId: string;
  notes: string;
  projectId: string;
  publisherId: string;
  /** `live` for the newest release, `archived` for earlier ones. */
  state: string;
  version: string;
};

/** What switching consumers to a network would move: the active schedules of the one in use. */
export type SwitchPlan = {
  fromNetworkId: string;
  schedules: { id: string; name: string }[];
  toNetworkId: string;
};

/** A test question asked in its scenario question's place, and what it expects of the data. */
export type RegressionTest = { expect: string; id: string; text: string };

/** A scenario question as the regression asked it: by its tests when it has them. */
export type RegressionQuestion = { id: string; tests: RegressionTest[]; text: string };

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

/** How the project's scenario questions did on the network a release created. */
export type Regression = {
  attempt: number;
  /** Why a run failed as a whole: `interrupted`, `definitions_unreadable`. */
  error: string;
  finishTime: number;
  networkId: string;
  questions: RegressionQuestion[];
  results: RegressionResult[];
  runnerId: string;
  startTime: number;
  /** `running`, `passed`, `not_passed`, `needs_values`, `failed` or `no_questions`. */
  status: string;
  version: string;
};

/** A network of the lineage: a release's, by its version, or the network it started from. */
export type RollbackNetwork = { base: boolean; networkId: string; version: string };

/**
 * What rolling consumers back would do: the network in use and the one before it, the schedules
 * that move back, the consumers whose owners switch them, and the scenario questions it changes.
 */
export type RollbackPlan = {
  /** Kinds of consumer their owners switch back themselves: `agents`, `mcp`, `workshop`, `eval`. */
  consumers: string[];
  from: RollbackNetwork;
  questions: ReleaseReview["questions"];
  /** Why rolling back cannot go, such as `Rollback.NoPrevious`. */
  refusals: string[];
  schedules: { id: string; name: string }[];
  /** Stands for the plan; rolling back refuses a plan that no longer stands. */
  signature: string;
  /** null when there is no network before the one in use. */
  to: RollbackNetwork | null;
};

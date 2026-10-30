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

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** What a versioned network is being read as: its draft, its running version, or a numbered one. */
export type KnVersionView = "draft" | "running" | number;

export type KnVersionStatus = "running" | "history" | "deprecated" | "purged";

export type KnDraftIndex = {
  revision?: number;
  status?: "building" | "ready" | "failed";
};

export type KnDraftState = {
  base_version?: number;
  has_changes?: boolean;
  outdated?: boolean;
  revision?: number;
  index?: KnDraftIndex | null;
  index_ready?: boolean;
};

/** The `versioning` view of a network (`GET /knowledge-networks/{id}`, `GET .../versioning`). */
export type KnVersioning = {
  enabled: boolean;
  mode?: "enabled" | "disabling";
  running_version: number;
  previous_version: number;
  /** false in the Community edition, which keeps only the running and the previous version. */
  full_history: boolean;
  draft?: KnDraftState;
};

export type KnAccountInfo = { id?: string; name?: string; type?: string };

export type KnVersionSource = { type?: string; project_id?: string; ref?: string };

export type KnVersion = {
  kn_id?: string;
  version: number;
  label?: string;
  status: KnVersionStatus;
  origin?: "enable" | "publish";
  base_version?: number;
  draft_revision?: number;
  notes?: string;
  source?: KnVersionSource;
  publisher?: KnAccountInfo;
  publish_time?: number;
  status_by?: KnAccountInfo;
  status_time?: number;
};

export type KnVersionWarning = {
  category?: string;
  definition_id?: string;
  description?: string;
};

export type KnPublishResult = KnVersion & {
  purged_version?: number;
  warnings?: KnVersionWarning[];
  published_metrics?: Array<{ metric_id?: string; version?: number }>;
};

export type KnVersionEventType =
  | "enable"
  | "publish"
  | "switch"
  | "copy"
  | "discard"
  | "deprecate"
  | "restore"
  | "purge"
  | "disable";

export type KnVersionEvent = {
  id: string;
  type: KnVersionEventType;
  from_version?: number;
  to_version?: number;
  reason?: string;
  notes?: string;
  operator?: KnAccountInfo;
  create_time?: number;
};

/** One reason a version cannot go live, from `error_details.problems`. */
export type KnVersionProblem = {
  category?: string;
  definition_type?: string;
  definition_id?: string;
  description?: string;
};

export type KnPublishInput = {
  expectedRunningVersion: number;
  expectedDraftRevision: number;
  label?: string;
  notes?: string;
  allowOutdatedBase?: boolean;
};

export type KnResetDraftInput = {
  expectedDraftRevision: number;
  fromVersion?: number;
  overwriteChanges?: boolean;
};

export type KnDiffFieldChange = {
  path?: string;
  kind?: "create" | "update" | "delete";
  old?: string;
  new?: string;
};

export type KnDiffDefinition = {
  type: string;
  id: string;
  action: "create" | "update" | "delete" | "skip";
  name?: { old?: string; new?: string };
  changes?: KnDiffFieldChange[];
};

export type KnDiffResult = {
  base?: { kn_id?: string; branch?: string; name?: string };
  target?: { kn_id?: string; branch?: string; name?: string };
  summary?: { created?: number; updated?: number; deleted?: number; unchanged?: number };
  network?: KnDiffDefinition;
  entries?: KnDiffDefinition[];
};

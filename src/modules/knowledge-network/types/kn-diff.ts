/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type KnDiffAction = "create" | "update" | "delete" | "skip";

export type KnDiffDefinitionKind =
  | "object_type"
  | "relation_type"
  | "action_type"
  | "risk_type"
  | "concept_group"
  | "metric"
  | "network";

export type KnDiffFieldChange = {
  path: string;
  kind: KnDiffAction;
  oldValue: string;
  newValue: string;
};

export type KnDiffDefinition = {
  type: KnDiffDefinitionKind;
  id: string;
  action: KnDiffAction;
  oldName: string;
  newName: string;
  /** How the two sides were matched. "name" means the ids differ and both are reported. */
  pairedBy: "id" | "name";
  baseId: string;
  targetId: string;
  changes: KnDiffFieldChange[];
};

export type KnDiffSide = {
  networkId: string;
  branch: string;
  name: string;
};

export type KnDiffSummary = {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
};

/**
 * How much of the two networks' identity overlaps. Zero common ids means the two networks were
 * built independently, and the comparison is a wall of creates and deletes rather than a readable
 * result — the page says so instead of letting someone read it definition by definition.
 */
export type KnDiffLineage = {
  commonIds: number;
  totalIds: number;
  related: boolean;
};

export type KnDiffResult = {
  base: KnDiffSide;
  target: KnDiffSide;
  summary: KnDiffSummary;
  lineage: KnDiffLineage;
  /** The root file, kept out of the definition counts: two networks always differ here. */
  network: KnDiffDefinition | null;
  entries: KnDiffDefinition[];
};

export type KnDiffRequest = {
  baseNetworkId: string;
  baseBranch?: string;
  targetNetworkId: string;
  targetBranch?: string;
  fallbackByName?: boolean;
  /** Also return the definitions that are identical on both sides, so the whole model can be listed. */
  includeUnchanged?: boolean;
};

export type ObjectDataStatsSide = {
  networkId: string;
  branch: string;
  objectTypeId: string;
  objectTypeName: string;
  resourceId: string;
  primaryKeys: string[];
  rowCount: number;
  /** Absent when the object type declares no primary key. */
  primaryKeyDistinct: number | null;
  /** Rows minus distinct keys: rows the model believes are the same object. */
  duplicateKeys: number | null;
};

export type ObjectDataStatsResult = {
  base: ObjectDataStatsSide;
  target: ObjectDataStatsSide;
  /** Both sides read one table, so every number matches by construction. */
  sameResource: boolean;
  delta: {
    rowCount: number;
    primaryKeyDistinct: number | null;
  };
};

export type ObjectDataStatsRequest = {
  baseNetworkId: string;
  baseBranch?: string;
  baseObjectTypeId: string;
  targetNetworkId: string;
  targetBranch?: string;
  targetObjectTypeId: string;
};

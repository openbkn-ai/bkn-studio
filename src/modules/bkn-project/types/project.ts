/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** An account as bkn-project records it. */
export type ProjectAccount = {
  id: string;
  type: string;
};

/**
 * A project changes one knowledge network on its own branch of the network's lineage.
 * `knId` is the lineage's base network.
 */
export type Project = {
  archived: boolean;
  baselineNetworkId: string;
  branch: string;
  catalogIds: string[];
  createTime: number;
  id: string;
  knId: string;
  name: string;
  /** Other unarchived projects of the same network. */
  otherProjects: number;
  owner: ProjectAccount;
  updateTime: number;
};

export type ProjectArchiveFilter = "all" | "false" | "true";

export type ProjectListQuery = {
  archived: ProjectArchiveFilter;
  cursor?: string;
  limit: number;
  name: string;
};

export type ProjectListResult = {
  items: Project[];
  nextCursor: string | null;
  total: number;
};

/** Exactly one of `knId` and `newKnName` is set. */
export type CreateProjectInput = {
  catalogIds: string[];
  knId?: string;
  name: string;
  newKnName?: string;
};

/** A knowledge network the caller can see, for names and the target picker. */
export type ProjectNetwork = {
  id: string;
  name: string;
};

/** A data catalog a project may reference. */
export type ProjectCatalog = {
  id: string;
  name: string;
};

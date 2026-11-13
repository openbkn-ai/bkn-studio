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
  /**
   * The catalogs among `catalogIds` that the network's object types read: the project takes them
   * from its existing network, which owns them. Empty on a network the project created.
   */
  networkCatalogIds?: string[];
  /** Other unarchived projects of the same network. */
  otherProjects: number;
  owner: ProjectAccount;
  /** The owner's display name; empty when the directory does not know it. */
  ownerName?: string;
  updateTime: number;
};

export type ProjectArchiveFilter = "all" | "false" | "true";

export type ProjectListQuery = {
  archived: ProjectArchiveFilter;
  limit: number;
  name: string;
  /** How many projects the page skips: (page - 1) * limit. */
  offset: number;
};

export type ProjectListResult = {
  items: Project[];
  total: number;
};

/** Exactly one of `knId` and `newKnName` is set. */
export type CreateProjectInput = {
  catalogIds: string[];
  /** The owner confirmed that edits to the chosen network take effect only once published. */
  enableVersioning?: boolean;
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

/** A release of a project's lineage, as the overview and workspace header show it. */
export type ProjectRelease = {
  createTime: number;
  networkId: string;
  version: string;
};

/**
 * Object types BKN-project writes on a network for agents, beside what people model, such as the
 * term library's domain term object type: published, but no business content, so what a network
 * has is counted without them. bkn-project leaves them out of its own lists the same way.
 */
export const SYSTEM_OBJECT_TYPE_IDS: ReadonlySet<string> = new Set(["bkn_domain_terms"]);

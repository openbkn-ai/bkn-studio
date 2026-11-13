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
  /** The caller owns the project or administers the platform: may rename and delete it. */
  canManage: boolean;
  baselineNetworkId: string;
  branch: string;
  catalogIds: string[];
  createTime: number;
  id: string;
  knId: string;
  name: string;
  /** The language of what the project generates, fixed when it is created. */
  namingLanguage: ProjectNamingLanguage;
  /** Other unarchived projects of the same network. */
  otherProjects: number;
  owner: ProjectAccount;
  /** The owner's display name; empty when the directory does not know it. */
  ownerName?: string;
  updateTime: number;
};

/** The languages a project's generated content may be in. */
export const PROJECT_NAMING_LANGUAGES = ["zh-CN", "en-US"] as const;

export type ProjectNamingLanguage = (typeof PROJECT_NAMING_LANGUAGES)[number];

export type ProjectListQuery = {
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
  namingLanguage: ProjectNamingLanguage;
  newKnName?: string;
};

/** bkn-project refuses larger project packages. */
export const MAX_PROJECT_PACKAGE_BYTES = 50 * 1024 * 1024;

/** What a project package holds, as read before importing it. */
export type ProjectPackagePreview = {
  catalogs: ProjectCatalog[];
  contents: {
    confirmedFiles: number;
    documents: number;
    draft: boolean;
    /** Further parts the package brings, such as "terms" or "knowledge_base". */
    editions: string[];
    requirement: boolean;
  };
  formatVersion: number;
  kn: ProjectNetwork;
  name: string;
  namingLanguage: ProjectNamingLanguage;
};

/** How a package becomes a project here. Exactly one of `knId` and `newKnName` is set. */
export type ImportProjectInput = {
  /** Each package catalog id to the id of a catalog of this environment. */
  catalogMapping: Record<string, string>;
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

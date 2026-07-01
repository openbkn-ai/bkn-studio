/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type CatalogKind = "all" | "http" | "mcp" | "skill";

export type CatalogEntry = {
  id: string;
  kind: Exclude<CatalogKind, "all">;
  name: string;
  description?: string;
  status: string;
  updateTime?: number;
  installed: boolean;
  version?: string;
};

export type CatalogListResult = {
  items: CatalogEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export type InstallCatalogInput = {
  kind: Exclude<CatalogKind, "all">;
  sourceId: string;
  mode?: "create" | "upsert";
  name?: string;
};

export type InstallCatalogResult = {
  componentType: string;
  mode: string;
  capabilities: Array<{
    id: string;
    name: string;
    kind: string;
    boxId?: string;
    mcpId?: string;
    skillId?: string;
  }>;
};

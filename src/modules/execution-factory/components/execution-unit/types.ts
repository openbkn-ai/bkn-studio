/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ExecutionUnitTab = "mcp" | "toolbox" | "operator" | "skill";

export type ExecutionUnitCardItem = {
  id: string;
  name: string;
  description?: string;
  metadataType?: string;
  isInternal?: boolean;
  toolCount?: number;
  releaseUser?: string;
  updateUser?: string;
  releaseTime?: number;
  updateTime?: number;
  status?: string;
  version?: string;
  category?: string;
  categoryName?: string;
  installedInDomain?: boolean;
};

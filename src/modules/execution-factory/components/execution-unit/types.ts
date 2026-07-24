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
  /** 「全部」视图里一屏混着多种类型，卡片不能再从 activeTab 推自己是什么。 */
  unitType?: ExecutionUnitTab;
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

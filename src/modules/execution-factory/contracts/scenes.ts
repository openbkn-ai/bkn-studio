/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type UnitManagementListSceneProps = {
  defaultKeyword?: string;
  onOpenDetail?: (operatorId: string) => void;
};

export type CatalogListSceneProps = {
  defaultKeyword?: string;
  onOpenDetail?: (operatorId: string) => void;
};

export type UnitFormSceneProps = {
  mode: "create" | "edit";
  operatorId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type ToolboxFormSceneProps = {
  mode: "create" | "edit";
  boxId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type ToolboxToolsSceneProps = {
  boxId: string;
  onBack?: () => void;
};

export type McpDetailSceneProps = {
  mcpId: string;
  onBack?: () => void;
};

export type SkillDetailSceneProps = {
  skillId: string;
  onBack?: () => void;
};

export type ToolDetailSceneProps = {
  boxId: string;
  toolId: string;
  onBack?: () => void;
};

export type McpFormSceneProps = {
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type SkillFormSceneProps = {
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type SkillEditSceneProps = {
  skillId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

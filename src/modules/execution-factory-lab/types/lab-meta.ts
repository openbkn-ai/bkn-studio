/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type LabFeatureFlags = {
  catalog: boolean;
  function: boolean;
  impex: boolean;
  mcp_sse_wizard: boolean;
  skill_files: boolean;
  hide_legacy_execution_factory_menu: boolean;
};

export type LabMeta = {
  service: string;
  version: string;
  features: LabFeatureFlags;
};

export const defaultLabFeatureFlags: LabFeatureFlags = {
  catalog: true,
  function: true,
  impex: true,
  mcp_sse_wizard: true,
  skill_files: true,
  hide_legacy_execution_factory_menu: false,
};

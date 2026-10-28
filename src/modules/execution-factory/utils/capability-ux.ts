/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

/** Management tabs, in display order. */
export const CAPABILITY_UX_PRIMARY_TABS: ExecutionUnitTab[] = ["toolbox", "mcp", "skill"];

export type CapabilityUxMode = "quick-api" | "import-openapi" | "function" | "mcp" | "skill";

/** Modes relevant when creating from the toolsets tab. */
export const TOOLBOX_CAPABILITY_MODES: CapabilityUxMode[] = [
  "quick-api",
  "import-openapi",
  "function",
];

/** Two HTTP API paths: add one API or import an OpenAPI document, using two cards in the same wizard. */
export const HTTP_API_CAPABILITY_MODES: CapabilityUxMode[] = ["quick-api", "import-openapi"];

const ALL_CAPABILITY_MODES: CapabilityUxMode[] = [
  "quick-api",
  "import-openapi",
  "function",
  "mcp",
  "skill",
];

function readEnvCapabilityUxV2(): boolean | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env.VITE_CAPABILITY_UX_V2;
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return undefined;
}

/** UX-first capability model; default on unless explicitly disabled. */
export function isCapabilityUxV2(): boolean {
  const runtimeFlag = getRuntimeConfig().features?.capabilityUxV2;
  if (typeof runtimeFlag === "boolean") {
    return runtimeFlag;
  }

  const envFlag = readEnvCapabilityUxV2();
  if (typeof envFlag === "boolean") {
    return envFlag;
  }

  return true;
}

export function getManagementTabs(): ExecutionUnitTab[] {
  return CAPABILITY_UX_PRIMARY_TABS;
}

export function getDefaultManagementTab(): ExecutionUnitTab {
  return "toolbox";
}

export function getExecutionUnitTabLabelKey(tab: ExecutionUnitTab): string {
  if (!isCapabilityUxV2()) {
    return `executionFactory.executionUnitTabs.${tab}`;
  }

  return `executionFactory.executionUnitTabsV2.${tab}`;
}

export function getCapabilityModesForTab(tab?: ExecutionUnitTab): CapabilityUxMode[] {
  if (!tab) {
    return ALL_CAPABILITY_MODES;
  }

  switch (tab) {
    case "mcp":
      return ["mcp"];
    case "skill":
      return ["skill"];
    case "toolbox":
      return TOOLBOX_CAPABILITY_MODES;
    default:
      return ALL_CAPABILITY_MODES;
  }
}

export function getDefaultCapabilityModeForTab(tab?: ExecutionUnitTab): CapabilityUxMode {
  switch (tab) {
    case "mcp":
      return "mcp";
    case "skill":
      return "skill";
    default:
      return "quick-api";
  }
}

/** Skip the mode picker when context already implies the creation path. */
export function shouldSkipCapabilityModeStep(
  tab?: ExecutionUnitTab,
  options?: { initialBoxId?: string },
): boolean {
  if (options?.initialBoxId) {
    return true;
  }

  return Boolean(tab);
}

export function canReturnToModeStep(allowedModes: CapabilityUxMode[]): boolean {
  return allowedModes.length > 1;
}

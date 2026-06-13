import { getRuntimeConfig } from "@/framework/runtime/config";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

/** Primary tabs in capability-first UX (operator via sync checkbox or deep link). */
export const CAPABILITY_UX_PRIMARY_TABS: ExecutionUnitTab[] = ["toolbox", "mcp", "skill"];

export const CAPABILITY_UX_LEGACY_TABS: ExecutionUnitTab[] = [
  "operator",
  "toolbox",
  "mcp",
  "skill",
];

export type CapabilityUxMode =
  | "quick-api"
  | "import-openapi"
  | "function"
  | "mcp"
  | "skill"
  | "advanced-operator";

/** Modes relevant when creating from the toolsets tab. */
export const TOOLBOX_CAPABILITY_MODES: CapabilityUxMode[] = [
  "quick-api",
  "import-openapi",
  "function",
];

const ALL_CAPABILITY_MODES: CapabilityUxMode[] = [
  "quick-api",
  "import-openapi",
  "function",
  "mcp",
  "skill",
  "advanced-operator",
];

function readEnvCapabilityUxV2(): boolean | undefined {
  const raw = import.meta.env.VITE_CAPABILITY_UX_V2;
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
  return isCapabilityUxV2() ? CAPABILITY_UX_PRIMARY_TABS : CAPABILITY_UX_LEGACY_TABS;
}

export function getDefaultManagementTab(): ExecutionUnitTab {
  return isCapabilityUxV2() ? "toolbox" : "operator";
}

export function resolveVisibleManagementTabs(
  activeTab: ExecutionUnitTab,
): ExecutionUnitTab[] {
  const primary = getManagementTabs();
  if (primary.includes(activeTab)) {
    return primary;
  }

  if (activeTab === "operator" && isCapabilityUxV2()) {
    return [...primary, "operator"];
  }

  return primary;
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
    case "operator":
      return ["advanced-operator"];
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
    case "operator":
      return "advanced-operator";
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

  if (!tab || tab === "operator") {
    return false;
  }

  return true;
}

export function canReturnToModeStep(allowedModes: CapabilityUxMode[]): boolean {
  return allowedModes.length > 1;
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";
import type { CapabilityUxMode } from "@/modules/execution-factory/utils/capability-ux";

export type CapabilityCreateMenuAction = CapabilityUxMode | "import-adp";

export type CapabilityCreateMenuItem = {
  action: CapabilityCreateMenuAction;
  titleKey: string;
  descriptionKey: string;
};

export function getCapabilityCreateMenuItems(): CapabilityCreateMenuItem[] {
  // Matches list tabs one-to-one: API toolboxes, function sets, MCP services, and SKILL packages.
  // Import uses the shared toolbar Import action. Keep only four creation types here without groups
  // because each group would contain one item and repeat its title.
  return [
    {
      action: "quick-api",
      titleKey: "executionFactory.capabilityCreateMenu.addHttpApi",
      descriptionKey: "executionFactory.capabilityCreateMenu.addHttpApiDesc",
    },
    {
      action: "function",
      titleKey: "executionFactory.capabilityCreateMenu.addFunction",
      descriptionKey: "executionFactory.capabilityCreateMenu.addFunctionDesc",
    },
    {
      action: "mcp",
      titleKey: "executionFactory.capabilityCreateMenu.registerMcp",
      descriptionKey: "executionFactory.capabilityCreateMenu.registerMcpDesc",
    },
    {
      action: "skill",
      titleKey: "executionFactory.capabilityCreateMenu.importSkill",
      descriptionKey: "executionFactory.capabilityCreateMenu.importSkillDesc",
    },
  ];
}

export function resolveCapabilityAdpImportTab(activeTab: ExecutionUnitTab): ExecutionUnitTab {
  if (activeTab === "operator" || activeTab === "toolbox" || activeTab === "mcp") {
    return activeTab;
  }

  return "toolbox";
}

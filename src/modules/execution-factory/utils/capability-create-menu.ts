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

export type CapabilityCreateMenuSection = {
  titleKey: string;
  items: CapabilityCreateMenuItem[];
};

export function getCapabilityCreateMenuSections(): CapabilityCreateMenuSection[] {
  return [
    {
      titleKey: "executionFactory.capabilityCreateMenu.httpApi",
      items: [
        {
          action: "quick-api",
          titleKey: "executionFactory.capabilityCreateMenu.addHttpApi",
          descriptionKey: "executionFactory.capabilityCreateMenu.addHttpApiDesc",
        },
        {
          action: "import-openapi",
          titleKey: "executionFactory.capabilityCreateMenu.importOpenApi",
          descriptionKey: "executionFactory.capabilityCreateMenu.importOpenApiDesc",
        },
      ],
    },
    {
      titleKey: "executionFactory.capabilityCreateMenu.mcp",
      items: [
        {
          action: "mcp",
          titleKey: "executionFactory.capabilityCreateMenu.registerMcp",
          descriptionKey: "executionFactory.capabilityCreateMenu.registerMcpDesc",
        },
      ],
    },
    {
      titleKey: "executionFactory.capabilityCreateMenu.skillFunction",
      items: [
        {
          action: "skill",
          titleKey: "executionFactory.capabilityCreateMenu.importSkill",
          descriptionKey: "executionFactory.capabilityCreateMenu.importSkillDesc",
        },
        {
          action: "function",
          titleKey: "executionFactory.capabilityCreateMenu.addFunction",
          descriptionKey: "executionFactory.capabilityCreateMenu.addFunctionDesc",
        },
      ],
    },
    {
      titleKey: "executionFactory.capabilityCreateMenu.package",
      items: [
        {
          action: "import-adp",
          titleKey: "executionFactory.capabilityCreateMenu.importAdp",
          descriptionKey: "executionFactory.capabilityCreateMenu.importAdpDesc",
        },
      ],
    },
  ];
}

export function resolveCapabilityAdpImportTab(activeTab: ExecutionUnitTab): ExecutionUnitTab {
  if (activeTab === "operator" || activeTab === "toolbox" || activeTab === "mcp") {
    return activeTab;
  }

  return "toolbox";
}

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
  // 分组与列表 tab 一一对应：API 工具集 / 函数集 / MCP 服务 / SKILL 包。
  // 「导入 OpenAPI」「导入 ADP 包」不在此列——导入走工具栏的「导入」按钮，各页面通用，
  // 添加能力只保留「新建」四类，避免和导入入口重复。
  return [
    {
      titleKey: "executionFactory.capabilityCreateMenu.httpApi",
      items: [
        {
          action: "quick-api",
          titleKey: "executionFactory.capabilityCreateMenu.addHttpApi",
          descriptionKey: "executionFactory.capabilityCreateMenu.addHttpApiDesc",
        },
      ],
    },
    {
      titleKey: "executionFactory.capabilityCreateMenu.function",
      items: [
        {
          action: "function",
          titleKey: "executionFactory.capabilityCreateMenu.addFunction",
          descriptionKey: "executionFactory.capabilityCreateMenu.addFunctionDesc",
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
      titleKey: "executionFactory.capabilityCreateMenu.skill",
      items: [
        {
          action: "skill",
          titleKey: "executionFactory.capabilityCreateMenu.importSkill",
          descriptionKey: "executionFactory.capabilityCreateMenu.importSkillDesc",
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

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const WORKSPACE_MOUNT_SECTIONS = {
  functions: {
    descriptionKey: "knowledgeNetwork.capabilityFunctionsDescription",
    titleKey: "knowledgeNetwork.workspaceFunctions",
  },
  apis: {
    descriptionKey: "knowledgeNetwork.capabilityApisDescription",
    titleKey: "knowledgeNetwork.workspaceApis",
  },
  mcp: {
    descriptionKey: "knowledgeNetwork.capabilityMcpToolsDescription",
    titleKey: "knowledgeNetwork.workspaceMcpTools",
  },
  skills: {
    descriptionKey: "knowledgeNetwork.capabilitySkillsDescription",
    titleKey: "knowledgeNetwork.workspaceSkills",
  },
} as const;

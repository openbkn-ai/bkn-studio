/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const packageImportPart = {
  packageImport: {
    file: "BKN package: {{name}}",
    conflictTip:
      "A BKN package's name and ID cannot be changed here. You can overwrite the existing knowledge network, or skip what already exists and import the rest.",
    successBound: "Imported, with {{count}} capabilities bound.",
    successBound_one: "Imported, with {{count}} capability bound.",
    successBound_other: "Imported, with {{count}} capabilities bound.",
    skippedTitle: "Imported, but {{count}} capabilities were not bound",
    skippedTitle_one: "Imported, but {{count}} capability was not bound",
    skippedTitle_other: "Imported, but {{count}} capabilities were not bound",
    skippedDescription:
      "The knowledge network is imported, with {{count}} capabilities bound. The ones below could not be bound in this environment; you can mount them later on the network's capability pages.",
    skippedDescription_one:
      "The knowledge network is imported, with {{count}} capability bound. The ones below could not be bound in this environment; you can mount them later on the network's capability pages.",
    skippedDescription_other:
      "The knowledge network is imported, with {{count}} capabilities bound. The ones below could not be bound in this environment; you can mount them later on the network's capability pages.",
    skipItem: "{{type}} · {{name}}",
    skipItemInBox: "{{type}} · {{name}} ({{box}})",
    unnamed: "Unnamed",
    done: "Got it",
    reason: {
      ambiguous_name: "Several share this name, so none was picked",
      execution_factory_unreachable: "The execution factory could not be reached",
      knowledge_base_service_unreachable: "The knowledge-base service could not be reached",
      not_found: "Not found in this environment",
      not_supported: "This deployment does not support this kind of capability",
      not_usable: "Found, but not published or disabled",
      other: "Another reason",
    },
    type: {
      function: "Function",
      knowledge_base: "Knowledge base",
      mcp_tool: "MCP tool",
      skill: "SKILL",
      other: "Capability",
    },
  },
} as const;

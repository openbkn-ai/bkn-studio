/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const packageImportPart = {
  packageImport: {
    reason: {
      ambiguous_name: "Several share this name, so none was picked",
      execution_factory_unreachable: "The execution factory could not be reached",
      knowledge_base_service_unreachable: "The knowledge-base service could not be reached",
      not_found: "Not found in this environment",
      not_supported: "This deployment has no knowledge-base service",
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

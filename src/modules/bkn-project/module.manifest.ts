/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// A project is visible to whoever can see its knowledge network; bkn-project checks that with the
// caller's token, so the module declares no permission points of its own.
export const bknProjectModuleManifest = {
  id: "bkn-project",
  name: "Project management",
  permissions: [],
  requiresShell: true,
  services: [
    "bkn-project/v1/projects",
    "bkn-project/v1/lineages",
    "bkn-backend/v1/knowledge-networks",
    "vega-backend/catalogs",
  ],
  supportsEmbedded: false,
  supportsReadOnly: false,
  scenes: [
    {
      id: "bkn-project.list",
      exportName: "ProjectListScene",
      description: "Projects of the visible knowledge networks: search, archive filter, create.",
      inputs: [],
    },
    {
      id: "bkn-project.workspace",
      exportName: "ProjectWorkspaceScene",
      description: "A project workspace: its own navigation and the overview of the project.",
      inputs: ["projectId", "section"],
    },
  ],
} as const;

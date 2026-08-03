/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const homeModuleManifest = {
  id: "home",
  name: "Workspace Home",
  permissions: [],
  requiresShell: true,
  services: [],
  supportsEmbedded: false,
  supportsReadOnly: true,
  scenes: [
    {
      id: "home.workspace",
      exportName: "HomeScene",
      description: "Workspace landing page with permission-aware entries and recent visits.",
      inputs: [],
    },
  ],
} as const;

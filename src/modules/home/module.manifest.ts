/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const homeModuleManifest = {
  id: "home",
  name: "Home",
  permissions: [],
  requiresShell: true,
  services: [],
  supportsEmbedded: false,
  supportsReadOnly: true,
  scenes: [
    {
      id: "home.landing",
      exportName: "HomeScene",
      description: "Product home with platform and engineering knowledge-network build guidance.",
      inputs: [],
    },
  ],
} as const;

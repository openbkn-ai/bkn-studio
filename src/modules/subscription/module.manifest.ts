/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const subscriptionModuleManifest = {
  id: "subscription",
  name: "Editions & subscription",
  permissions: [],
  requiresShell: true,
  services: ["safe/v1"],
  supportsEmbedded: false,
  supportsReadOnly: true,
  scenes: [
    {
      id: "subscription.editions",
      exportName: "SubscriptionScene",
      description:
        "Compare editions against the licence and image in force, and route to licence import or sales.",
      inputs: [],
    },
  ],
} as const;

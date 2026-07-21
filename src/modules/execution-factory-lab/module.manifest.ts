/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { executionFactoryLabPermissionList } from "./permissions";

export const executionFactoryLabModuleManifest = {
  id: "execution-factory-lab",
  name: "Execution Factory Lab",
  permissions: executionFactoryLabPermissionList,
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: ["capabilities-lab/v1", "agent-operator-integration/v1/sandbox"],
  scenes: [
    {
      id: "execution-factory-lab.capabilities",
      exportName: "CapabilityLabListScene",
      description: "Experimental capability-first execution factory view.",
      inputs: [],
    },
    {
      id: "execution-factory-lab.catalog",
      exportName: "CatalogLabListScene",
      description: "Market catalog browse and install for lab capabilities.",
      inputs: [],
    },
    {
      id: "execution-factory-lab.sandbox-runtime",
      exportName: "SandboxRuntimeScene",
      description: "Sandbox runtime health, session pool, and execution session management.",
      inputs: [],
    },
  ],
} as const;

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const modelResourcesModuleManifest = {
  id: "model-resources",
  name: "Model Resources",
  permissions: [
    "model-resources:model:view",
    "model-resources:model:create",
    "model-resources:model:edit",
    "model-resources:model:delete",
    "model-resources:quota:view",
    "model-resources:quota:edit",
    "model-resources:statistics:view",
  ],
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: ["mf-model-manager/v1"],
  scenes: [
    {
      id: "model-resources.models",
      exportName: "ModelListScene",
      description: "Manage large and small models, including CRUD, testing, and monitoring.",
      inputs: [],
    },
    {
      id: "model-resources.quotas",
      exportName: "QuotaListScene",
      description: "Configure model quotas and distribute user token limits.",
      inputs: [],
    },
    {
      id: "model-resources.statistics",
      exportName: "ModelStatisticsScene",
      description: "View model usage statistics, latency, and throughput trends.",
      inputs: [],
    },
  ],
} as const;

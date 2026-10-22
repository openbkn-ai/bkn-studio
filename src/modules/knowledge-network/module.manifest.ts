/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const knowledgeNetworkModuleManifest = {
  id: "knowledge-network",
  name: "Knowledge Network",
  permissions: [
    "knowledge-network:view",
    "knowledge-network:create",
    "knowledge-network:edit",
    "knowledge-network:delete",
    "knowledge-network:import",
    "knowledge-network:export",
    "knowledge-network:preview",
    "knowledge-network:concept-group:view",
    "knowledge-network:metric:view",
    "knowledge-network:metric:create",
    "knowledge-network:metric:edit",
    "knowledge-network:metric:delete",
    "knowledge-network:metric:query",
  ],
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: [
    "bkn-backend/knowledge-networks",
    "bkn-backend/concept-groups",
    "bkn-backend/object-types",
    "bkn-backend/v1/object-metrics",
    "mf-model-manager/v1",
    "ontology-query/v1/object-metrics",
  ],
  scenes: [
    {
      id: "knowledge-network.list",
      exportName: "KnowledgeNetworkListScene",
      description: "Manage knowledge networks, search cards, and launch the main workspace.",
      inputs: ["onOpenWorkspace?"],
    },
    {
      id: "knowledge-network.workspace",
      exportName: "KnowledgeNetworkWorkspaceScene",
      description:
        "Render the knowledge-network workspace shell for overview, modeling, and resource sections.",
      inputs: ["networkId?", "section"],
    },
    {
      id: "knowledge-network.metric-form",
      exportName: "ObjectMetricFormScene",
      description: "Create or edit an object-centered atomic, derived, or composite metric.",
      inputs: ["mode"],
    },
    {
      id: "knowledge-network.metric-detail",
      exportName: "ObjectMetricDetailScene",
      description:
        "View object-metric definitions, immutable versions, and logical-property binding.",
      inputs: [],
    },
  ],
} as const;

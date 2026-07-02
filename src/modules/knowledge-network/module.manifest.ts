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
    "bkn-backend/metrics",
    "ontology-query/metrics",
  ],
  scenes: [
    {
      id: "knowledge-network.list",
      exportName: "KnowledgeNetworkListScene",
      description:
        "Manage knowledge networks, search cards, and launch the main workspace.",
      inputs: ["onOpenWorkspace?"],
    },
    {
      id: "knowledge-network.workspace",
      exportName: "KnowledgeNetworkWorkspaceScene",
      description:
        "Render the knowledge-network workspace shell for overview, modeling, and resource sections.",
      inputs: ["networkId?", "section", "onBack?"],
    },
    {
      id: "knowledge-network.metric-form",
      exportName: "MetricFormScene",
      description: "Create or edit a knowledge-network metric.",
      inputs: ["mode", "networkId?", "metricId?", "onBack?", "onSubmitSuccess?"],
    },
    {
      id: "knowledge-network.metric-detail",
      exportName: "MetricDetailScene",
      description: "View metric details, formula, and embedded data query results.",
      inputs: ["networkId?", "metricId?", "onBack?", "onEdit?", "onDeleteSuccess?"],
    },
    {
      id: "knowledge-network.metric-data-query",
      exportName: "MetricDataQueryScene",
      description: "Run standalone data queries for a knowledge-network metric.",
      inputs: ["networkId?", "metricId?", "onBack?"],
    },
  ],
} as const;

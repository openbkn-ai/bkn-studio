/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type KnowledgeNetworkListSceneProps = {
  onOpenWorkspace?: (networkId: string) => void;
};

export type KnowledgeNetworkWorkspaceSection =
  | "overview"
  | "preview"
  | "concept-groups"
  | "object-types"
  | "relation-types"
  | "action-types"
  | "metrics"
  | "tasks";

export type KnowledgeNetworkWorkspaceSceneProps = {
  networkId?: string;
  onBack?: () => void;
  section: KnowledgeNetworkWorkspaceSection;
};

export type MetricFormSceneProps = {
  metricId?: string;
  mode: "create" | "edit";
  networkId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type MetricDetailSceneProps = {
  metricId?: string;
  networkId?: string;
  onBack?: () => void;
  onDeleteSuccess?: () => void;
  onEdit?: () => void;
};

export type MetricDataQuerySceneProps = {
  metricId?: string;
  networkId?: string;
  onBack?: () => void;
};

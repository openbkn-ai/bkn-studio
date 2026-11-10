/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

export type KnowledgeNetworkListSceneProps = {
  onOpenWorkspace?: (networkId: string) => void;
};

export type KnowledgeNetworkWorkspaceSection =
  | "overview"
  | "develop"
  | "experience-agent"
  | "experience-mcp"
  | "experience-cypher"
  | "evals"
  | "concept-groups"
  | "object-types"
  | "relation-types"
  | "action-types"
  | "metrics"
  | "functions"
  | "apis"
  | "mcp"
  | "skills"
  | "knowledge-bases"
  | "versions"
  /** A page another build registered with its sidebar entry (WorkspaceNavEntry.page). */
  | "extension";

export type KnowledgeNetworkWorkspaceSceneProps = {
  networkId?: string;
  section: KnowledgeNetworkWorkspaceSection;
  /** With section "extension": the sidebar entry whose page is shown, by key. */
  extensionKey?: string;
  /** Inline workspace content for built-in, capability-gated pages such as Eval. */
  children?: ReactNode;
};

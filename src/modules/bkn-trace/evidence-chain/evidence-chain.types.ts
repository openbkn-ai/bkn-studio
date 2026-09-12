/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Internal view model. Edges and answer bindings must be supplied by a trusted projector. */
export type ChainStatus = "checked" | "located" | "candidate" | "unbound" | "missing" | "running" | "completed" | "interrupted" | "failed" | "unknown";
export interface ChainNode {
  id: string;
  label: string;
  kind: "relation" | "object" | "field" | "query" | "function" | "api" | "result" | "gap" | "source" | "calculation" | "conclusion";
  role?: "input" | "output" | "source" | "context" | "process" | "fact" | "conclusion";
  /** Only set when a source reference identifies this execution node. */
  executionNodeId?: string;
  value?: string;
  status?: ChainStatus;
  detail?: string;
  technical?: string;
}
export interface ChainEdge {
  id: string; source: string; target: string; label: string;
  kind?: "relation" | "binding" | "value" | "calculation" | "object" | "key" | "context" | "execution";
  role?: string;
  detail?: string;
  technical?: string;
}
export interface ChainGraph { nodes: ChainNode[]; edges: ChainEdge[] }
export interface ChainClaim {
  id: string;
  label: string;
  value?: string;
  status: "checked" | "located" | "candidate" | "unbound" | "missing";
  /** Unicode code-point offsets [start, end), checked against exact before linking. */
  answerRange?: { start: number; end: number; exact: string };
  nodeIds: string[];
  objectLabel?: string;
  detail?: string;
  role?: "result" | "scope";
  derivation?: {
    method: "sum" | "distinct_count" | "direct_return";
    processName: string;
    formula?: string;
    verification?: "same_return" | "independent_cross_check";
    boundary: string;
    inputs: Array<{ label: string; value: string }>;
    components: Array<{ label: string; value: string }>;
  };
}
export interface EvidenceChainView {
  interactionId: string;
  revisionLabel?: string;
  question?: string;
  answer?: string;
  status: "running" | "completed" | "interrupted" | "failed" | "unknown";
  claims: ChainClaim[];
  execution: ChainGraph;
  evidence: ChainGraph;
  notices?: string[];
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Internal view model. Edges and answer bindings must be supplied by a trusted projector. */
export type ChainStatus = "checked" | "located" | "candidate" | "unbound" | "missing" | "running" | "completed" | "interrupted" | "failed" | "unknown" | "supported" | "partial" | "unsupported" | "contradicted" | "recorded_result";
export type ClaimSupportStatus = "supported" | "partial" | "unsupported" | "contradicted";
export type ClaimAttributionStatus = "explicit" | "reconstructed" | "none";
export interface ChainNode {
  id: string;
  label: string;
  kind: "relation" | "object" | "field" | "query" | "function" | "api" | "result" | "gap" | "source" | "calculation" | "conclusion";
  role?: "input" | "output" | "source" | "context" | "process" | "fact" | "conclusion" | "gap";
  /** Only set when a source reference identifies this execution node. */
  executionNodeId?: string;
  value?: string;
  status?: ChainStatus;
  detail?: string;
  technical?: string;
}
export interface ChainEdge {
  id: string; source: string; target: string; label: string;
  kind?: "relation" | "binding" | "value" | "calculation" | "derivation" | "object" | "key" | "context" | "execution";
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
  /** Whether the recorded evidence supports the business conclusion. */
  supportStatus?: ClaimSupportStatus;
  /** How the answer-to-evidence reference was established. */
  attributionStatus?: ClaimAttributionStatus;
  /** Unicode code-point offsets [start, end), checked against exact before linking. */
  answerRange?: { start: number; end: number; exact: string };
  nodeIds: string[];
  objectLabel?: string;
  detail?: string;
  role?: "result" | "scope" | "primary" | "supporting";
  requirementIds?: string[];
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
export interface QuestionRequirement {
  id: string;
  label: string;
  status: "supported" | "partial" | "unsupported" | "contradicted" | "missing";
  questionRange?: { start: number; end: number; exact: string };
  claimIds: string[];
  requestedShape?: "value" | "member" | "count" | "relation" | "explanation";
}
export interface EvidenceChainView {
  interactionId: string;
  revisionLabel?: string;
  question?: string;
  answer?: string;
  status: "running" | "completed" | "interrupted" | "failed" | "unknown";
  evidenceStatus?: "complete" | "partial" | "assembling" | "failed" | "not_applicable" | "content_unavailable";
  requirements?: QuestionRequirement[];
  claims: ChainClaim[];
  execution: ChainGraph;
  evidence: ChainGraph;
  notices?: string[];
  /** 0.1.6 attribution status. The deterministic time rail remains usable while analysis is pending. */
  generationStatus?: "ready" | "analysis_pending";
  questionPairs?: QuestionPairView[];
  selectedPairGraphs?: Record<string, PairProvenanceGraph>;
  timeRail?: TimeRailItem[];
}

export interface QuestionPairView {
  id: string;
  question: string;
  answer: string;
  summary: string;
  status: string;
  reasonCode?: string;
  claimIds: string[];
}

export interface BusinessValueView {
  name: string;
  value?: string;
  sourceKind?: string;
  sourceRef?: string;
  evidenceRefs?: string[];
}

export interface BusinessFunctionOutputView {
  summary: string;
  evidenceRefs: string[];
  adoptedRowRefs: string[];
}

export interface AttributedBusinessFunctionView {
  id: string;
  displayName: string;
  capabilityKind: string;
  businessPurpose: string;
  businessInputs: BusinessValueView[];
  logicSummary: string;
  businessOutputs: BusinessFunctionOutputView[];
  operationIds: string[];
  supportsClaimIds: string[];
  schemaRefs: string[];
  technicalExecution: {
    interfaceNames: string[];
    inputPayloadRef?: string;
    outputPayloadRef?: string;
    completeness: string;
  };
  validationStatus: string;
  reasonCode?: string;
}

export interface AttributedExecutionStepView {
  id: string;
  operationId: string;
  attempt: number;
  businessRole: string;
  interfaceName: string;
  status: string;
  timeRailItemId: string;
}

export interface ProvenanceEdgeView {
  edgeId: string;
  kind: string;
  fromId: string;
  toId: string;
  operationIds: string[];
  validationStatus: string;
  reasonCode?: string;
}

export interface PairProvenanceGraph {
  claims: ChainClaim[];
  evidenceNodes: ChainNode[];
  businessFunctions: AttributedBusinessFunctionView[];
  executionSteps: AttributedExecutionStepView[];
  schemaNodes: ChainNode[];
  edges: ProvenanceEdgeView[];
}

export interface TimeRailPayload {
  mode: string;
  media_type: string;
  byte_length: number;
  inline?: unknown;
  ref?: string;
  omitted_reason?: string;
}

export interface TimeRailItem {
  id: string;
  order: number;
  operation_id: string;
  attempt: number;
  parent_operation_id?: string;
  interface_name: string;
  protocol: string;
  source_module?: string;
  status: string;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  input: TimeRailPayload;
  output?: TimeRailPayload;
  error?: TimeRailPayload;
  capability?: {
    manifest_id: string;
    manifest_version: string;
    evidence_contract: string;
    resolution: string;
  };
}

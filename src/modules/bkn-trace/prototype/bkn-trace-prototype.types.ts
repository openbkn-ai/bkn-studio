/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type TraceTool =
  | "list_knowledge_networks"
  | "query_object_instance"
  | "run_sql"
  | "search_schema";

export type ObjectBinding =
  | "deterministic-resource-binding"
  | "direct-object-query"
  | "network-context";

export interface TraceOperationSnapshot {
  id: string;
  requestId?: string;
  operationId?: string;
  tool: TraceTool;
  businessLabel: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "completed";
  targetObjectId?: string;
  resourceId?: string;
  condition?: string;
  fields?: string[];
  sql?: string;
  resultSummary: string;
}

export interface TraceInteractionSnapshot {
  id: string;
  question: string;
  answerSummary: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  operations: TraceOperationSnapshot[];
}

export interface BknObjectSnapshot {
  id: string;
  name: string;
  resourceIds: string[];
}

export interface BknRelationSnapshot {
  id: string;
  name: string;
  sourceObjectId: string;
  targetObjectId: string;
  mappingSummary: string;
}

export interface BknTracePrototypeFixture {
  conversationId: string;
  agentName: string;
  network: { id: string; name: string };
  explorationCandidateCount: number;
  interactions: TraceInteractionSnapshot[];
  objects: BknObjectSnapshot[];
  relations: BknRelationSnapshot[];
  observedRelationIds: string[];
}

export interface ProjectedObject extends BknObjectSnapshot {
  binding: ObjectBinding;
  operationIds: string[];
}

export interface ProjectedRelation extends BknRelationSnapshot {
  state: "network-context" | "observed";
}

export interface KnowledgeNetworkProjection {
  observedObjects: ProjectedObject[];
  relations: ProjectedRelation[];
  explorationCandidateCount: number;
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

const TRACE_API_PREFIX = "/agent-observability/v1/traces";
const OBSERVABILITY_API_PREFIX = "/agent-observability/v1";

export type VisibilitySummary = {
  authorizedRefCount: number;
  hiddenRefCount: number;
  omittedRefCount: number;
  redactedRefCount: number;
  unauthorizedRefCount: number;
  unresolvedRefCount: number;
};

export type TraceGraphNode = {
  durationNano: number;
  endNano: number;
  errorMessage?: string;
  kind: string;
  name: string;
  parentSpanId?: string;
  serviceName?: string;
  spanId: string;
  startNano: number;
  status: string;
};

export type TraceGraphEdge = {
  childSpanId: string;
  edgeType: string;
  id: string;
  parentSpanId: string;
};

type ExplainabilityFieldValue = boolean | number | string | null | undefined;

export type TraceClaim = {
  claim_hash?: ExplainabilityFieldValue;
  claim_id?: ExplainabilityFieldValue;
  claim_type?: ExplainabilityFieldValue;
  operation?: ExplainabilityFieldValue;
  subject_refs?: {
    entity_kind?: ExplainabilityFieldValue;
    model_name?: ExplainabilityFieldValue;
    operation?: ExplainabilityFieldValue;
    query_hash?: ExplainabilityFieldValue;
    resource_id?: ExplainabilityFieldValue;
    status?: ExplainabilityFieldValue;
    [key: string]: unknown;
  };
  version_status?: ExplainabilityFieldValue;
  visibility?: ExplainabilityFieldValue;
  [key: string]: unknown;
};

export type TraceEvidenceRef = {
  ref_id?: ExplainabilityFieldValue;
  ref_type?: ExplainabilityFieldValue;
  source_system?: ExplainabilityFieldValue;
  summary?: {
    catalog_id?: ExplainabilityFieldValue;
    id?: ExplainabilityFieldValue;
    kind?: ExplainabilityFieldValue;
    message_hash?: ExplainabilityFieldValue;
    model_name?: ExplainabilityFieldValue;
    model_provider?: ExplainabilityFieldValue;
    resource_id?: ExplainabilityFieldValue;
    result_hash?: ExplainabilityFieldValue;
    row_hash?: ExplainabilityFieldValue;
    status?: ExplainabilityFieldValue;
    version_status?: ExplainabilityFieldValue;
    [key: string]: unknown;
  };
  summary_hash?: ExplainabilityFieldValue;
  validity?: ExplainabilityFieldValue;
  version_status?: ExplainabilityFieldValue;
  visibility?: ExplainabilityFieldValue;
  [key: string]: unknown;
};

export type TraceBusinessRef = Record<string, unknown>;

export type BusinessStoryStage = "action" | "claim" | "evidence" | "execution" | "intent";

export type TraceBusinessDisplay = {
  businessPath?: string[];
  controlledSummary?: string;
  name?: string;
  resolutionStatus?: string;
  sourceVersion?: string;
};

export type TraceBusinessNode = {
  actionId?: string;
  claimId?: string;
  display?: TraceBusinessDisplay;
  eventId?: string;
  id: string;
  interactionId?: string;
  label?: string;
  nodeType: string;
  operationId?: string;
  properties: Record<string, unknown>;
  stage?: BusinessStoryStage;
  versionStatus?: string;
  visibility?: string;
};

export type TraceBusinessEdge = {
  edgeType: string;
  id: string;
  sourceId: string;
  targetId: string;
  visibility?: string;
};

export type GraphPage = {
  edgeCount: number;
  nodeCount: number;
  truncated: boolean;
};

export type TraceGraph = {
  data: {
    edges: TraceGraphEdge[];
    nodes: TraceGraphNode[];
  };
  durationNano: number;
  page: GraphPage;
  partial: boolean;
  partialReason: string[];
  status: string;
  traceId: string;
};

export type EvidenceChain = {
  data: {
    artifactLinks: TraceArtifactLink[];
    businessRefs: TraceBusinessRef[];
    claims: TraceClaim[];
    evidenceRefs: TraceEvidenceRef[];
  };
  page: GraphPage;
  partial: boolean;
  partialReason: string[];
  requestId: string;
  traceId: string;
  visibilitySummary: VisibilitySummary;
};

export type TraceArtifactLink = {
  artifactRef: string;
  artifactType: string;
  claimId?: string;
  eventId: string;
  eventType: string;
  operationId?: string;
  role: string;
};

export type BusinessGraph = {
  data: {
    edges: TraceBusinessEdge[];
    nodes: TraceBusinessNode[];
  };
  page: GraphPage;
  partial: boolean;
  partialReason: string[];
  requestId: string;
  traceId: string;
  visibilitySummary: VisibilitySummary;
};

export type SnapshotPreview = {
  manifest: Record<string, unknown>;
  partial: boolean;
  partialReason: string[];
  requestId: string;
  snapshotRef: {
    mode: string;
    snapshotId?: string;
    uri?: string;
  };
  traceId: string;
  visibilitySummary: VisibilitySummary;
};

export type ActionSummary = {
  approved: number;
  completed: number;
  executed: number;
  lastStatus?: string;
  recommended: number;
};

export type RequestSummary = {
  actionSummary: ActionSummary;
  agentOrApp?: string;
  businessDomain?: string;
  businessRefs: string[];
  completedAt?: string;
  conversationId?: string;
  durationMs?: number;
  errorSummary?: string;
  evidenceCompleteness: string;
  initiator?: string;
  interactionId?: string;
  knowledgeNetworks: string[];
  partialReasons: string[];
  questionPreview?: string;
  requestId: string;
  resultPreview?: string;
  startedAt?: string;
  status: string;
  traceCount: number;
};

export type TraceExecutionSummary = {
  agentOrApp?: string;
  businessDomain?: string;
  completedAt?: string;
  conversationId?: string;
  durationMs?: number;
  errorSummary?: string;
  interactionId?: string;
  requestId: string;
  rootOperation?: string;
  spanCount: number;
  startedAt?: string;
  status: string;
  traceId: string;
};

export type SummaryPage<T> = {
  entries: T[];
  nextCursor?: string;
  partial: boolean;
  partialReasons: string[];
  total: number;
  truncated: boolean;
};

export type InteractionSummary = {
  completedAt?: string;
  conversationId?: string;
  durationMs?: number;
  interactionId: string;
  requests: RequestSummary[];
  startedAt?: string;
  status: string;
  traces: TraceExecutionSummary[];
};

export type TraceAccessProfile = {
  accessScopeFingerprint: string;
	allowedLogCategories: string[];
  businessProvenanceManagedNetworks: boolean;
  businessProvenanceOwn: boolean;
  globalLogSearch: boolean;
	logExport: boolean;
	logPolicyRead: boolean;
	logSensitiveFields: boolean;
  managementAudit: boolean;
  securityAudit: boolean;
  technicalTrace: boolean;
};

type BackendTraceAccessProfile = {
  access_scope_fingerprint?: string;
	allowed_log_categories?: string[];
  business_provenance_managed_networks?: boolean;
  business_provenance_own?: boolean;
  global_log_search?: boolean;
	log_export?: boolean;
	log_policy_read?: boolean;
	log_sensitive_fields?: boolean;
  management_audit?: boolean;
  security_audit?: boolean;
  technical_trace?: boolean;
};

export type RequestSummaryQuery = {
  agentOrApp?: string;
  businessDomain?: string;
  conversationId?: string;
  cursor?: string;
  evidenceCompleteness?: string;
  from?: string;
  interactionId?: string;
  keyword?: string;
  knowledgeNetwork?: string;
  limit?: number;
  status?: string;
  to?: string;
};

export type EvidenceArtifact = {
  accountId: string;
  accountType: string;
  agentOrApp?: string;
  artifactId: string;
  artifactType: string;
  businessDomain?: string;
  businessRefs: string[];
  claimId?: string;
  content: unknown;
  contentHash: string;
  contentType: string;
  interactionId?: string;
  observedAt: string;
  operationId?: string;
  requestId: string;
  schemaVersion: string;
  snapshotRef?: string;
  sourceRef?: string;
  sourceVersion?: string;
  traceId?: string;
};

export type TraceQueryScope =
  | { limit?: number; requestId: string; traceId?: never }
  | { limit?: number; requestId?: never; traceId: string };

type BackendVisibilitySummary = {
  authorized_ref_count?: number;
  hidden_ref_count?: number;
  omitted_ref_count?: number;
  redacted_ref_count?: number;
  unauthorized_ref_count?: number;
  unresolved_ref_count?: number;
};

type BackendGraphPage = {
  edge_count?: number;
  node_count?: number;
  truncated?: boolean;
};

type BackendTraceGraph = {
  data?: {
    edges?: Array<{
      child_span_id?: string;
      edge_type?: string;
      id?: string;
      parent_span_id?: string;
    }>;
    nodes?: Array<{
      duration_nano?: number;
      end_nano?: number;
      error_message?: string;
      kind?: string;
      name?: string;
      parent_span_id?: string;
      service_name?: string;
      span_id?: string;
      start_nano?: number;
      status?: string;
    }>;
  };
  duration_nano?: number;
  page?: BackendGraphPage;
  partial?: boolean;
  partial_reason?: string[];
  status?: string;
  trace_id?: string;
};

type BackendEvidenceChain = {
  "bkn.request.id"?: string;
  data?: {
    artifact_links?: Array<{
      artifact_ref?: string;
      artifact_type?: string;
      claim_id?: string;
      event_id?: string;
      event_type?: string;
      operation_id?: string;
      role?: string;
    }>;
    business_refs?: TraceBusinessRef[];
    claims?: TraceClaim[];
    evidence_refs?: TraceEvidenceRef[];
  };
  page?: BackendGraphPage;
  partial?: boolean;
  partial_reason?: string[];
  trace_id?: string;
  visibility_summary?: BackendVisibilitySummary;
};

type BackendBusinessGraph = {
  "bkn.request.id"?: string;
  data?: {
    edges?: Array<{
      edge_type?: string;
      id?: string;
      source_id?: string;
      target_id?: string;
      visibility?: string;
    }>;
    nodes?: Array<{
      action_instance_id?: string;
      claim_id?: string;
      display?: {
        business_path?: string[];
        controlled_summary?: string;
        name?: string;
        resolution_status?: string;
        source_version?: string;
      };
      event_id?: string;
      id?: string;
      interaction_id?: string;
      label?: string;
      node_type?: string;
      operation_id?: string;
      properties?: Record<string, unknown>;
      stage?: BusinessStoryStage;
      version_status?: string;
      visibility?: string;
    }>;
  };
  page?: BackendGraphPage;
  partial?: boolean;
  partial_reason?: string[];
  trace_id?: string;
  visibility_summary?: BackendVisibilitySummary;
};

type BackendSnapshotPreview = {
  "bkn.request.id"?: string;
  manifest?: Record<string, unknown>;
  partial?: boolean;
  partial_reason?: string[];
  snapshot_ref?: {
    mode?: string;
    snapshot_id?: string;
    uri?: string;
  };
  trace_id?: string;
  visibility_summary?: BackendVisibilitySummary;
};

type BackendActionSummary = {
  approved?: number;
  completed?: number;
  executed?: number;
  last_status?: string;
  recommended?: number;
};

type BackendRequestSummary = {
  action_summary?: BackendActionSummary;
  agent_or_app?: string;
  business_domain?: string;
  business_refs?: string[];
  completed_at?: string;
  conversation_id?: string;
  duration_ms?: number;
  error_summary?: string;
  evidence_completeness?: string;
  initiator?: string;
  interaction_id?: string;
  knowledge_networks?: string[];
  partial_reasons?: string[];
  question_preview?: string;
  request_id?: string;
  result_preview?: string;
  started_at?: string;
  status?: string;
  trace_count?: number;
};

type BackendTraceExecutionSummary = {
  agent_or_app?: string;
  business_domain?: string;
  completed_at?: string;
  conversation_id?: string;
  duration_ms?: number;
  error_summary?: string;
  interaction_id?: string;
  request_id?: string;
  root_operation?: string;
  span_count?: number;
  started_at?: string;
  status?: string;
  trace_id?: string;
};

type BackendSummaryPage<T> = {
  entries?: T[];
  next_cursor?: string | null;
  partial?: boolean;
  partial_reasons?: string[];
  total?: number;
  truncated?: boolean;
};

type BackendInteractionSummary = {
  completed_at?: string;
  conversation_id?: string;
  duration_ms?: number;
  interaction_id?: string;
  requests?: BackendRequestSummary[];
  started_at?: string;
  status?: string;
  traces?: BackendTraceExecutionSummary[];
};

type BackendEvidenceArtifact = {
  "bkn.account.id"?: string;
  "bkn.account.type"?: string;
  "bkn.request.id"?: string;
  agent_or_app?: string;
  artifact_id?: string;
  artifact_type?: string;
  business_domain?: string;
  business_refs?: string[];
  claim_id?: string;
  content?: unknown;
  content_hash?: string;
  content_type?: string;
  interaction_id?: string;
  observed_at?: string;
  operation_id?: string;
  schema_version?: string;
  snapshot_ref?: string;
  source_ref?: string;
  source_version?: string;
  trace_id?: string;
};

export async function getAccessProfile(): Promise<TraceAccessProfile> {
  const response = await http.get<BackendTraceAccessProfile>(
    `${OBSERVABILITY_API_PREFIX}/access-profile`,
    { headers: traceHeaders() },
  );
  return {
    accessScopeFingerprint: response.data.access_scope_fingerprint ?? "",
	allowedLogCategories: response.data.allowed_log_categories ?? [],
    businessProvenanceManagedNetworks: Boolean(response.data.business_provenance_managed_networks),
    businessProvenanceOwn: Boolean(response.data.business_provenance_own),
    globalLogSearch: Boolean(response.data.global_log_search),
	logExport: Boolean(response.data.log_export),
	logPolicyRead: Boolean(response.data.log_policy_read),
	logSensitiveFields: Boolean(response.data.log_sensitive_fields),
    managementAudit: Boolean(response.data.management_audit),
    securityAudit: Boolean(response.data.security_audit),
    technicalTrace: Boolean(response.data.technical_trace),
  };
}

export async function getTraceGraph(traceId: string): Promise<TraceGraph> {
  const response = await http.get<BackendTraceGraph>(
    `${TRACE_API_PREFIX}/${encodeURIComponent(traceId)}/trace-graph`,
    { ...traceRequestConfig(), skipErrorToast: true },
  );
  return mapTraceGraph(response.data);
}

export async function getEvidenceChain(scope: TraceQueryScope): Promise<EvidenceChain> {
  const response = await http.get<BackendEvidenceChain>(targetPath(scope, "evidence-chain"), {
    headers: traceHeaders(),
    params: targetParams(scope),
  });
  return mapEvidenceChain(response.data);
}

export async function getBusinessGraph(scope: TraceQueryScope): Promise<BusinessGraph> {
  const response = await http.get<BackendBusinessGraph>(targetPath(scope, "business-graph"), {
    headers: traceHeaders(),
    params: targetParams(scope),
  });
  return mapBusinessGraph(response.data);
}

export async function getSnapshotPreview(scope: TraceQueryScope): Promise<SnapshotPreview> {
  const response = await http.get<BackendSnapshotPreview>(targetPath(scope, "snapshot-preview"), {
    headers: traceHeaders(),
    params: targetParams(scope),
  });
  return mapSnapshotPreview(response.data);
}

export async function getRequestSummaries(
  query: RequestSummaryQuery = {},
): Promise<SummaryPage<RequestSummary>> {
  const response = await http.get<BackendSummaryPage<BackendRequestSummary>>(
    `${OBSERVABILITY_API_PREFIX}/requests`,
    { headers: traceHeaders(), params: summaryParams(query) },
  );
  return mapSummaryPage(response.data, mapRequestSummary);
}

export async function getRequestSummary(requestId: string): Promise<RequestSummary> {
  const response = await http.get<BackendRequestSummary>(
    `${OBSERVABILITY_API_PREFIX}/requests/${encodeURIComponent(requestId)}`,
    traceRequestConfig(),
  );
  return mapRequestSummary(response.data);
}

export async function getInteractionSummary(
  interactionId: string,
): Promise<InteractionSummary> {
  const response = await http.get<BackendInteractionSummary>(
    `${OBSERVABILITY_API_PREFIX}/interactions/${encodeURIComponent(interactionId)}`,
    traceRequestConfig(),
  );
  return {
    completedAt: response.data.completed_at,
    conversationId: response.data.conversation_id,
    durationMs: response.data.duration_ms,
    interactionId: response.data.interaction_id ?? "",
    requests: (response.data.requests ?? []).map(mapRequestSummary),
    startedAt: response.data.started_at,
    status: response.data.status ?? "unknown",
    traces: (response.data.traces ?? []).map(mapTraceExecutionSummary),
  };
}

export async function getRequestTraces(
  requestId: string,
  query: Pick<RequestSummaryQuery, "cursor" | "limit"> = {},
): Promise<SummaryPage<TraceExecutionSummary>> {
  const response = await http.get<BackendSummaryPage<BackendTraceExecutionSummary>>(
    `${OBSERVABILITY_API_PREFIX}/requests/${encodeURIComponent(requestId)}/traces`,
    { headers: traceHeaders(), params: summaryParams(query) },
  );
  return mapSummaryPage(response.data, mapTraceExecutionSummary);
}

export async function getEvidenceArtifact(artifactId: string): Promise<EvidenceArtifact> {
  const response = await http.get<BackendEvidenceArtifact>(
    `${OBSERVABILITY_API_PREFIX}/evidence/artifacts/${encodeURIComponent(artifactId)}`,
    traceRequestConfig(),
  );
  return mapEvidenceArtifact(response.data);
}

function traceHeaders() {
  return {
    "x-business-domain": getRuntimeConfig().currentUser.businessDomainId ?? "bd_public",
  };
}

function traceRequestConfig() {
  return { headers: traceHeaders() };
}

function targetPath(
  scope: TraceQueryScope,
  subresource: "business-graph" | "evidence-chain" | "snapshot-preview",
) {
  if (scope.traceId) {
    return `${TRACE_API_PREFIX}/${encodeURIComponent(scope.traceId)}/${subresource}`;
  }
  return subresource === "evidence-chain"
    ? `${TRACE_API_PREFIX}/by-request`
    : `${TRACE_API_PREFIX}/by-request/${subresource}`;
}

function targetParams(scope: TraceQueryScope) {
  const params: Record<string, number | string> = {};
  if (scope.requestId) {
    params.request_id = scope.requestId;
  }
  if (scope.limit !== undefined) {
    params.limit = scope.limit;
  }
  return Object.keys(params).length ? params : undefined;
}

function summaryParams(query: RequestSummaryQuery) {
  const params: Record<string, number | string> = {};
  if (query.limit !== undefined) params.limit = query.limit;
  if (query.cursor) params.cursor = query.cursor;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.status) params.status = query.status;
  if (query.agentOrApp) params.agent_or_app = query.agentOrApp;
  if (query.businessDomain) params.business_domain = query.businessDomain;
  if (query.conversationId) params.conversation_id = query.conversationId;
  if (query.interactionId) params.interaction_id = query.interactionId;
  if (query.knowledgeNetwork) params.knowledge_network = query.knowledgeNetwork;
  if (query.evidenceCompleteness) {
    params.evidence_completeness = query.evidenceCompleteness;
  }
  if (query.keyword) params.keyword = query.keyword;
  return Object.keys(params).length ? params : undefined;
}

function mapSummaryPage<TBackend, T>(
  data: BackendSummaryPage<TBackend>,
  mapEntry: (entry: TBackend) => T,
): SummaryPage<T> {
  return {
    entries: (data.entries ?? []).map(mapEntry),
    nextCursor: data.next_cursor ?? undefined,
    partial: Boolean(data.partial),
    partialReasons: data.partial_reasons ?? [],
    total: data.total ?? 0,
    truncated: Boolean(data.truncated),
  };
}

function mapActionSummary(data?: BackendActionSummary): ActionSummary {
  return {
    approved: data?.approved ?? 0,
    completed: data?.completed ?? 0,
    executed: data?.executed ?? 0,
    lastStatus: data?.last_status,
    recommended: data?.recommended ?? 0,
  };
}

function mapRequestSummary(data: BackendRequestSummary): RequestSummary {
  return {
    actionSummary: mapActionSummary(data.action_summary),
    agentOrApp: data.agent_or_app,
    businessDomain: data.business_domain,
    businessRefs: data.business_refs ?? [],
    completedAt: data.completed_at,
    conversationId: data.conversation_id,
    durationMs: data.duration_ms,
    errorSummary: data.error_summary,
    evidenceCompleteness: data.evidence_completeness ?? "content_unavailable",
    initiator: data.initiator,
    interactionId: data.interaction_id,
    knowledgeNetworks: data.knowledge_networks ?? [],
    partialReasons: data.partial_reasons ?? [],
    questionPreview: data.question_preview,
    requestId: data.request_id ?? "",
    resultPreview: data.result_preview,
    startedAt: data.started_at,
    status: data.status ?? "unknown",
    traceCount: data.trace_count ?? 0,
  };
}

function mapTraceExecutionSummary(data: BackendTraceExecutionSummary): TraceExecutionSummary {
  return {
    agentOrApp: data.agent_or_app,
    businessDomain: data.business_domain,
    completedAt: data.completed_at,
    conversationId: data.conversation_id,
    durationMs: data.duration_ms,
    errorSummary: data.error_summary,
    interactionId: data.interaction_id,
    requestId: data.request_id ?? "",
    rootOperation: data.root_operation,
    spanCount: data.span_count ?? 0,
    startedAt: data.started_at,
    status: data.status ?? "unknown",
    traceId: data.trace_id ?? "",
  };
}

function mapEvidenceArtifact(data: BackendEvidenceArtifact): EvidenceArtifact {
  return {
    accountId: data["bkn.account.id"] ?? "",
    accountType: data["bkn.account.type"] ?? "",
    agentOrApp: data.agent_or_app,
    artifactId: data.artifact_id ?? "",
    artifactType: data.artifact_type ?? "",
    businessDomain: data.business_domain,
    businessRefs: data.business_refs ?? [],
    claimId: data.claim_id,
    content: data.content,
    contentHash: data.content_hash ?? "",
    contentType: data.content_type ?? "",
    interactionId: data.interaction_id,
    observedAt: data.observed_at ?? "",
    operationId: data.operation_id,
    requestId: data["bkn.request.id"] ?? "",
    schemaVersion: data.schema_version ?? "",
    snapshotRef: data.snapshot_ref,
    sourceRef: data.source_ref,
    sourceVersion: data.source_version,
    traceId: data.trace_id,
  };
}

function mapPage(page?: BackendGraphPage): GraphPage {
  return {
    edgeCount: page?.edge_count ?? 0,
    nodeCount: page?.node_count ?? 0,
    truncated: Boolean(page?.truncated),
  };
}

function mapVisibility(summary?: BackendVisibilitySummary): VisibilitySummary {
  return {
    authorizedRefCount: summary?.authorized_ref_count ?? 0,
    hiddenRefCount: summary?.hidden_ref_count ?? 0,
    omittedRefCount: summary?.omitted_ref_count ?? 0,
    redactedRefCount: summary?.redacted_ref_count ?? 0,
    unauthorizedRefCount: summary?.unauthorized_ref_count ?? 0,
    unresolvedRefCount: summary?.unresolved_ref_count ?? 0,
  };
}

function mapTraceGraph(data: BackendTraceGraph): TraceGraph {
  return {
    data: {
      edges: (data.data?.edges ?? []).map((edge) => ({
        childSpanId: edge.child_span_id ?? "",
        edgeType: edge.edge_type ?? "",
        id: edge.id ?? "",
        parentSpanId: edge.parent_span_id ?? "",
      })),
      nodes: (data.data?.nodes ?? []).map((node) => ({
        durationNano: node.duration_nano ?? 0,
        endNano: node.end_nano ?? 0,
        errorMessage: node.error_message,
        kind: node.kind ?? "",
        name: node.name ?? "",
        parentSpanId: node.parent_span_id,
        serviceName: node.service_name,
        spanId: node.span_id ?? "",
        startNano: node.start_nano ?? 0,
        status: node.status ?? "ok",
      })),
    },
    durationNano: data.duration_nano ?? 0,
    page: mapPage(data.page),
    partial: Boolean(data.partial),
    partialReason: data.partial_reason ?? [],
    status: data.status ?? "unknown",
    traceId: data.trace_id ?? "",
  };
}

function mapEvidenceChain(data: BackendEvidenceChain): EvidenceChain {
  return {
    data: {
      artifactLinks: (data.data?.artifact_links ?? []).map((link) => ({
        artifactRef: link.artifact_ref ?? "",
        artifactType: link.artifact_type ?? "",
        claimId: link.claim_id,
        eventId: link.event_id ?? "",
        eventType: link.event_type ?? "",
        operationId: link.operation_id,
        role: link.role ?? "",
      })),
      businessRefs: data.data?.business_refs ?? [],
      claims: data.data?.claims ?? [],
      evidenceRefs: data.data?.evidence_refs ?? [],
    },
    page: mapPage(data.page),
    partial: Boolean(data.partial),
    partialReason: data.partial_reason ?? [],
    requestId: data["bkn.request.id"] ?? "",
    traceId: data.trace_id ?? "",
    visibilitySummary: mapVisibility(data.visibility_summary),
  };
}

function mapBusinessGraph(data: BackendBusinessGraph): BusinessGraph {
  return {
    data: {
      edges: (data.data?.edges ?? []).map((edge) => ({
        edgeType: edge.edge_type ?? "",
        id: edge.id ?? "",
        sourceId: edge.source_id ?? "",
        targetId: edge.target_id ?? "",
        visibility: edge.visibility,
      })),
      nodes: (data.data?.nodes ?? []).map((node) => ({
        actionId: node.action_instance_id,
        claimId: node.claim_id,
        display: node.display ? {
          businessPath: node.display.business_path,
          controlledSummary: node.display.controlled_summary,
          name: node.display.name,
          resolutionStatus: node.display.resolution_status,
          sourceVersion: node.display.source_version,
        } : undefined,
        eventId: node.event_id,
        id: node.id ?? "",
        interactionId: node.interaction_id,
        label: node.label,
        nodeType: node.node_type ?? "business_ref",
        operationId: node.operation_id,
        properties: node.properties ?? {},
        stage: node.stage,
        versionStatus: node.version_status,
        visibility: node.visibility,
      })),
    },
    page: mapPage(data.page),
    partial: Boolean(data.partial),
    partialReason: data.partial_reason ?? [],
    requestId: data["bkn.request.id"] ?? "",
    traceId: data.trace_id ?? "",
    visibilitySummary: mapVisibility(data.visibility_summary),
  };
}

function mapSnapshotPreview(data: BackendSnapshotPreview): SnapshotPreview {
  return {
    manifest: data.manifest ?? {},
    partial: Boolean(data.partial),
    partialReason: data.partial_reason ?? [],
    requestId: data["bkn.request.id"] ?? "",
    snapshotRef: {
      mode: data.snapshot_ref?.mode ?? "preview",
      snapshotId: data.snapshot_ref?.snapshot_id,
      uri: data.snapshot_ref?.uri,
    },
    traceId: data.trace_id ?? "",
    visibilitySummary: mapVisibility(data.visibility_summary),
  };
}

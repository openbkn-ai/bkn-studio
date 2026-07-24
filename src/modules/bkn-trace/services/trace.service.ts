/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

const TRACE_API_PREFIX = "/agent-observability/v1/traces";

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
    businessRefs: Array<Record<string, unknown>>;
    claims: Array<Record<string, unknown>>;
    evidenceRefs: Array<Record<string, unknown>>;
  };
  page: GraphPage;
  partial: boolean;
  partialReason: string[];
  requestId: string;
  traceId: string;
  visibilitySummary: VisibilitySummary;
};

export type BusinessGraph = {
  data: {
    edges: Array<Record<string, unknown>>;
    nodes: Array<Record<string, unknown>>;
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
    business_refs?: Array<Record<string, unknown>>;
    claims?: Array<Record<string, unknown>>;
    evidence_refs?: Array<Record<string, unknown>>;
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
    edges?: Array<Record<string, unknown>>;
    nodes?: Array<Record<string, unknown>>;
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

export async function getTraceGraph(traceId: string): Promise<TraceGraph> {
  const response = await http.get<BackendTraceGraph>(
    `${TRACE_API_PREFIX}/${encodeURIComponent(traceId)}/trace-graph`,
  );
  return mapTraceGraph(response.data);
}

export async function getEvidenceChain(scope: TraceQueryScope): Promise<EvidenceChain> {
  const response = await http.get<BackendEvidenceChain>(targetPath(scope, "evidence-chain"), {
    params: targetParams(scope),
  });
  return mapEvidenceChain(response.data);
}

export async function getBusinessGraph(scope: TraceQueryScope): Promise<BusinessGraph> {
  const response = await http.get<BackendBusinessGraph>(targetPath(scope, "business-graph"), {
    params: targetParams(scope),
  });
  return mapBusinessGraph(response.data);
}

export async function getSnapshotPreview(scope: TraceQueryScope): Promise<SnapshotPreview> {
  const response = await http.get<BackendSnapshotPreview>(targetPath(scope, "snapshot-preview"), {
    params: targetParams(scope),
  });
  return mapSnapshotPreview(response.data);
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
      edges: data.data?.edges ?? [],
      nodes: data.data?.nodes ?? [],
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

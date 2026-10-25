/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type {
  OperationCallFact,
  OperationReceipt,
  PayloadEnvelope,
} from "@/modules/bkn-trace/shared/operation-fact.types";
import type {
  RootServiceOptions,
  RootServiceOptionsQuery,
  TechnicalSpanNode,
  TechnicalSpanPage,
  SpanDisplayRange,
  TechnicalTraceDetail,
  TechnicalTraceGraph,
  TechnicalTraceOperation,
  TechnicalTracePage,
  TechnicalTraceQuery,
  TechnicalTraceSummary,
} from "@/modules/bkn-trace/trace-analysis/trace-analysis.types";

const TRACE_API_PREFIX = "/agent-observability/v1/traces";
const ARTIFACT_API_PREFIX = "/agent-observability/v1/evidence/artifacts";

type BackendPayloadEnvelope = {
  byte_length?: number;
  inline?: unknown;
  media_type?: string;
  mode?: "inline" | "omitted" | "referenced";
  omitted_reason?: string;
  ref?: string;
};

type BackendOperationCallFact = {
  attempt?: number;
  conversation_id?: string;
  error?: BackendPayloadEnvelope;
  finished_at?: string;
  input?: BackendPayloadEnvelope;
  interaction_id?: string;
  operation_id?: string;
  output?: BackendPayloadEnvelope;
  parent_operation_id?: string;
  protocol?: string;
  receipt_id?: string;
  request_id?: string;
  retryable?: boolean;
  source_module?: string;
  span_id?: string;
  started_at?: string;
  status?: string;
  tool_name?: string;
  trace_id?: string;
};

type BackendReceipt = {
  partial_reasons?: string[];
  receipt_id?: string;
  receipt_status?: string;
};

type BackendTraceSummary = {
  agent_name?: string;
  agent_or_app?: string;
  completed_at?: string;
  duration_ms?: number;
  error_summary?: string;
  question_preview?: string;
  request_id?: string;
  result_preview?: string;
  root_service?: string;
  root_operation?: string;
  span_count?: number;
  span_count_status?: string;
  started_at?: string;
  status?: string;
  trace_id?: string;
};

type BackendTracePage = {
  entries?: BackendTraceSummary[];
  next_cursor?: string | null;
  page?: number;
  page_size?: number;
  partial?: boolean;
  partial_reasons?: string[];
  total?: number;
  truncated?: boolean;
};

type BackendSpanNode = {
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
};

type BackendTraceDetail = {
  span_display?: {
    loaded_count: number;
    display_limit: number;
    raw_record_limit: number;
    raw_record_count: number;
    total_count: number | null;
    total_accuracy: SpanDisplayRange["totalAccuracy"];
    sort: SpanDisplayRange["sort"];
    truncated: boolean;
    first_start_at: string | null;
    last_start_at: string | null;
    browse_allowed: boolean;
    browse_reason?: string;
  };
  graph?: {
    data?: {
      nodes?: BackendSpanNode[];
    };
    partial?: boolean;
    partial_reason?: string[];
  };
  operations?: Array<{
    fact?: BackendOperationCallFact;
    partial_reasons?: string[];
    receipt?: BackendReceipt;
    state?: string;
  }>;
  partial?: boolean;
  partial_reasons?: string[];
  summary?: BackendTraceSummary;
};

export async function listTechnicalTraces(
  query: TechnicalTraceQuery = {},
): Promise<TechnicalTracePage> {
  const response = await http.get<BackendTracePage>(TRACE_API_PREFIX, {
    params: traceQueryParams(query),
  });
  return {
    entries: (response.data.entries ?? []).map(mapTraceSummary),
    nextCursor: response.data.next_cursor ?? undefined,
    page: response.data.page,
    pageSize: response.data.page_size,
    partial: Boolean(response.data.partial),
    partialReasons: response.data.partial_reasons ?? [],
    total: response.data.total ?? 0,
    truncated: Boolean(response.data.truncated),
  };
}

export async function getTechnicalTrace(traceId: string): Promise<TechnicalTraceDetail> {
  const response = await http.get<BackendTraceDetail>(
    `${TRACE_API_PREFIX}/${encodeURIComponent(traceId)}`,
    { skipErrorToast: true },
  );
  const graph = response.data.graph ? mapTraceGraph(response.data.graph) : undefined;
  return {
    ...(response.data.span_display
      ? {
          spanDisplay: {
            loadedCount: response.data.span_display.loaded_count,
            displayLimit: response.data.span_display.display_limit,
            rawRecordLimit: response.data.span_display.raw_record_limit,
            rawRecordCount: response.data.span_display.raw_record_count,
            totalCount: response.data.span_display.total_count,
            totalAccuracy: response.data.span_display.total_accuracy,
            sort: response.data.span_display.sort,
            truncated: response.data.span_display.truncated,
            firstStartAt: response.data.span_display.first_start_at,
            lastStartAt: response.data.span_display.last_start_at,
            browseAllowed: response.data.span_display.browse_allowed,
            browseReason: response.data.span_display.browse_reason,
          },
        }
      : {}),
    graph,
    operations: (response.data.operations ?? []).map(mapOperation),
    partial: Boolean(response.data.partial || graph?.partial),
    partialReasons: [
      ...new Set([...(response.data.partial_reasons ?? []), ...(graph?.partialReasons ?? [])]),
    ],
    summary: mapTraceSummary(response.data.summary ?? {}),
  };
}

export async function listTechnicalSpans(
  traceId: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<TechnicalSpanPage> {
  const response = await http.get<{
    trace_id: string;
    entries?: BackendSpanNode[] | null;
    has_more: boolean;
    next_cursor?: string;
    sort: "span_id_asc";
    consistency: "live";
  }>(`${TRACE_API_PREFIX}/${encodeURIComponent(traceId)}/spans`, {
    ...(cursor ? { params: { cursor } } : {}),
    signal,
    skipErrorToast: true,
  });
  return {
    traceId: response.data.trace_id,
    entries: (response.data.entries ?? []).map(mapSpanNode),
    hasMore: response.data.has_more,
    nextCursor: response.data.next_cursor,
    sort: response.data.sort,
    consistency: response.data.consistency,
  };
}

export async function getReferencedPayload(ref: string, interactionId: string): Promise<unknown> {
  const artifactId = ref.startsWith("artifact:") ? ref.slice("artifact:".length) : "";
  if (!artifactId) throw new Error("invalid referenced payload");
  const response = await http.get<{ content?: unknown }>(
    `${ARTIFACT_API_PREFIX}/${encodeURIComponent(artifactId)}`,
    {
      params: { interaction_id: interactionId },
      skipErrorToast: true,
    },
  );
  return response.data.content;
}

function traceQueryParams(query: TechnicalTraceQuery): Record<string, number | string> {
  const params: Record<string, number | string> = {};
  if (query.limit !== undefined) params.limit = query.limit;
  if (query.page !== undefined) params.page = query.page;
  if (query.pageSize !== undefined) params.page_size = query.pageSize;
  if (query.cursor) params.cursor = query.cursor;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.status) params.status = query.status;
  if (query.service) params.service = query.service;
  if (query.tool) params.tool = query.tool;
  if (query.traceId) params.trace_id = query.traceId;
  if (query.errorKeyword) params.error_keyword = query.errorKeyword;
  return params;
}

function mapTraceSummary(data: BackendTraceSummary): TechnicalTraceSummary {
  return {
    agentName: data.agent_name,
    agentOrApp: data.agent_or_app,
    completedAt: data.completed_at,
    durationMs: data.duration_ms,
    errorSummary: data.error_summary,
    questionPreview: data.question_preview,
    requestId: data.request_id,
    resultPreview: data.result_preview,
    rootService: data.root_service,
    rootOperation: data.root_operation,
    spanCount: data.span_count ?? 0,
    spanCountStatus: data.span_count_status,
    startedAt: data.started_at,
    status: data.status ?? "unknown",
    traceId: data.trace_id ?? "",
  };
}

function mapPayload(data: BackendPayloadEnvelope | undefined): PayloadEnvelope | undefined {
  if (!data) return undefined;
  return {
    byteLength: data.byte_length ?? 0,
    inline: data.inline,
    mediaType: data.media_type ?? "application/json",
    mode: data.mode ?? "omitted",
    omittedReason: data.omitted_reason,
    ref: data.ref,
  };
}

function mapOperationFact(data: BackendOperationCallFact): OperationCallFact {
  return {
    attempt: data.attempt ?? 0,
    conversationId: data.conversation_id ?? "",
    error: mapPayload(data.error),
    finishedAt: data.finished_at,
    input: mapPayload(data.input) ?? {
      byteLength: 0,
      mediaType: "application/json",
      mode: "omitted",
      omittedReason: "not_recorded",
    },
    interactionId: data.interaction_id ?? "",
    operationId: data.operation_id ?? "",
    output: mapPayload(data.output),
    parentOperationId: data.parent_operation_id,
    protocol: data.protocol ?? "",
    receiptId: data.receipt_id,
    requestId: data.request_id,
    retryable: Boolean(data.retryable),
    sourceModule: data.source_module ?? "",
    spanId: data.span_id,
    startedAt: data.started_at ?? "",
    status: data.status ?? "unknown",
    toolName: data.tool_name ?? "",
    traceId: data.trace_id,
  };
}

function mapReceipt(data: BackendReceipt | undefined): OperationReceipt {
  return {
    partialReasons: data?.partial_reasons ?? [],
    receiptId: data?.receipt_id ?? "",
    receiptStatus: data?.receipt_status ?? "unknown",
  };
}

function mapOperation(
  data: NonNullable<BackendTraceDetail["operations"]>[number],
): TechnicalTraceOperation {
  return {
    fact: mapOperationFact(data.fact ?? {}),
    partialReasons: data.partial_reasons ?? [],
    receipt: mapReceipt(data.receipt),
    state: data.state ?? "unknown",
  };
}

function mapTraceGraph(data: NonNullable<BackendTraceDetail["graph"]>): TechnicalTraceGraph {
  return {
    nodes: (data.data?.nodes ?? []).map(mapSpanNode),
    partial: Boolean(data.partial),
    partialReasons: data.partial_reason ?? [],
  };
}

function mapSpanNode(data: BackendSpanNode): TechnicalSpanNode {
  return {
    durationNano: data.duration_nano ?? 0,
    endNano: data.end_nano ?? 0,
    errorMessage: data.error_message,
    kind: data.kind ?? "",
    name: data.name ?? "",
    parentSpanId: data.parent_span_id,
    serviceName: data.service_name,
    spanId: data.span_id ?? "",
    startNano: data.start_nano ?? 0,
    status: data.status ?? "unknown",
  };
}

export async function listRootServices(
  query: RootServiceOptionsQuery = {},
  signal?: AbortSignal,
): Promise<RootServiceOptions> {
  const { data } = await http.get<{ entries: string[]; has_more: boolean }>(
    "/agent-observability/v1/trace-root-services",
    {
      params: {
        from: query.from,
        to: query.to,
        trace_id: query.traceId,
        status: query.status,
        tool: query.tool,
        error_keyword: query.errorKeyword,
        q: query.q,
        limit: 100,
      },
      signal,
      skipErrorToast: true,
    },
  );
  return { entries: data.entries.map((entry) => entry), hasMore: data.has_more };
}

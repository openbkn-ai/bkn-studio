/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

const OBSERVABILITY_API_PREFIX = "/observability/v1";

export type LogCategory =
  | "access.user"
  | "audit.admin"
  | "audit.security"
  | "runtime.business"
  | "runtime.model"
  | "runtime.system";

type BackendLogRecord = {
  application_id?: string;
  attributes?: Record<string, unknown>;
  business_domain_id?: string;
  conversation_id?: string;
  deployment_environment: string;
  event_name: string;
  event_timestamp: string;
  interaction_id?: string;
  log_category: LogCategory;
  log_id: string;
  observed_timestamp: string;
  operation_id?: string;
  outcome: string;
  request_id?: string;
  safe_summary: string;
  service_name: string;
  severity_number: number;
  severity_text: string;
  source_id: string;
  span_id?: string;
  trace_id?: string;
};

export type LogRecord = {
  applicationId?: string;
  attributes: Record<string, unknown>;
  businessDomain?: string;
  category: LogCategory;
  conversationId?: string;
  environment: string;
  eventName: string;
  eventTimestamp: string;
  interactionId?: string;
  logId: string;
  observedTimestamp: string;
  operationId?: string;
  outcome: string;
  requestId?: string;
  serviceName: string;
  severityNumber: number;
  severityText: string;
  sourceId: string;
  spanId?: string;
  summary: string;
  traceId?: string;
};

export type LogSourceStatus = {
  collectionMethod?: string;
  countAccuracy?: string;
  coveredModules: string[];
  reason?: string;
  reliability: string;
  sourceId: string;
  status: string;
};

export type LogPolicy = {
  category: LogCategory;
  legalHold: boolean;
  policyKind: "audit" | "runtime";
  policyRevision: string;
  readOnly: true;
  retentionDays: number;
  scope: Record<string, unknown>;
  storageTargetRef?: string;
};

export type LogListQuery = {
  categories?: LogCategory[];
  cursor?: string;
  failedOnly?: boolean;
  limit?: number;
  query?: string;
  requestId?: string;
  services?: string[];
  traceId?: string;
};

type BackendSourceStatus = {
  collection_method?: string;
  count_accuracy?: string;
  covered_modules?: string[];
  reason?: string;
  reliability: string;
  source_id: string;
  status: string;
};

type BackendLogPolicy = {
  category: LogCategory;
  legal_hold?: boolean;
  policy_kind: "audit" | "runtime";
  policy_revision: string;
  retention_days: number;
  scope: Record<string, unknown>;
  storage_target_ref?: string;
};

type BackendLogList = {
  count: { accuracy: string; value: number | null };
  data: BackendLogRecord[];
  next_cursor: string | null;
  partial: boolean;
  source_status: BackendSourceStatus[];
};

export type LogListResult = {
  count: { accuracy: string; value: number | null };
  data: LogRecord[];
  nextCursor?: string;
  partial: boolean;
  sourceStatus: LogSourceStatus[];
};

export type LogDetailResult = {
  data: LogRecord;
  policyRevision: string;
  redactedFields: string[];
  relatedTraceIds: string[];
};

export type LogFacet = "deployment_environment" | "event_name" | "log_category" | "service_name" | "severity_text";

export type LogFacetResult = {
  data: Array<{ count: number; value: string }>;
  partial: boolean;
  sourceStatus: LogSourceStatus[];
};

export async function listLogs(query: LogListQuery): Promise<LogListResult> {
	const params = logQueryParams(query);

  const response = await http.get<BackendLogList>(`${OBSERVABILITY_API_PREFIX}/logs`, {
    headers: observabilityHeaders(),
    params,
    skipErrorToast: true,
  });
  return {
    count: response.data.count,
    data: response.data.data.map(mapLogRecord),
    ...(response.data.next_cursor ? { nextCursor: response.data.next_cursor } : {}),
    partial: response.data.partial,
    sourceStatus: response.data.source_status.map(mapSourceStatus),
  };
}

export async function getLogDetail(logId: string): Promise<LogDetailResult> {
  const response = await http.get<{
    data: BackendLogRecord;
    field_projection: { policy_revision: string; redacted_fields: string[] };
    request_trace_context: { related_trace_ids?: string[] };
  }>(`${OBSERVABILITY_API_PREFIX}/logs/${encodeURIComponent(logId)}`, {
    headers: observabilityHeaders(),
    skipErrorToast: true,
  });
  return {
    data: mapLogRecord(response.data.data),
    policyRevision: response.data.field_projection.policy_revision,
    redactedFields: response.data.field_projection.redacted_fields,
    relatedTraceIds: response.data.request_trace_context.related_trace_ids ?? [],
  };
}

export async function listLogFacets(facet: LogFacet, query: LogListQuery = {}): Promise<LogFacetResult> {
  const response = await http.get<{
    data: Array<{ count: number; value: string }>;
    partial: boolean;
    source_status: BackendSourceStatus[];
  }>(`${OBSERVABILITY_API_PREFIX}/log-facets`, {
    headers: observabilityHeaders(),
    params: { ...logQueryParams(query), facet },
    skipErrorToast: true,
  });
  return {
    data: response.data.data,
    partial: response.data.partial,
    sourceStatus: response.data.source_status.map(mapSourceStatus),
  };
}

export async function listLogSources(): Promise<LogSourceStatus[]> {
  const response = await http.get<{ data: BackendSourceStatus[] }>(`${OBSERVABILITY_API_PREFIX}/log-sources`, {
    headers: observabilityHeaders(),
    skipErrorToast: true,
  });
  return response.data.data.map(mapSourceStatus);
}

export async function listLogPolicies(): Promise<LogPolicy[]> {
  const response = await http.get<{ data: BackendLogPolicy[] }>(`${OBSERVABILITY_API_PREFIX}/log-policies`, {
    headers: observabilityHeaders(),
    skipErrorToast: true,
  });
  return response.data.data.map((policy) => ({
    category: policy.category,
    legalHold: Boolean(policy.legal_hold),
    policyKind: policy.policy_kind,
    policyRevision: policy.policy_revision,
    readOnly: true,
    retentionDays: policy.retention_days,
    scope: policy.scope,
    ...(policy.storage_target_ref ? { storageTargetRef: policy.storage_target_ref } : {}),
  }));
}

function mapLogRecord(record: BackendLogRecord): LogRecord {
  return {
    ...(record.application_id ? { applicationId: record.application_id } : {}),
    attributes: record.attributes ?? {},
    ...(record.business_domain_id ? { businessDomain: record.business_domain_id } : {}),
    category: record.log_category,
    ...(record.conversation_id ? { conversationId: record.conversation_id } : {}),
    environment: record.deployment_environment,
    eventName: record.event_name,
    eventTimestamp: record.event_timestamp,
    ...(record.interaction_id ? { interactionId: record.interaction_id } : {}),
    logId: record.log_id,
    observedTimestamp: record.observed_timestamp,
    ...(record.operation_id ? { operationId: record.operation_id } : {}),
    outcome: record.outcome,
    ...(record.request_id ? { requestId: record.request_id } : {}),
    serviceName: record.service_name,
    severityNumber: record.severity_number,
    severityText: record.severity_text,
    sourceId: record.source_id,
    ...(record.span_id ? { spanId: record.span_id } : {}),
    summary: record.safe_summary,
    ...(record.trace_id ? { traceId: record.trace_id } : {}),
  };
}

function mapSourceStatus(source: BackendSourceStatus): LogSourceStatus {
  return {
    ...(source.collection_method ? { collectionMethod: source.collection_method } : {}),
    ...(source.count_accuracy ? { countAccuracy: source.count_accuracy } : {}),
    coveredModules: source.covered_modules ?? [],
    ...(source.reason ? { reason: source.reason } : {}),
    reliability: source.reliability,
    sourceId: source.source_id,
    status: source.status,
  };
}

function logQueryParams(query: LogListQuery) {
  const params: Record<string, boolean | number | string | string[]> = {};
  if (query.categories?.length) params.categories = query.categories;
  if (query.cursor) params.cursor = query.cursor;
  if (query.failedOnly !== undefined) params.failed_only = query.failedOnly;
  if (query.limit !== undefined) params.limit = query.limit;
  if (query.query) params.q = query.query;
  if (query.requestId) params.request_id = query.requestId;
  if (query.services?.length) params.services = query.services;
  if (query.traceId) params.trace_id = query.traceId;
  return params;
}

function observabilityHeaders() {
  return {
    "x-business-domain": getRuntimeConfig().currentUser.businessDomainId ?? "bd_public",
  };
}

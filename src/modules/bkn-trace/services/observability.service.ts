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
  actor_id: string;
  actor_name_snapshot: string;
  actor_type?: "service_account" | "user";
  auth_method: "api_key" | "oauth" | "password" | "session" | "unknown";
  business_domain_id?: string;
  credential_id?: string;
  credential_name?: string;
  event_id: string;
  event_name: string;
  event_time: string;
  failure_code?: string;
  failure_message?: string;
  facts: {
    action: string;
    business_context?: string;
    client_ip?: string;
    detail?: Record<string, unknown>;
    method?: string;
    operation_status?: string;
    operation_type?: string;
    status_code?: number;
    target_id: string;
    target_name_snapshot: string;
    target_type: string;
  };
  correlation: {
    conversation_id?: string;
    interaction_id?: string;
    operation_id?: string;
    request_id?: string;
    task_id?: string;
    trace_id?: string;
  };
  business_module: BusinessModule;
  log_category: LogCategory;
  outcome: AuditOutcome;
  recorded_at: string;
  source_channel: SourceChannel;
  source_id: string;
  attributes: Record<string, unknown>;
};

export type AuditOutcome = "canceled" | "denied" | "failure" | "success" | "unknown";

export type BusinessModule =
  | "domain_knowledge_network"
  | "observability"
  | "execution_factory"
  | "data_resource_knowledge_network"
  | "model_management"
  | "system_management";

export type SourceChannel = "api" | "cli" | "mcp" | "sdk" | "studio";

export type LogFacts = {
  action: string;
  businessContext?: string;
  clientIp?: string;
  detail?: Record<string, unknown>;
  method?: string;
  operationStatus?: string;
  operationType?: string;
  statusCode?: number;
  targetId: string;
  targetNameSnapshot: string;
  targetType: string;
};

export type LogRecord = {
  action: string;
  actor: { id: string; name: string; type: "service_account" | "user" };
  authMethod: BackendLogRecord["auth_method"];
  businessDomain?: string;
  conversationId?: string;
  credential?: { id: string; name?: string };
  eventId: string;
  eventName: string;
  eventTime: string;
  failure?: { code: string; message?: string };
  interactionId?: string;
  facts: LogFacts;
  logCategory: LogCategory;
  businessModule: BusinessModule;
  operationId?: string;
  outcome: AuditOutcome;
  recordedAt: string;
  requestId?: string;
  sourceChannel: SourceChannel;
  sourceId: string;
  target: { id: string; name: string; type: string };
  taskId?: string;
  traceId?: string;
  attributes: Record<string, unknown>;
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
  action?: string;
  actorId?: string;
  categories?: LogCategory[];
  conversationId?: string;
  cursor?: string;
  limit?: number;
  businessModule?: BusinessModule;
  outcomes?: AuditOutcome[];
  page?: number;
  pageSize?: number;
  query?: string;
  requestId?: string;
  targetId?: string;
  targetType?: string;
  timeFrom?: string;
  timeTo?: string;
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
	pagination?: { page?: number; page_size?: number };
  source_status: BackendSourceStatus[];
};

export type LogListResult = {
  count: { accuracy: string; value: number | null };
  data: LogRecord[];
  nextCursor?: string;
  partial: boolean;
	page?: number;
	pageSize?: number;
  sourceStatus: LogSourceStatus[];
};

export type LogDetailResult = {
  data: LogRecord;
  policyRevision: string;
  redactedFields: string[];
  relatedTraceIds: string[];
};

export async function listLogs(query: LogListQuery): Promise<LogListResult> {
	const params = logQueryParams(query);

  const response = await http.get<BackendLogList>(`${OBSERVABILITY_API_PREFIX}/logs`, {
    headers: observabilityHeaders(),
    params,
    // The Log Query contract uses repeated keys (`outcomes=failure&outcomes=denied`).
    // Axios otherwise emits `outcomes[]=...`, which the Go handler deliberately
    // does not interpret and would silently turn the UI filter into an unfiltered query.
    paramsSerializer: { indexes: null },
    skipErrorToast: true,
  });
  return {
    count: response.data.count,
    data: response.data.data.map(mapLogRecord),
    ...(response.data.next_cursor ? { nextCursor: response.data.next_cursor } : {}),
    partial: response.data.partial,
	page: response.data.pagination?.page ?? 1,
	pageSize: response.data.pagination?.page_size ?? query.pageSize ?? query.limit ?? 50,
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
    action: record.facts.action,
    actor: {
      id: record.actor_id,
      name: record.actor_name_snapshot,
      type: record.actor_type ?? "user",
    },
    authMethod: record.auth_method,
    ...(record.business_domain_id ? { businessDomain: record.business_domain_id } : {}),
    ...(record.correlation.conversation_id ? { conversationId: record.correlation.conversation_id } : {}),
    ...(record.credential_id ? {
      credential: { id: record.credential_id, ...(record.credential_name ? { name: record.credential_name } : {}) },
    } : {}),
    eventId: record.event_id,
    eventName: record.event_name,
    eventTime: record.event_time,
    ...(record.failure_code ? {
      failure: { code: record.failure_code, ...(record.failure_message ? { message: record.failure_message } : {}) },
    } : {}),
    facts: {
      action: record.facts.action, targetId: record.facts.target_id,
      targetNameSnapshot: record.facts.target_name_snapshot, targetType: record.facts.target_type,
      ...(record.facts.business_context ? { businessContext: record.facts.business_context } : {}),
      ...(record.facts.client_ip ? { clientIp: record.facts.client_ip } : {}),
      ...(record.facts.detail ? { detail: record.facts.detail } : {}),
      ...(record.facts.method ? { method: record.facts.method } : {}),
      ...(record.facts.operation_status ? { operationStatus: record.facts.operation_status } : {}),
      ...(record.facts.operation_type ? { operationType: record.facts.operation_type } : {}),
      ...(record.facts.status_code !== undefined ? { statusCode: record.facts.status_code } : {}),
    },
    logCategory: record.log_category,
    ...(record.correlation.interaction_id ? { interactionId: record.correlation.interaction_id } : {}),
    businessModule: record.business_module,
    ...(record.correlation.operation_id ? { operationId: record.correlation.operation_id } : {}),
    outcome: record.outcome,
    recordedAt: record.recorded_at,
    ...(record.correlation.request_id ? { requestId: record.correlation.request_id } : {}),
    sourceChannel: record.source_channel,
    sourceId: record.source_id,
    target: { id: record.facts.target_id, name: record.facts.target_name_snapshot, type: record.facts.target_type },
    ...(record.correlation.task_id ? { taskId: record.correlation.task_id } : {}),
    ...(record.correlation.trace_id ? { traceId: record.correlation.trace_id } : {}),
    attributes: record.attributes,
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
  if (query.action) params.action = query.action;
  if (query.actorId) params.actor_id = query.actorId;
  if (query.categories?.length) params.categories = query.categories;
  if (query.conversationId) params.conversation_id = query.conversationId;
  if (query.cursor) params.cursor = query.cursor;
  if (query.limit !== undefined) params.limit = query.limit;
  if (query.businessModule) params.business_module = query.businessModule;
  if (query.outcomes?.length) params.outcomes = query.outcomes;
  if (query.page !== undefined) params.page = query.page;
  if (query.pageSize !== undefined) params.page_size = query.pageSize;
  if (query.query) params.q = query.query;
  if (query.requestId) params.request_id = query.requestId;
  if (query.targetId) params.target_id = query.targetId;
  if (query.targetType) params.target_type = query.targetType;
  if (query.timeFrom) params.time_from = query.timeFrom;
  if (query.timeTo) params.time_to = query.timeTo;
  if (query.traceId) params.trace_id = query.traceId;
  return params;
}

function observabilityHeaders() {
  return {
    "x-business-domain": getRuntimeConfig().currentUser.businessDomainId ?? "bd_public",
  };
}

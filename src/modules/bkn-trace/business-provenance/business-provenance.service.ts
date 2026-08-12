/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";
import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

const EE_PROVENANCE_PREFIX = "/agent-observability/v1/business-provenance";

export class BusinessProvenanceAnalysisError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "BusinessProvenanceAnalysisError";
  }
}

export type BusinessProvenanceQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  agentOrApp?: string;
  businessDomain?: string;
  knowledgeNetwork?: string;
  evidenceCompleteness?: string;
  conversationId?: string;
};

export type BusinessProvenanceConversation = {
  conversationId: string;
  agentName?: string;
  questionPreview?: string;
  resultPreview?: string;
  startedAt?: string;
  status?: string;
  interactionCount?: number;
  durationMs?: number;
};

export type BusinessProvenanceInteractionListItem = {
  interactionId: string;
  conversationId?: string;
  questionPreview?: string;
  resultPreview?: string;
  startedAt?: string;
  status?: string;
  durationMs?: number;
};

export type BusinessProvenancePage<T> = { entries: T[]; total: number; page?: number; pageSize?: number };

export type BusinessProvenanceAnalysisHistory = {
  analysisId: string;
  interactionId: string;
  agentId: string;
  status: "running" | "completed" | "failed";
  result?: Record<string, unknown>;
  failureCode?: string;
  failureMessage?: string;
  startedAt: string;
  finishedAt?: string;
};

export type OperationResolution = {
  operationId: string;
  attempt?: number;
  toolName?: string;
  knowledgeNetworkId?: string;
  status?: "resolved" | "ambiguous" | "unresolved" | "not_evaluable";
	callStatus?: string; protocol?: string; startedAt?: string; finishedAt?: string; durationMs?: number;
	input?: unknown; output?: unknown; error?: unknown;
  query?: { sql?: string; resourceIds?: string[]; resources?: Array<{ id: string; name?: string; objectId?: string; objectName?: string }>; conditions?: unknown; resultCount?: number };
  objects?: Array<{ id: string; name?: string }>;
  elements: Array<{ kind: string; id: string; name?: string; parentId?: string; field?: string }>;
  missingFacts: string[];
};

export type BusinessProvenanceDerivedFact = {
  rule: string;
  sourceOperationId: string;
  operationId: string;
  elementId: string;
};

export type BusinessProvenanceInteraction = {
  interactionId: string;
  operations: OperationResolution[];
  conversationContext: Array<{ knowledgeNetworkId: string; sourceInteractionId: string; sourceOperationId: string }>;
  derivedFacts: BusinessProvenanceDerivedFact[];
  contextRelations: Array<{ knowledgeNetworkId: string; id: string; name?: string; sourceObjectId: string; targetObjectId: string }>;
};

type BackendConversation = {
  conversation_id?: string;
  agent_name?: string;
  question_preview?: string;
  result_preview?: string;
  started_at?: string;
  status?: string;
  interaction_count?: number;
  duration_ms?: number;
};

export async function getBusinessProvenanceConversations(
  query: BusinessProvenanceQuery = {},
): Promise<BusinessProvenancePage<BusinessProvenanceConversation>> {
  const response = await http.get<{ entries?: BackendConversation[]; total?: number; page?: number; page_size?: number }>(
    `${EE_PROVENANCE_PREFIX}/conversations`,
    { headers: provenanceHeaders(), params: provenanceParams(query) },
  );
  return {
    entries: (response.data.entries ?? []).map((entry) => ({
      conversationId: entry.conversation_id ?? "", agentName: entry.agent_name,
      questionPreview: entry.question_preview, resultPreview: entry.result_preview,
      startedAt: entry.started_at, status: entry.status, interactionCount: entry.interaction_count,
      durationMs: entry.duration_ms,
    })),
    total: response.data.total ?? 0, page: response.data.page, pageSize: response.data.page_size,
  };
}

export async function getBusinessProvenanceInteractions(
  query: BusinessProvenanceQuery,
): Promise<BusinessProvenancePage<BusinessProvenanceInteractionListItem>> {
  const response = await http.get<{ entries?: Array<{
    interaction_id?: string; conversation_id?: string; question_preview?: string; result_preview?: string;
    started_at?: string; status?: string; duration_ms?: number;
  }>; total?: number; page?: number; page_size?: number }>(
    `${EE_PROVENANCE_PREFIX}/interactions`,
    { headers: provenanceHeaders(), params: provenanceParams(query) },
  );
  return {
    entries: (response.data.entries ?? []).map((entry) => ({
      interactionId: entry.interaction_id ?? "", conversationId: entry.conversation_id,
      questionPreview: entry.question_preview, resultPreview: entry.result_preview,
      startedAt: entry.started_at, status: entry.status, durationMs: entry.duration_ms,
    })),
    total: response.data.total ?? 0, page: response.data.page, pageSize: response.data.page_size,
  };
}

export async function getBusinessProvenanceInteraction(interactionId: string): Promise<BusinessProvenanceInteraction> {
  const response = await http.get<{
    interaction_id?: string;
    conversation_context?: Array<{ knowledge_network_id?: string; source_interaction_id?: string; source_operation_id?: string }>;
    derived_facts?: Array<{ rule?: string; source_operation_id?: string; operation_id?: string; element_id?: string }>;
    context_relations?: Array<{ knowledge_network_id?: string; id?: string; name?: string; source_object_id?: string; target_object_id?: string }>;
    operations?: Array<{
      operation_id?: string; attempt?: number; tool_name?: string; knowledge_network_id?: string;
      status?: OperationResolution["status"]; call_status?: string; protocol?: string; started_at?: string; finished_at?: string; duration_ms?: number; input?: unknown; output?: unknown; error?: unknown; query?: { sql?: string; resource_ids?: string[]; resources?: Array<{ id?: string; name?: string; object_id?: string; object_name?: string }>; conditions?: unknown; result_count?: number }; objects?: Array<{ id?: string; name?: string }>; elements?: Array<{ kind?: string; id?: string; name?: string; parent_id?: string; field?: string }>; missing_facts?: string[];
    }>;
  }>(`${EE_PROVENANCE_PREFIX}/interactions/${encodeURIComponent(interactionId)}`, { headers: provenanceHeaders() });
  return {
    interactionId: response.data.interaction_id ?? interactionId,
    conversationContext: (response.data.conversation_context ?? []).map((context) => ({ knowledgeNetworkId: context.knowledge_network_id ?? "", sourceInteractionId: context.source_interaction_id ?? "", sourceOperationId: context.source_operation_id ?? "" })),
    derivedFacts: (response.data.derived_facts ?? []).map((fact) => ({ rule: fact.rule ?? "", sourceOperationId: fact.source_operation_id ?? "", operationId: fact.operation_id ?? "", elementId: fact.element_id ?? "" })),
    contextRelations: (response.data.context_relations ?? []).map((relation) => ({ knowledgeNetworkId: relation.knowledge_network_id ?? "", id: relation.id ?? "", name: relation.name, sourceObjectId: relation.source_object_id ?? "", targetObjectId: relation.target_object_id ?? "" })),
    operations: (response.data.operations ?? []).map((operation) => ({
      operationId: operation.operation_id ?? "", attempt: operation.attempt, toolName: operation.tool_name,
      knowledgeNetworkId: operation.knowledge_network_id, status: operation.status,
      callStatus: operation.call_status, protocol: operation.protocol, startedAt: operation.started_at, finishedAt: operation.finished_at, durationMs: operation.duration_ms, input: operation.input, output: operation.output, error: operation.error, query: operation.query ? { sql: operation.query.sql, resourceIds: operation.query.resource_ids, resources: operation.query.resources?.map((resource) => ({ id: resource.id ?? "", name: resource.name, objectId: resource.object_id, objectName: resource.object_name })), conditions: operation.query.conditions, resultCount: operation.query.result_count } : undefined,
      objects: (operation.objects ?? []).map((object) => ({ id: object.id ?? "", name: object.name })),
      elements: (operation.elements ?? []).map((element) => ({ kind: element.kind ?? "", id: element.id ?? "", name: element.name, parentId: element.parent_id, field: element.field })), missingFacts: operation.missing_facts ?? [],
    })),
  };
}

export async function getBusinessProvenanceMarkdown(interactionId: string): Promise<string> {
  const response = await http.get<string>(
    `${EE_PROVENANCE_PREFIX}/interactions/${encodeURIComponent(interactionId)}/markdown`,
    { headers: provenanceHeaders(), responseType: "text" },
  );
  return response.data;
}

// The browser submits the reviewed process-fact Markdown, but no Agent
// selection, prompt template, or tool configuration.
export async function streamBusinessProvenanceAnalysis(
  interactionId: string,
  markdown: string,
  onToken?: (text: string) => void,
): Promise<Record<string, unknown>> {
  const runtime = getRuntimeConfig();
  const request = async (token: string | null) => fetch(
    `${runtime.apiBaseUrl}${EE_PROVENANCE_PREFIX}/interactions/${encodeURIComponent(interactionId)}/analysis`,
    {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "x-business-domain": runtime.currentUser.businessDomainId ?? "bd_public",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ markdown }),
    },
  );
  let response = await request(runtime.auth.tokenManager.getAccessToken());
  if (response.status === 401) {
    response = await request(await runtime.auth.tokenManager.refreshAccessToken());
  }
  if (!response.ok) {
    throw await analysisFetchError(response);
  }
  if (!response.body) {
    throw new BusinessProvenanceAnalysisError(i18n.t("bknTrace.businessProvenance.workspace.agent.streamMissing"), "analysis_invalid_result");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Record<string, unknown> | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = parseSSEFrame(frame);
      if (!event) continue;
      if (event.name === "token" && typeof event.data.content === "string") onToken?.(event.data.content);
      if (event.name === "structured" && isRecord(event.data.content)) result = event.data.content;
      if (event.name === "error") {
        throw new BusinessProvenanceAnalysisError(
          typeof event.data.message === "string" ? event.data.message : i18n.t("bknTrace.businessProvenance.workspace.agent.failed"),
          typeof event.data.code === "string" ? event.data.code : "analysis_agent_failed",
        );
      }
    }
    if (done) break;
  }
  if (!result) {
    throw new BusinessProvenanceAnalysisError(i18n.t("bknTrace.businessProvenance.workspace.agent.resultMissing"), "analysis_empty_result");
  }
  return result;
}

export async function getBusinessProvenanceAnalysisHistory(interactionId: string): Promise<BusinessProvenanceAnalysisHistory[]> {
  const response = await http.get<{ entries?: Array<{
    analysis_id?: string; interaction_id?: string; agent_id?: string; status?: string;
    result?: Record<string, unknown>; failure_code?: string; failure_message?: string; started_at?: string; finished_at?: string;
  }> }>(`${EE_PROVENANCE_PREFIX}/interactions/${encodeURIComponent(interactionId)}/analysis`, { headers: provenanceHeaders() });
  return (response.data.entries ?? []).map((entry) => ({
    analysisId: entry.analysis_id ?? "", interactionId: entry.interaction_id ?? interactionId,
    agentId: entry.agent_id ?? "", status: entry.status === "completed" || entry.status === "failed" ? entry.status : "running",
    result: entry.result, failureCode: entry.failure_code, failureMessage: entry.failure_message,
    startedAt: entry.started_at ?? "", finishedAt: entry.finished_at,
  }));
}

function parseSSEFrame(frame: string): { name: string; data: Record<string, unknown> } | undefined {
  let name = "message";
  const data: string[] = [];
  frame.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trim());
  });
  if (!data.length) return undefined;
  try {
    const parsed: unknown = JSON.parse(data.join("\n"));
    return isRecord(parsed) ? { name, data: parsed } : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function analysisFetchError(response: Response): Promise<BusinessProvenanceAnalysisError> {
  try {
    const payload = await response.json() as { error?: { code?: string; message?: string; status_code?: number } };
    return new BusinessProvenanceAnalysisError(payload.error?.message || i18n.t("bknTrace.businessProvenance.workspace.agent.httpFailure", { status: response.status }), payload.error?.code, payload.error?.status_code ?? response.status);
  } catch {
    return new BusinessProvenanceAnalysisError(i18n.t("bknTrace.businessProvenance.workspace.agent.httpFailure", { status: response.status }), "analysis_transport", response.status);
  }
}

function provenanceHeaders() {
  return { "x-business-domain": getRuntimeConfig().currentUser.businessDomainId ?? "bd_public" };
}

function provenanceParams(query: BusinessProvenanceQuery) {
  const params: Record<string, string | number> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.pageSize !== undefined) params.page_size = query.pageSize;
  if (query.keyword) params.keyword = query.keyword;
  if (query.status) params.status = query.status;
  if (query.agentOrApp) params.agent_or_app = query.agentOrApp;
  if (query.businessDomain) params.business_domain = query.businessDomain;
  if (query.knowledgeNetwork) params.knowledge_network = query.knowledgeNetwork;
  if (query.evidenceCompleteness) params.evidence_completeness = query.evidenceCompleteness;
  if (query.conversationId) params.conversation_id = query.conversationId;
  return Object.keys(params).length ? params : undefined;
}

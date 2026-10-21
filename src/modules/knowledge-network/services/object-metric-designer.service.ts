/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { makeAuthedFetch, type AgentTokenProvider } from "./agent-chat.service";
import { getExecution, newClientRequestId } from "./bkn-agent-execution.service";
import { objectMetricText } from "../lib/object-metric-text";
import type { ObjectMetricAiIntent } from "./object-metric-ai.service";

export const OBJECT_METRIC_DESIGN_PATH = "/api/bkn-agent/v1/metric-design/executions";

export type ObjectMetricDesignScope = {
  kn_id: string;
  owner_object_type_id: string;
  metric_type: "atomic" | "derived" | "composite";
  mode: "create" | "edit";
  metric_id?: string;
  draft_version?: number;
};

export type ObjectMetricDesignCandidates = {
  properties: Array<{ name: string; label: string; type?: string }>;
  published_metrics: Array<{
    id: string;
    version: number;
    name: string;
    type: "atomic" | "derived" | "composite";
    scope: "object_instance" | "object_set";
    object_type_id: string;
  }>;
};

export type ObjectMetricDesignChange = {
  field: string;
  operation: "replace";
  before: unknown;
  after: unknown;
  reason: string;
};

export type ObjectMetricDesignProposal = {
  kind: "metric_design_proposal";
  base_form_revision: string;
  summary: string;
  questions: string[];
  changes: ObjectMetricDesignChange[];
};

export type ObjectMetricDesignResult = {
  answer: string;
  proposal: ObjectMetricDesignProposal;
  runId: string;
  threadId: string;
};

export type ObjectMetricDesignDiagnostic = {
  kind: "validation" | "trial";
  form_revision: string;
  status:
    | "valid"
    | "invalid"
    | "ok"
    | "no_data"
    | "partial"
    | "unavailable"
    | "forbidden"
    | "invalid_request"
    | "failed";
  issues?: Array<{ code: string; field: string; message: string }>;
  warnings?: string[];
  output_shape?: string;
  physical_type?: string;
  unit_code?: string;
  entry_count?: number;
  overall_ms?: number;
};

export type RunObjectMetricDesignParams = {
  base: string;
  tokenProvider: AgentTokenProvider;
  scope: ObjectMetricDesignScope;
  formSnapshot: Record<string, unknown>;
  candidates: ObjectMetricDesignCandidates;
  baseFormRevision: string;
  message: string;
  diagnostic?: ObjectMetricDesignDiagnostic;
  threadId?: string;
  modelId?: string;
  signal?: AbortSignal;
  onText?: (text: string) => void;
};

const editableFields = new Set([
  "name",
  "description",
  "calculation_scope",
  "atomic.aggregation",
  "atomic.property_name",
  "atomic.expression",
  "derived.base_metric_id",
  "derived.base_metric_version",
  "derived.filters",
  "derived.event_time",
  "derived.time_window_mode",
  "derived.time_window_length",
  "derived.time_window_unit",
  "composite.dependencies",
  "composite.expression",
  "result.no_data_policy",
  "result.physical_type",
  "result.semantic_type",
  "result.unit_code",
  "result.unit_system",
  "result.quantity_kind",
  "query.analysis_dimensions",
  "query.group_by_dimensions",
  "query.time_dimensions",
  "query.time_granularity",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseProposal(
  value: unknown,
  revision: string,
  metricType: ObjectMetricDesignScope["metric_type"],
): ObjectMetricDesignProposal {
  const proposal = asRecord(value);
  if (
    proposal?.kind !== "metric_design_proposal" ||
    proposal.base_form_revision !== revision ||
    typeof proposal.summary !== "string" ||
    !Array.isArray(proposal.questions) ||
    !Array.isArray(proposal.changes) ||
    proposal.changes.length > 30
  ) {
    throw new Error(objectMetricText("aiDesignerInvalidProposal"));
  }
  const seen = new Set<string>();
  for (const rawChange of proposal.changes) {
    const change = asRecord(rawChange);
    const field = change?.field;
    if (
      typeof field !== "string" ||
      !editableFields.has(field) ||
      seen.has(field) ||
      change?.operation !== "replace" ||
      !("after" in change) ||
      typeof change.reason !== "string" ||
      (["atomic", "derived", "composite"] as const).some(
        (type) => field.startsWith(`${type}.`) && type !== metricType,
      )
    ) {
      throw new Error(objectMetricText("aiDesignerInvalidProposal"));
    }
    seen.add(field);
  }
  return proposal as ObjectMetricDesignProposal;
}

function parseFrame(frame: string): { name: string; data: Record<string, unknown> } | undefined {
  let name = "message";
  const lines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) lines.push(line.slice(5).replace(/^ /, ""));
  }
  if (!lines.length) return undefined;
  try {
    const data = asRecord(JSON.parse(lines.join("\n")));
    return data ? { name, data } : undefined;
  } catch {
    return undefined;
  }
}

async function responseError(response: Response): Promise<Error> {
  const text = await response.text().catch(() => "");
  let data: Record<string, unknown> | undefined;
  try {
    data = asRecord(JSON.parse(text));
  } catch {
    // Gateway errors may be plain text.
  }
  const detail = asRecord(data?.detail);
  const detailText = typeof data?.detail === "string" ? data.detail : undefined;
  return new Error(
    (typeof detail?.detail === "string" && detail.detail) ||
      (typeof detail?.description === "string" && detail.description) ||
      detailText ||
      (typeof data?.description === "string" && data.description) ||
      (typeof data?.message === "string" && data.message) ||
      objectMetricText("aiDesignerRequestFailed", { p0: response.status }),
  );
}

export async function runObjectMetricDesigner(
  params: RunObjectMetricDesignParams,
): Promise<ObjectMetricDesignResult> {
  const fetchFn = makeAuthedFetch(params.tokenProvider);
  const response = await fetchFn(`${params.base}${OBJECT_METRIC_DESIGN_PATH}`, {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_request_id: newClientRequestId(),
      ...(params.threadId ? { thread_id: params.threadId } : {}),
      ...(params.modelId ? { model_id: params.modelId } : {}),
      scope: params.scope,
      base_form_revision: params.baseFormRevision,
      form_snapshot: params.formSnapshot,
      candidates: params.candidates,
      ...(params.diagnostic ? { diagnostic: params.diagnostic } : {}),
      message: params.message,
    }),
    signal: params.signal,
  });
  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new Error(objectMetricText("aiDesignerMissingStream"));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let runId = "";
  let threadId = params.threadId ?? "";
  let answer = "";
  let proposal: ObjectMetricDesignProposal | undefined;
  let terminal: "succeeded" | "failed" | "cancelled" | undefined;
  let failure = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    const frames = buffer.split("\n\n");
    buffer = done ? "" : (frames.pop() ?? "");
    for (const frame of frames) {
      const parsed = parseFrame(frame);
      if (!parsed) continue;
      const { name, data } = parsed;
      if (name === "meta") {
        runId = typeof data.run_id === "string" ? data.run_id : runId;
        threadId = typeof data.thread_id === "string" ? data.thread_id : threadId;
      } else if (name === "token" && typeof data.content === "string") {
        params.onText?.(data.content);
      } else if (name === "proposal") {
        proposal = parseProposal(data.content, params.baseFormRevision, params.scope.metric_type);
      } else if (name === "result") {
        const content = asRecord(data.content);
        if (typeof content?.answer === "string") answer = content.answer;
        if (content?.proposal) {
          proposal = parseProposal(
            content.proposal,
            params.baseFormRevision,
            params.scope.metric_type,
          );
        }
      } else if (name === "terminal") {
        terminal =
          data.status === "succeeded" || data.status === "cancelled" ? data.status : "failed";
        failure =
          typeof asRecord(data.error)?.detail === "string"
            ? (asRecord(data.error)?.detail as string)
            : objectMetricText("aiDesignerExecutionFailed");
      }
    }
    if (done) break;
  }
  if (!terminal && runId) {
    const record = await getExecution({
      base: params.base,
      tokenProvider: params.tokenProvider,
      runId,
    });
    terminal =
      record.status === "succeeded" || record.status === "cancelled" ? record.status : "failed";
    const result = asRecord(record.result);
    if (typeof result?.answer === "string") answer = result.answer;
    if (result?.proposal) {
      proposal = parseProposal(result.proposal, params.baseFormRevision, params.scope.metric_type);
    }
    failure = record.error?.detail ?? failure;
  }
  if (terminal !== "succeeded")
    throw new Error(failure || objectMetricText("aiDesignerIncompleteTurn"));
  if (!proposal || !runId || !threadId)
    throw new Error(objectMetricText("aiDesignerIncompleteResult"));
  return { answer, proposal, runId, threadId };
}

export function proposalToObjectMetricAiIntent(
  proposal: ObjectMetricDesignProposal,
): ObjectMetricAiIntent {
  const intent: Record<string, unknown> = {};
  for (const change of proposal.changes) {
    const [section, field] = change.field.split(".");
    if (field) {
      const values = (intent[section] ?? {}) as Record<string, unknown>;
      values[field] = change.after;
      intent[section] = values;
    } else {
      intent[section] = change.after;
    }
  }
  return intent;
}

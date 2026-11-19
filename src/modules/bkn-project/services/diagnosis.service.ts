/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { extractRequestErrorDetails, isRequestNotFound } from "@/framework/request/error-message";
import type {
  Diagnosis,
  DiagnosisApply,
  DiagnosisSuggestion,
  DiagnosisSuggestionKind,
  WritebackRole,
} from "@/modules/bkn-project/types/diagnosis";

const API_PREFIX = "/bkn-project/v1/projects";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const diagnosisPath = (projectId: string) =>
  `${API_PREFIX}/${encodeURIComponent(projectId)}/ontology/diagnosis`;

type BackendApply = Record<string, unknown> | null;

type BackendSuggestion = {
  apply?: BackendApply;
  evidence?: {
    condition?: { field: string; value: string } | null;
    hits?: number;
    nulls?: number;
    quotes?: { document_id: string; text: string }[] | null;
    rate?: number;
    rows?: number;
    source_field?: string;
    target_field?: string;
  } | null;
  group: DiagnosisSuggestion["group"];
  id: string;
  impact?: { connects?: string[] | null; questions?: string[] | null } | null;
  kind: DiagnosisSuggestionKind;
  rank: number;
  reason?: string;
  status?: DiagnosisSuggestion["status"];
  title: string;
};

export type BackendDiagnosis = {
  components?: string[][] | null;
  computed_at?: number;
  draft_update_time?: number;
  error?: string;
  metrics?: {
    connectivity: { components: number; largest: number; objects: number };
    pending_concepts: number;
    reachability: { reachable: number; total: number };
    references: { covered: number; total: number };
  } | null;
  run_id?: string;
  stale?: boolean;
  state: Diagnosis["state"];
  suggestions?: BackendSuggestion[] | null;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const texts = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const records = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : [];

/** The apply payload as the page reads it, by the suggestion's kind; null when it has none. */
function mapApply(
  kind: DiagnosisSuggestionKind,
  apply: BackendApply | undefined,
): DiagnosisApply | null {
  if (!apply) {
    return null;
  }
  switch (kind) {
    case "adopt_relation":
      return { kind, relationTypeId: text(apply.relation_type_id) };
    case "create_relation":
      return {
        cardinality: text(apply.cardinality),
        description: text(apply.description),
        kind,
        mapping: records(apply.mapping).map((pair) => ({
          sourceProperty: text(pair.source_property),
          targetProperty: text(pair.target_property),
        })),
        name: text(apply.name),
        source: text(apply.source),
        target: text(apply.target),
      };
    case "adopt_object":
    case "exclude_object":
      return { kind, objectTypeId: text(apply.object_type_id) };
    case "choose_identity":
      return {
        candidates: Array.isArray(apply.candidates) ? apply.candidates.map(texts) : [],
        kind,
        objectTypeId: text(apply.object_type_id),
      };
    case "writeback_object":
      return {
        actions: records(apply.actions).map((action) => ({
          kind: action.kind === "modify" ? "modify" : "add",
          name: text(action.name),
          parameters: texts(action.parameters),
        })),
        description: text(apply.description),
        kind,
        name: text(apply.name),
        properties: records(apply.properties).map((property) => ({
          displayName: text(property.display_name),
          name: text(property.name),
          role: text(property.role) as WritebackRole,
          type: text(property.type),
        })),
        trackedObjectTypeId: text(apply.tracked_object_type_id),
      };
    case "concept_disposition":
      return {
        conceptId: text(apply.concept_id),
        disposition: text(apply.disposition) as "property" | "kinetic" | "not_ontology",
        kind,
        ...(apply.owner_object_type_id
          ? { ownerObjectTypeId: text(apply.owner_object_type_id) }
          : {}),
      };
    default:
      return null;
  }
}

export function mapSuggestion(item: BackendSuggestion): DiagnosisSuggestion {
  const evidence = item.evidence ?? {};
  return {
    apply: mapApply(item.kind, item.apply),
    evidence: {
      ...(evidence.condition ? { condition: evidence.condition } : {}),
      ...(evidence.hits !== undefined ? { hits: evidence.hits } : {}),
      ...(evidence.nulls !== undefined ? { nulls: evidence.nulls } : {}),
      quotes: (evidence.quotes ?? []).map((quote) => ({
        documentId: quote.document_id,
        text: quote.text,
      })),
      ...(evidence.rate !== undefined ? { rate: evidence.rate } : {}),
      ...(evidence.rows !== undefined ? { rows: evidence.rows } : {}),
      ...(evidence.source_field ? { sourceField: evidence.source_field } : {}),
      ...(evidence.target_field ? { targetField: evidence.target_field } : {}),
    },
    group: item.group,
    id: item.id,
    impact: {
      connects: item.impact?.connects ?? [],
      questions: item.impact?.questions ?? [],
    },
    kind: item.kind,
    rank: item.rank,
    reason: item.reason ?? "",
    status: item.status ?? "open",
    title: item.title,
  };
}

export function mapDiagnosis(data: BackendDiagnosis): Diagnosis {
  const metrics = data.metrics;
  return {
    components: data.components ?? [],
    computedAt: data.computed_at ?? 0,
    draftUpdateTime: data.draft_update_time ?? 0,
    error: data.error ?? "",
    metrics: metrics
      ? {
          connectivity: metrics.connectivity,
          pendingConcepts: metrics.pending_concepts,
          reachability: metrics.reachability,
          references: metrics.references,
        }
      : null,
    runId: data.run_id ?? "",
    stale: Boolean(data.stale),
    state: data.state,
    suggestions: [...(data.suggestions ?? [])]
      .sort((left, right) => left.rank - right.rank)
      .map(mapSuggestion),
  };
}

/**
 * The refusal code of a diagnosis request without bkn-project's prefix, such as
 * `Diagnosis.Running` or `Draft.Stale`; undefined for any other failure.
 */
export function diagnosisErrorCode(error: unknown): string | undefined {
  const { code } = extractRequestErrorDetails(error);
  const at = code ? Math.max(code.indexOf("Diagnosis."), code.indexOf("Draft.")) : -1;
  return code && at >= 0 ? code.slice(at) : undefined;
}

/** The diagnosis last run, or null when it was never run. */
export async function getDiagnosis(projectId: string): Promise<Diagnosis | null> {
  if (useMock) {
    return wait(readMockDiagnosis(projectId));
  }
  try {
    const response = await http.get<BackendDiagnosis>(diagnosisPath(projectId), {
      skipErrorToast: true,
    });
    return mapDiagnosis(response.data);
  } catch (error) {
    if (isRequestNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Starts diagnosing the draft in the background, as the project's owner; read it to follow. */
export async function runDiagnosis(projectId: string): Promise<{ runId: string }> {
  if (useMock) {
    mockRuns[projectId] = { reads: 0 };
    return wait({ runId: "mock-run" });
  }
  const response = await http.post<{ run_id?: string; state: string }>(
    `${diagnosisPath(projectId)}:run`,
    {},
    { skipErrorToast: true },
  );
  return { runId: response.data.run_id ?? "" };
}

/** Applies a suggestion to the draft made at `draftUpdateTime`; replies the draft's new time. */
export async function applySuggestion(
  projectId: string,
  suggestionId: string,
  draftUpdateTime: number,
): Promise<{ draftUpdateTime: number; suggestion: DiagnosisSuggestion }> {
  if (useMock) {
    const suggestion = settleMock(projectId, suggestionId, "applied");
    return wait({ draftUpdateTime, suggestion });
  }
  const response = await http.post<{ draft_update_time: number; suggestion: BackendSuggestion }>(
    `${diagnosisPath(projectId)}/suggestions/${encodeURIComponent(suggestionId)}:apply`,
    { draft_update_time: draftUpdateTime },
    { skipErrorToast: true },
  );
  return {
    draftUpdateTime: response.data.draft_update_time,
    suggestion: mapSuggestion(response.data.suggestion),
  };
}

/** Dismisses a suggestion, kept as a decision so the next diagnosis does not suggest it again. */
export async function dismissSuggestion(
  projectId: string,
  suggestionId: string,
  reason = "",
): Promise<void> {
  if (useMock) {
    settleMock(projectId, suggestionId, "dismissed");
    return wait(undefined);
  }
  await http.post(
    `${diagnosisPath(projectId)}/suggestions/${encodeURIComponent(suggestionId)}:dismiss`,
    reason.trim() ? { reason: reason.trim() } : {},
    { skipErrorToast: true },
  );
}

// Mock mode: a diagnosis of the mock draft, running for one read after it is started.

const wait = async <T>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

const mockRuns: Record<string, { reads: number }> = {};
const mockSettled: Record<string, Record<string, DiagnosisSuggestion["status"]>> = {};

function mockDiagnosis(projectId: string): BackendDiagnosis {
  const settled = mockSettled[projectId] ?? {};
  const suggestions: BackendSuggestion[] = [
    {
      apply: { candidates: [["bom_id", "line_no"]], object_type_id: "material_bom" },
      evidence: { quotes: [] },
      group: "object",
      id: "s-identity",
      impact: { connects: ["material_bom"], questions: [] },
      kind: "choose_identity",
      rank: 1,
      reason: "It has a drafted relation, and is left out only because it has no identity.",
      title: "Choose the identity of material_bom and adopt it",
    },
    {
      apply: {
        cardinality: "many_to_one",
        description: "",
        mapping: [{ source_property: "customer_id", target_property: "customer_id" }],
        name: "customer",
        source: "sales_orders",
        target: "customers",
      },
      evidence: {
        hits: 572,
        nulls: 25,
        quotes: [{ document_id: "doc-1", text: "Trace every order back to its customer." }],
        rate: 0.716,
        rows: 799,
        source_field: "customer_id",
        target_field: "customer_id",
      },
      group: "connect",
      id: "s-relation",
      impact: { connects: ["customers"], questions: ["q-1", "q-2"] },
      kind: "create_relation",
      rank: 2,
      reason: "Most order customer codes are customer codes.",
      title: "sales_orders —customer→ customers",
    },
    {
      apply: null,
      evidence: { quotes: [] },
      group: "data",
      id: "s-data",
      impact: { connects: [], questions: [] },
      kind: "data_quality",
      rank: 3,
      reason: "Tracing breaks at these records.",
      title: "25 orders have no customer",
    },
  ];
  return {
    components: [["sales_orders", "customers"], ["material_bom"]],
    computed_at: Date.now(),
    draft_update_time: 0,
    metrics: {
      connectivity: { components: 2, largest: 2, objects: 3 },
      pending_concepts: 2,
      reachability: { reachable: 3, total: 5 },
      references: { covered: 1, total: 2 },
    },
    run_id: "mock-run",
    stale: false,
    state: "ready",
    suggestions: suggestions.map((item) => ({ ...item, status: settled[item.id] ?? "open" })),
  };
}

function readMockDiagnosis(projectId: string): Diagnosis | null {
  const run = mockRuns[projectId];
  if (!run) {
    return null;
  }
  run.reads += 1;
  return mapDiagnosis(
    run.reads <= 1 ? { state: "running", run_id: "mock-run" } : mockDiagnosis(projectId),
  );
}

function settleMock(
  projectId: string,
  suggestionId: string,
  status: DiagnosisSuggestion["status"],
): DiagnosisSuggestion {
  mockSettled[projectId] = { ...mockSettled[projectId], [suggestionId]: status };
  const found = mockDiagnosis(projectId).suggestions?.find((item) => item.id === suggestionId);
  return mapSuggestion(found ?? mockDiagnosis(projectId).suggestions![0]);
}

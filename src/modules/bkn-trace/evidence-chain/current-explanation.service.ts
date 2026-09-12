/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type { EvidenceChainView } from "./evidence-chain.types";
export interface CurrentExplanation { status: "not_generated" | "ready"; generatedAt?: string; view?: EvidenceChainView }
function parse(value: unknown, id: string): CurrentExplanation {
  if (!value || typeof value !== "object") throw new Error("invalid explanation");
  const row = value as { schema_version?: unknown; interaction_id?: unknown; status?: unknown; generated_at?: string; view?: EvidenceChainView };
  if (row.schema_version !== "1" || row.interaction_id !== id || !["not_generated", "ready"].includes(String(row.status))) throw new Error("unsupported explanation");
  if (row.status === "not_generated") return { status: "not_generated" };
  const view = row.view;
  if (!view || view.interactionId !== id || !Array.isArray(view.claims) || !view.execution || !view.evidence) throw new Error("invalid explanation scope");
  const text = (v: unknown) => v === undefined || typeof v === "string";
  if (typeof row.generated_at !== "string" || !text(view.question) || !text(view.answer) || !text(view.revisionLabel) || !["running", "completed", "interrupted", "failed", "unknown"].includes(view.status) || (view.notices !== undefined && (!Array.isArray(view.notices) || !view.notices.every(v => typeof v === "string")))) throw new Error("invalid explanation text");
  for (const claim of view.claims) {
    if (!claim || typeof claim.id !== "string" || typeof claim.label !== "string" || !["checked", "located", "candidate", "unbound", "missing"].includes(claim.status) || !Array.isArray(claim.nodeIds) || !claim.nodeIds.every(id => typeof id === "string") || !text(claim.value) || !text(claim.detail) || !text(claim.objectLabel)) throw new Error("invalid conclusion");
  }
  for (const graph of [view.execution, view.evidence]) {
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || graph.nodes.length > 500 || graph.edges.length > 1000) throw new Error("explanation graph budget");
    if (graph.nodes.some(n => !n || typeof n.id !== "string" || typeof n.label !== "string" || typeof n.kind !== "string" || !text(n.value) || !text(n.detail) || !text(n.technical)) || graph.edges.some(e => !e || ![e.id, e.source, e.target, e.label].every(v => typeof v === "string"))) throw new Error("invalid explanation graph");
  }
  return { status: "ready", generatedAt: row.generated_at, view };
}
export async function readCurrentExplanation(id: string): Promise<CurrentExplanation> {
  const response = await http.get<unknown>(`/agent-observability/v1/business-provenance/interactions/${encodeURIComponent(id)}/explanations`, { skipErrorToast: true });
  return parse(response.data, id);
}
export async function generateCurrentExplanation(id: string): Promise<CurrentExplanation> {
  const response = await http.post<unknown>(`/agent-observability/v1/business-provenance/interactions/${encodeURIComponent(id)}/explanations`, {}, { skipErrorToast: true });
  return parse(response.data, id);
}

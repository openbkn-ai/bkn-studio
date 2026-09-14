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
  const optionalEnum = (v: unknown, values: string[]) => v === undefined || (typeof v === "string" && values.includes(v));
  if (typeof row.generated_at !== "string" || !text(view.question) || !text(view.answer) || !text(view.revisionLabel) || !["running", "completed", "interrupted", "failed", "unknown"].includes(view.status) || !optionalEnum(view.evidenceStatus, ["complete", "partial", "assembling", "failed", "not_applicable", "content_unavailable"]) || (view.notices !== undefined && (!Array.isArray(view.notices) || !view.notices.every(v => typeof v === "string")))) throw new Error("invalid explanation text");
  for (const claim of view.claims) {
    if (!claim || typeof claim.id !== "string" || typeof claim.label !== "string" || !["checked", "located", "candidate", "unbound", "missing"].includes(claim.status) || !optionalEnum(claim.supportStatus, ["supported", "partial", "unsupported", "contradicted"]) || !optionalEnum(claim.attributionStatus, ["explicit", "reconstructed", "none"]) || !Array.isArray(claim.nodeIds) || !claim.nodeIds.every(id => typeof id === "string") || (claim.requirementIds !== undefined && (!Array.isArray(claim.requirementIds) || !claim.requirementIds.every(id => typeof id === "string"))) || !text(claim.value) || !text(claim.detail) || !text(claim.objectLabel)) throw new Error("invalid conclusion");
  }
  if (view.requirements !== undefined) {
    if (!Array.isArray(view.requirements) || view.requirements.length > 64) throw new Error("invalid question requirement");
    for (const requirement of view.requirements) {
      if (!requirement || typeof requirement.id !== "string" || typeof requirement.label !== "string" || !["supported", "partial", "unsupported", "contradicted", "missing"].includes(requirement.status) || !Array.isArray(requirement.claimIds) || !requirement.claimIds.every(id => typeof id === "string")) throw new Error("invalid question requirement");
    }
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

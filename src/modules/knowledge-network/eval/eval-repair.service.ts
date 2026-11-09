/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalReferenceLabel } from "./eval-readable-references";
import {
  getKnowledgeNetworkObjectTypeDetail,
  updateKnowledgeNetworkObjectType,
} from "../services/object-type.service";
import {
  DATA_PROPERTY_TYPES,
  canBeDisplayKey,
  canBePrimaryKey,
} from "../components/object-type/data-attribute/constants";
import { hasKnowledgeNetworkRecordOperation } from "../utils/record-operations";
import type {
  ObjectTypeDetail,
  KnowledgeNetworkObjectTypeMutationPayload,
} from "../types/object-type";
import {
  getEvalCaseDefinition,
  getEvalOverview,
  getRunCaseDetail,
  type EvalOverview,
  type M0CaseDetail,
  type M0Run,
} from "./m0-run.service";
import type { OverviewResource, OverviewResourceCase } from "./eval-overview-resources";

export type EvalRepairRequest = {
  networkId: string;
  id: string;
  target: Pick<OverviewResource, "id" | "kind" | "name">;
  cases: OverviewResourceCase[];
  analysisOnly?: boolean;
  analysisOnlyReason?: "history" | "state" | "permission" | "target" | "outcome";
};

/** Bind repair to the exact selected execution, rather than silently using its latest result. */
export function buildRunRepairRequest(
  networkId: string,
  run: M0Run,
  detail: M0CaseDetail,
  overview: EvalOverview,
  canManage: boolean,
): EvalRepairRequest {
  const status =
    detail.execution_status === "failed"
      ? "execution_failed"
      : detail.quality_outcome === "fail"
        ? "failed"
        : detail.quality_outcome === "inconclusive"
          ? "inconclusive"
          : detail.quality_outcome === "review_required"
            ? "review_required"
            : undefined;
  if (!status || !["completed", "failed"].includes(detail.execution_status))
    return fail("NO_FAILURES");
  const current = overview.case_details?.find((entry) => entry.id === detail.case_id);
  const aliases: Record<string, string> = {
    object_type: "objectType",
    relation_type: "relationType",
    action_type: "action",
    object_metric: "metric",
    skills: "skill",
  };
  const targets =
    detail.assessment_target?.resources.map((resource) => ({
      id: resource.resource_id,
      kind: aliases[resource.resource_kind] ?? resource.resource_kind,
      name: resource.name,
    })) ??
    current?.targets ??
    [];
  const scenario =
    detail.assessment_target?.kind === "business_scenario" ||
    current?.target_kind === "business_scenario" ||
    targets.length !== 1;
  const selected = targets[0];
  const resource = !scenario
    ? overview.resource_details?.find(
        (entry) => entry.id === selected.id && entry.kind === selected.kind,
      )
    : undefined;
  const revision = detail.result_revision ?? run.result_revision ?? undefined;
  const latest =
    current?.latest_run_id === run.id &&
    current.latest_case_run_id === detail.id &&
    current.latest_result_revision === revision;
  const reason: EvalRepairRequest["analysisOnlyReason"] = !canManage
    ? "permission"
    : !latest
      ? "history"
      : status !== "failed"
        ? "outcome"
        : !current?.enabled || current.excluded || !current.runnable || current.status !== "failed"
          ? "state"
          : scenario
            ? "target"
            : undefined;
  return {
    networkId,
    id: crypto.randomUUID(),
    target: scenario
      ? {
          kind: "scenario",
          id: detail.case_id,
          name: detail.case_title || evalReferenceLabel("unnamedCase"),
        }
      : {
          kind: selected.kind,
          id: selected.id,
          name:
            (selected as { name?: string }).name ||
            resource?.name ||
            current?.target_name ||
            evalReferenceLabel("unnamedResource"),
        },
    cases: [
      {
        ...current,
        id: detail.case_id,
        title: detail.case_title,
        enabled: current?.enabled ?? false,
        runnable: current?.runnable ?? false,
        excluded: current?.excluded ?? false,
        target_names: current?.target_names ?? [],
        status,
        latest_run_id: run.id,
        latest_case_run_id: detail.id,
        latest_result_revision: revision,
      },
    ],
    ...(reason ? { analysisOnly: true, analysisOnlyReason: reason } : {}),
  };
}
type QuerySummary = NonNullable<NonNullable<M0CaseDetail["observation"]>["query_summary"]>;
type RepairQuerySummary = Pick<
  QuerySummary,
  "scope" | "checked_rows" | "total_count" | "violations"
> & {
  violation_examples?: Array<
    Pick<
      NonNullable<QuerySummary["violation_examples"]>[number],
      "resource_id" | "field" | "declared_type" | "actual_type" | "reason"
    >
  >;
  violation_examples_truncated?: boolean;
};
function repairQuerySummary(summary?: QuerySummary): RepairQuerySummary | undefined {
  if (!summary) return undefined;
  return {
    scope: summary.scope,
    checked_rows: summary.checked_rows,
    total_count: summary.total_count,
    violations: summary.violations,
    violation_examples: summary.violation_examples?.slice(0, 10).map((e) => ({
      resource_id: e.resource_id,
      field: e.field,
      declared_type: e.declared_type,
      actual_type: e.actual_type,
      reason: (e.reason ?? "").slice(0, 512),
    })),
    violation_examples_truncated:
      summary.violation_examples_truncated || (summary.violation_examples?.length ?? 0) > 10,
  };
}
export type EvalRepairContext = {
  target: EvalRepairRequest["target"];
  complete: boolean;
  analysisOnlyReason?: EvalRepairRequest["analysisOnlyReason"];
  failures: Array<{
    caseId: string;
    caseRunId: string;
    runId: string;
    revision?: number;
    title: string;
    ruleId?: string;
    evidenceStatus?: string;
    executionStatus?: string;
    qualityOutcome?: string | null;
    failureClass?: string;
    findings?: M0CaseDetail["findings"];
    assertions?: M0CaseDetail["assertions"];
    querySummary?: RepairQuerySummary;
    facts?: NonNullable<M0CaseDetail["observation"]>["facts"];
  }>;
  propertyTypes: Array<{
    field: string;
    type: string;
    sourceType?: string;
    primaryKey?: boolean;
    displayKey?: boolean;
    masked?: boolean;
    incrementalKey?: boolean;
  }>;
  supportedOperations: string[];
};
export type EvalRepairChange = {
  operation: "set_property_type";
  field: string;
  before: string;
  after: string;
  reason: string;
  evidence_case_run_ids: string[];
};
export type EvalRepairProposal = {
  kind: "eval_repair_plan";
  answer?: string;
  summary: string;
  changes: EvalRepairChange[];
  manual_steps: string[];
};
export type EvalRepairSession = {
  request: EvalRepairRequest;
  context: EvalRepairContext;
  original?: ObjectTypeDetail;
  caseDefinitions: Record<string, string>;
};
const fail = (code: string): never => {
  throw new Error(`EVAL_REPAIR_${code}`);
};

function payload(detail: ObjectTypeDetail): KnowledgeNetworkObjectTypeMutationPayload {
  return {
    id: detail.id,
    color: detail.color,
    conceptGroupIds: detail.conceptGroupIds,
    dataProperties: detail.dataProperties,
    dataSource: detail.dataSource,
    description: detail.description,
    icon: detail.icon,
    logicProperties: detail.logicProperties,
    name: detail.name,
    tags: detail.tags,
  };
}

/** Reads frozen failure evidence; never treats a resource name as its identity. */
export async function loadEvalRepairSession(
  networkId: string,
  request: EvalRepairRequest,
  signal: AbortSignal,
): Promise<EvalRepairSession> {
  if (request.networkId !== networkId) return fail("STALE");
  const all = request.cases.filter((c) =>
    request.analysisOnly
      ? [
          "failed",
          "inconclusive",
          "execution_failed",
          "review_required",
          "declaration_problem",
        ].includes(c.status)
      : c.status === "failed" && c.enabled && !c.excluded,
  );
  if (!all.length) return fail("NO_FAILURES");
  const cases = all.slice(0, 20);
  const failures: EvalRepairContext["failures"] = [];
  const caseDefinitions = Object.create(null) as Record<string, string>;
  let complete = all.length <= 20;
  for (let index = 0; index < cases.length; index += 3) {
    const results = await Promise.all(
      cases.slice(index, index + 3).map(async (c) => {
        if (!c.latest_run_id || !c.latest_case_run_id) return undefined;
        try {
          const d = await getRunCaseDetail(
            networkId,
            c.latest_run_id,
            c.latest_case_run_id,
            c.latest_result_revision,
            signal,
          );
          if (
            d.case_id !== c.id ||
            d.id !== c.latest_case_run_id ||
            (!request.analysisOnly && d.quality_outcome !== "fail") ||
            (request.analysisOnly && !["completed", "failed"].includes(d.execution_status)) ||
            (request.analysisOnly &&
              d.execution_status !== "failed" &&
              !["fail", "inconclusive", "review_required"].includes(d.quality_outcome ?? "")) ||
            (c.latest_result_revision && d.result_revision !== c.latest_result_revision)
          )
            return undefined;
          if (!request.analysisOnly) {
            const frozen = await getEvalCaseDefinition(networkId, c.id, {
              runId: c.latest_run_id,
              caseRunId: c.latest_case_run_id,
            });
            const current = await getEvalCaseDefinition(networkId, c.id);
            if (
              frozen.case_id !== c.id ||
              current.case_id !== c.id ||
              current.archived ||
              JSON.stringify(frozen.definition) !== JSON.stringify(current.definition)
            )
              complete = false;
            else caseDefinitions[c.id] = JSON.stringify(current.definition);
          }
          return {
            caseId: c.id,
            caseRunId: d.id,
            runId: c.latest_run_id,
            revision: d.result_revision,
            title: c.title,
            ruleId: d.target_snapshot?.object_data?.rule_id,
            evidenceStatus: d.observation?.evidence_status,
            executionStatus: d.execution_status,
            qualityOutcome: d.quality_outcome,
            failureClass: d.observation?.failure_class,
            findings: (d.findings ?? []).slice(0, 10),
            assertions: (d.assertions ?? [])
              .slice(0, 20)
              .map((a) => ({ ...a, message: a.message?.slice(0, 1000) })),
            querySummary: repairQuerySummary(d.observation?.query_summary),
            facts: d.observation?.facts,
          };
        } catch {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          return undefined;
        }
      }),
    );
    for (const result of results) {
      if (result) failures.push(result);
      else complete = false;
    }
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  let original: ObjectTypeDetail | undefined;
  if (request.target.kind === "objectType") {
    try {
      original =
        (await getKnowledgeNetworkObjectTypeDetail(networkId, request.target.id)) ?? undefined;
      if (original?.id !== request.target.id) {
        original = undefined;
        complete = false;
      }
    } catch {
      complete = false;
    }
  }
  const supported =
    !request.analysisOnly &&
    complete &&
    original &&
    hasKnowledgeNetworkRecordOperation(original, "modify");
  const fields = new Set(
    failures.flatMap((f) => f.querySummary?.violation_examples?.map((e) => e.field) ?? []),
  );
  return {
    request,
    original,
    caseDefinitions,
    context: {
      target: request.target,
      complete,
      ...(request.analysisOnlyReason ? { analysisOnlyReason: request.analysisOnlyReason } : {}),
      failures,
      propertyTypes:
        original?.dataProperties
          .filter((p) => fields.has(p.name))
          .map((p) => ({
            field: p.name,
            type: p.type,
            sourceType: p.mappedField?.type,
            primaryKey: p.primaryKey,
            displayKey: p.displayKey,
            masked: Boolean(p.maskRule),
            incrementalKey: p.incrementalKey,
          })) ?? [],
      supportedOperations: supported ? ["set_property_type"] : [],
    },
  };
}

export async function verifyEvalRepairCases(networkId: string, session: EvalRepairSession) {
  for (const item of session.context.failures) {
    const current = await getEvalCaseDefinition(networkId, item.caseId);
    if (
      current.archived ||
      !session.caseDefinitions[item.caseId] ||
      JSON.stringify(current.definition) !== session.caseDefinitions[item.caseId]
    )
      return fail("STALE");
  }
}

/** Model output is only a proposal. Execution accepts this restricted schema again. */
export function validateEvalRepairProposal(
  value: unknown,
  session: EvalRepairSession,
): EvalRepairProposal {
  const p = value as Partial<EvalRepairProposal> | null;
  if (
    !p ||
    p.kind !== "eval_repair_plan" ||
    typeof p.summary !== "string" ||
    !p.summary.trim() ||
    (p.answer !== undefined && (typeof p.answer !== "string" || p.answer.length > 8000)) ||
    !Array.isArray(p.changes) ||
    p.changes.length > 20 ||
    !Array.isArray(p.manual_steps) ||
    p.manual_steps.length > 20 ||
    p.manual_steps.some((s) => typeof s !== "string" || s.length > 2000)
  )
    return fail("INVALID_PLAN");
  const seen = new Set<string>();
  for (const c of p.changes) {
    if (
      !c ||
      c.operation !== "set_property_type" ||
      !session.context.complete ||
      !session.context.supportedOperations.includes(c.operation) ||
      !session.original ||
      typeof c.reason !== "string" ||
      !c.reason.trim() ||
      c.reason.length > 2000 ||
      seen.has(c.field) ||
      !(DATA_PROPERTY_TYPES as readonly string[]).includes(c.after) ||
      c.before === c.after ||
      !Array.isArray(c.evidence_case_run_ids) ||
      !c.evidence_case_run_ids.length
    )
      return fail("INVALID_PLAN");
    seen.add(c.field);
    const field = session.original.dataProperties.find((f) => f.name === c.field);
    // A sampled mismatch is not authority to redefine a field: require the
    // independently configured source type, and preserve masking/key constraints.
    if (
      !field ||
      session.original.dataProperties.filter((f) => f.name === c.field).length !== 1 ||
      field.type !== c.before ||
      field.mappedField?.type !== c.after ||
      field.maskRule ||
      field.incrementalKey ||
      (field.primaryKey && !canBePrimaryKey(c.after)) ||
      (field.displayKey && !canBeDisplayKey(c.after))
    )
      return fail("UNSUPPORTED_CHANGE");
    for (const id of c.evidence_case_run_ids) {
      const evidence = session.context.failures.find((f) => f.caseRunId === id);
      if (
        !evidence ||
        evidence.ruleId !== "property-type" ||
        evidence.evidenceStatus !== "complete" ||
        !evidence.querySummary?.violation_examples?.some(
          (e) => e.field === c.field && e.resource_id === session.request.target.id,
        )
      )
        return fail("INVALID_EVIDENCE");
    }
  }
  return {
    kind: "eval_repair_plan",
    summary: p.summary.trim(),
    ...(p.answer?.trim() ? { answer: p.answer.trim() } : {}),
    changes: p.changes.map((c) => ({ ...c, evidence_case_run_ids: [...c.evidence_case_run_ids] })),
    manual_steps: [...p.manual_steps],
  };
}

/** Called only by the explicit confirmation handler, using ordinary resource permissions. */
export async function applyEvalRepair(
  networkId: string,
  session: EvalRepairSession,
  proposal: EvalRepairProposal,
) {
  if (session.request.networkId !== networkId) return fail("STALE");
  if (session.request.analysisOnly) return fail("UNSUPPORTED_CHANGE");
  const checked = validateEvalRepairProposal(proposal, session);
  await verifyEvalRepairCases(networkId, session);
  if (!session.original || !checked.changes.length) return fail("UNSUPPORTED_CHANGE");
  const [current, overview] = await Promise.all([
    getKnowledgeNetworkObjectTypeDetail(networkId, session.request.target.id),
    getEvalOverview(networkId),
  ]);
  if (!current || !hasKnowledgeNetworkRecordOperation(current, "modify"))
    return fail("NO_PERMISSION");
  if (JSON.stringify(payload(current)) !== JSON.stringify(payload(session.original)))
    return fail("STALE");
  for (const evidence of session.context.failures) {
    const entry = overview.case_details?.find((c) => c.id === evidence.caseId);
    if (
      !entry?.enabled ||
      entry.excluded ||
      entry.status !== "failed" ||
      entry.latest_case_run_id !== evidence.caseRunId ||
      entry.latest_run_id !== evidence.runId ||
      entry.latest_result_revision !== evidence.revision
    )
      return fail("STALE");
  }
  await updateKnowledgeNetworkObjectType(networkId, current.id, {
    ...payload(current),
    dataProperties: current.dataProperties.map((field) => {
      const change = checked.changes.find((c) => c.field === field.name);
      return change ? { ...field, type: change.after } : field;
    }),
  });
}

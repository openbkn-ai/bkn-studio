/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import i18n from "i18next";
import "./locales";

import type { EvalRuleCheck, RuleCheckCapability } from "./rule-check-model";

import {
  transformPrecisionSafeJSONRequest,
  parsePrecisionPreservingJSON,
} from "@/framework/request/precision-safe-json";
import { http } from "@/framework/request/http";
import { createPendingRequest } from "@/framework/request/pending-request";
import type { EvalRuleKind, EvalTemplateRule } from "./types";

export type RunCaseCounts = {
  total: number;
  passed: number;
  failed: number;
  inconclusive: number;
  review_required: number;
  execution_failed: number;
  cancelled: number;
  pending: number;
  runtime?: AssessmentCaseCounts;
  declaration?: AssessmentCaseCounts;
};

export type AssessmentCaseCounts = Omit<RunCaseCounts, "runtime" | "declaration">;

export type M0Run = {
  id: string;
  runner_type?: string;
  external_agent?: { name: string; model?: string; client_version?: string };
  suite_name?: string;
  scope?:
    | {
        kind: "suite";
        suite_id: string;
        version: number;
      }
    | {
        kind: "cases";
        case_ids?: string[];
        suite_id?: never;
      }
    | {
        kind: string;
        suite_id?: string;
        version?: number;
        case_ids?: string[];
      };
  execution_status: "queued" | "running" | "completed" | "failed" | "cancelled";
  phase: "resolving" | "executing" | "evaluating" | null;
  quality_outcome: "pass" | "fail" | "inconclusive" | "review_required" | null;
  assessment_scope?: "runtime" | "declaration" | "mixed";
  progress: { planned_cases: number; completed_cases: number };
  case_counts?: RunCaseCounts;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  result_revision?: number | null;
  result_checksum?: string | null;
  trigger_type?: "manual" | "scheduled" | "plan_manual";
  run_plan_id?: string;
  scheduled_at?: string | null;
};

export type EvalRunPlanSchedule = {
  kind: "daily" | "weekly" | "monthly";
  time_of_day: string;
  weekday?: number;
  day_of_month?: number;
  timezone: string;
};

export type EvalRunPlan = {
  last_error_code?: string;
  last_error_message?: string;
  id: string;
  kn_id: string;
  name: string;
  suite_id: string;
  suite_name: string;
  version_policy: "fixed" | "latest";
  suite_version?: number;
  schedule: EvalRunPlanSchedule;
  overlap_policy: "skip";
  enabled: boolean;
  next_run_at?: string;
  last_triggered_at?: string;
  last_run_id?: string;
  last_status?:
    "submitted" | "skipped" | "failed" | "queued" | "running" | "completed" | "cancelled";
  revision: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type EvalRunPlanMutation = Pick<
  EvalRunPlan,
  "name" | "suite_id" | "version_policy" | "schedule" | "overlap_policy" | "enabled"
> & {
  suite_version?: number;
  revision?: number;
};

export type EvalRunPlanPage = {
  entries: EvalRunPlan[];
  total: number;
  total_all?: number;
  page: number;
  limit: number;
};

export type EvalRunPlanSearch = {
  q?: string;
  state?: "enabled" | "paused";
  schedule_kind?: "daily" | "weekly" | "monthly";
  version_policy?: "fixed" | "latest";
};

export type EvalRunComparisonMember = {
  case_id: string;
  case_version_id: string;
  case_run_id: string;
  execution_status: string;
  quality_outcome?: string;
};

export type EvalRunComparison = {
  baseline_run_id: string;
  candidate_run_id: string;
  baseline_result_revision: number;
  candidate_result_revision: number;
  baseline_result_checksum: string;
  candidate_result_checksum: string;
  target_snapshot_compatible: boolean;
  data_baseline_verified: boolean;
  changes: {
    case_id: string;
    case_title?: string;
    baseline_case_title?: string;
    candidate_case_title?: string;
    kind:
      | "improved"
      | "regressed"
      | "unchanged"
      | "changed"
      | "case_version_changed"
      | "added"
      | "removed";
    baseline?: EvalRunComparisonMember;
    candidate?: EvalRunComparisonMember;
  }[];
};

export type EvalRunResultRevision = {
  revision: number;
  checksum: string;
  quality_outcome: "pass" | "fail" | "inconclusive" | "review_required";
  current: boolean;
  created_at: string;
};

export type EvalRunResultRevisionPage = {
  entries: EvalRunResultRevision[];
  next_before?: number;
};

export type M0RunSearch = {
  q?: string;
  status?: M0Run["execution_status"];
  outcome?: NonNullable<M0Run["quality_outcome"]>;
  from?: string;
  to?: string;
  page: number;
  limit: number;
  suite_id?: string;
  suite_version?: number;
  runner_type?: "external_agent" | "per_case" | "direct_capability";
  scope_kind?: "suite" | "cases";
  comparable?: boolean;
};

export type M0RunSearchPage = {
  entries: M0Run[];
  total: number;
  page: number;
  limit: number;
};

export type EvalOverview = {
  resource_scope?: string;
  read_issues?: { kind: string; id?: string; reason: string }[];
  generated_at: string;
  scope: EvalOverviewScope;
  resources: {
    total: number;
    in_scope: number;
    excluded: number;
    covered: number;
    evaluated: number;
    passed: number;
    problems: number;
    uncovered: number;
    unresolved_bindings: number;
  };
  rule_points: {
    enabled_rules: number;
    applicable: number;
    covered: number;
    missing: number;
    not_ready: number;
  };
  cases: {
    total: number;
    excluded: number;
    enabled: number;
    runnable: number;
    evaluated: number;
    passed: number;
    failed: number;
    inconclusive: number;
    review_required: number;
    declaration_checked?: number;
    declaration_passed?: number;
    declaration_problems?: number;
    execution_failed: number;
    in_progress: number;
    cancelled: number;
    not_run: number;
  };
  coverage: {
    resource_percent: number;
    rule_percent: number;
    execution_percent: number;
    pass_percent: number;
  };
  by_resource_type: {
    kind: string;
    resources: number;
    in_scope_resources: number;
    excluded_resources: number;
    covered_resources: number;
    evaluated_resources: number;
    passed_resources: number;
    problem_resources: number;
    coverage_percent: number;
  }[];
  resource_details?: {
    uncovered_reason?: string;
    kind: string;
    id: string;
    name: string;
    in_scope: boolean;
    status:
      | "excluded"
      | "uncovered"
      | "not_run"
      | "in_progress"
      | "partially_evaluated"
      | "passed"
      | "problem"
      | "review";
    case_count: number;
    evaluated_cases: number;
    passed_cases: number;
    problem_cases: number;
    review_cases?: number;
    latest_result_at?: string;
    pending_cases: number;
    latest_run_id?: string;
    latest_quality_outcome?: string;
    capability_id?: string;
    box_id?: string;
  }[];
  case_details?: {
    id: string;
    title: string;
    version?: number;
    enabled: boolean;
    runnable: boolean;
    execution_setup?: EvalCaseSummary["execution_setup"];
    excluded: boolean;
    target_kind?: string;
    target_names: string[];
    targets?: EvalOverviewScopeResource[];
    rule_title?: string;
    target_name?: string;
    latest_case_run_id?: string;
    latest_result_revision?: number;
    latest_result_at?: string;
    status:
      | "inactive"
      | "excluded"
      | "not_run"
      | "in_progress"
      | "cancelled"
      | "execution_failed"
      | "passed"
      | "failed"
      | "inconclusive"
      | "review_required"
      | "declaration_passed"
      | "declaration_problem";
    latest_run_id?: string;
    latest_execution_status?: M0Run["execution_status"];
    latest_quality_outcome?: M0Run["quality_outcome"];
  }[];
};

export type EvalOverviewScopeResource = { kind: string; id: string };

export type EvalOverviewScope = {
  revision: number;
  excluded_kinds: string[];
  excluded_resources: EvalOverviewScopeResource[];
  updated_by?: string;
  updated_at?: string;
};

const pendingOverview = createPendingRequest<EvalOverview>();

export function getEvalOverview(networkId: string): Promise<EvalOverview> {
  return pendingOverview(networkId, async () => {
    const response = await http.get<EvalOverview>(
      `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/overview`,
      { skipErrorToast: true },
    );
    return response.data;
  });
}

export async function getEvalOverviewScope(networkId: string): Promise<EvalOverviewScope> {
  const response = await http.get<EvalOverviewScope>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/overview/scope`,
    { skipErrorToast: true },
  );
  return response.data;
}

export async function saveEvalOverviewScope(
  networkId: string,
  scope: Pick<EvalOverviewScope, "revision" | "excluded_kinds" | "excluded_resources">,
): Promise<EvalOverviewScope> {
  const response = await http.put<EvalOverviewScope>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/overview/scope`,
    scope,
    { skipErrorToast: true },
  );
  return response.data;
}

export type EvalCaseLatestResult = {
  status:
    | "passed"
    | "failed"
    | "inconclusive"
    | "review_required"
    | "in_progress"
    | "execution_failed"
    | "cancelled"
    | "not_run"
    | "declaration_passed"
    | "declaration_problem";
  run_id: string;
  case_run_id: string;
  result_revision?: number;
  result_at?: string;
  execution_status: M0Run["execution_status"];
  quality_outcome?: M0Run["quality_outcome"];
  assessment_scope: "runtime" | "declaration";
};

export type EvalCaseSummary = {
  latest_result?: EvalCaseLatestResult;
  id: string;
  title: string;
  enabled: boolean;
  source_type?: string;
  source_case_id?: string;
  template_rule_id?: string;
  template_rule_title?: string;
  template_rule_revision?: number;
  input_spec?: {
    question?: string;
    arguments?: Record<string, string>;
    template_rule_id?: string;
    template_rule_title?: string;
    template_rule_revision?: number;
  };
  execution_spec?: {
    runner?: string;
    binding_status?: "resolved" | "unresolved";
    runnable?: boolean;
    target_kind?: "resource" | "business_scenario";
    target?: EvalCaseTarget;
    related_targets?: EvalCaseTarget[];
  };
  execution_setup?:
    | "ready_for_preflight"
    | "review_required"
    | "execution_not_configured"
    | "unsupported_runner"
    | "invalid_contract";
  created_at: string;
};

export type EvalCaseTarget = {
  name?: string;
  operation?: string;
  capability_type?: string;
  resource_id?: string;
  binding_id?: string;
  capability_id?: string;
  kn_id?: string;
};

export type EvalCasePage = {
  entries: EvalCaseSummary[];
  total: number;
  next_cursor: string | null;
};

export type EvalCaseDefinition = {
  title: string;
  category: "fact" | "relation" | "calculation" | "decision" | "action";
  risk_level: "low" | "medium" | "high" | "critical";
  input_spec: Record<string, unknown>;
  execution_spec: Record<string, unknown>;
  assertions: Record<string, unknown>[];
  expected_spec: Record<string, unknown>;
  expected_source: {
    kind: "declared_contract" | "independent_sample" | "business_expert";
    evidence_refs: string[];
  };
  diagnostic_spec: Record<string, unknown>;
};

export type EvalCaseResource = {
  id: string;
  name: string;
  kind: string;
  box_id?: string;
  capability_id?: string;
};
export type EvalCaseResourcePage = {
  entries: EvalCaseResource[];
  total: number;
  read_issues?: Array<{ kind: string; id?: string; reason: string }>;
};

export async function listEvalCaseResources(
  networkId: string,
  kind: string,
  search = "",
): Promise<EvalCaseResourcePage> {
  const response = await http.get<EvalCaseResourcePage>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/case-resources`,
    { params: { kind, q: search || undefined, limit: 30 }, skipErrorToast: true },
  );
  return response.data;
}

export async function listEvalCaseResourcesPage(
  networkId: string,
  kind: string,
  search: string,
  page: number,
  limit = 20,
  inScope = false,
): Promise<EvalCaseResourcePage> {
  const response = await http.get<EvalCaseResourcePage>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/case-resources`,
    {
      params: {
        kind,
        q: search || undefined,
        limit,
        offset: (page - 1) * limit,
        ...(inScope ? { in_scope: true } : {}),
      },
      skipErrorToast: true,
    },
  );
  return response.data;
}

export type EvalCaseDraft = {
  case_id: string;
  revision: number;
  enabled: boolean;
  checksum: string;
  definition: EvalCaseDefinition;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type EvalCaseRevision = Pick<EvalCaseDraft, "case_id" | "revision" | "enabled" | "checksum">;

export type EvalSuiteVersion = {
  latest_run?: M0Run;
  id: string;
  suite_id: string;
  name: string;
  description: string;
  tags: string[];
  version: number;
  status: "draft" | "published";
  members: string[];
  member_summaries?: Array<{
    case_id: string;
    title: string;
  }>;
  checksum: string;
  published_at?: string;
};

export type EvalSuitePage = {
  total_all?: number;
  available_tags?: string[];
  entries: EvalSuiteVersion[];
  total: number;
  page: number;
  limit: number;
};

const suiteBase = (networkId: string) =>
  `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/suites`;

export type EvalSuiteSearch = { q?: string; tag?: string };

export async function listEvalSuites(
  networkId: string,
  page = 1,
  filters: EvalSuiteSearch = {},
): Promise<EvalSuitePage> {
  const response = await http.get<EvalSuitePage>(suiteBase(networkId), {
    params: { ...filters, page, limit: 20 },
    skipErrorToast: true,
  });
  return response.data;
}

export async function getEvalSuite(
  networkId: string,
  suiteId: string,
  version?: number,
): Promise<EvalSuiteVersion> {
  const response = await http.get<EvalSuiteVersion>(
    `${suiteBase(networkId)}/${encodeURIComponent(suiteId)}${version === undefined ? "" : `/versions/${version}`}`,
    { skipErrorToast: true },
  );
  return response.data;
}

export type EvalSuiteCaseDetail = {
  case_id: string;
  archived: boolean;
  gold_visible: boolean;
  source: { type?: string; case_id?: string; rule_id?: string; rule_title?: string };
  definition: Omit<EvalCaseDefinition, "expected_spec"> & {
    expected_spec: Record<string, unknown> | null;
  };
};

export async function getEvalCaseDefinition(
  networkId: string,
  caseId: string,
  run?: { runId: string; caseRunId: string },
): Promise<EvalSuiteCaseDetail> {
  const root = `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals`;
  const path = run
    ? `/runs/${encodeURIComponent(run.runId)}/cases/${encodeURIComponent(run.caseRunId)}/definition`
    : `/cases/${encodeURIComponent(caseId)}/detail`;
  const response = await http.get<EvalSuiteCaseDetail>(root + path, {
    skipErrorToast: true,
    transformResponse: (data: unknown) =>
      typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
  });
  return response.data;
}

export async function getEvalSuiteCaseDetail(
  networkId: string,
  suiteId: string,
  suiteVersion: number,
  caseId: string,
): Promise<EvalSuiteCaseDetail> {
  const response = await http.get<EvalSuiteCaseDetail>(
    `${suiteBase(networkId)}/${encodeURIComponent(suiteId)}/versions/${suiteVersion}/cases/${encodeURIComponent(caseId)}`,
    {
      skipErrorToast: true,
      transformResponse: (data: unknown) =>
        typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
    },
  );
  return response.data;
}

export async function createEvalSuite(
  networkId: string,
  name: string,
  description: string,
  tags: string[],
  members: string[],
): Promise<EvalSuiteVersion> {
  const response = await http.post<EvalSuiteVersion>(
    suiteBase(networkId),
    { name, description, tags, members },
    { skipErrorToast: true },
  );
  return response.data;
}

export async function replaceEvalSuite(
  networkId: string,
  suite: EvalSuiteVersion,
  name: string,
  description: string,
  tags: string[],
  members: string[],
): Promise<EvalSuiteVersion> {
  const response = await http.put<EvalSuiteVersion>(
    `${suiteBase(networkId)}/${encodeURIComponent(suite.suite_id)}`,
    { version: suite.version, checksum: suite.checksum, name, description, tags, members },
    { skipErrorToast: true },
  );
  return response.data;
}

export async function listEvalSuiteVersions(
  networkId: string,
  suiteId: string,
): Promise<EvalSuiteVersion[]> {
  const response = await http.get<{ entries: EvalSuiteVersion[] }>(
    `${suiteBase(networkId)}/${encodeURIComponent(suiteId)}/versions`,
    { skipErrorToast: true },
  );
  return response.data.entries;
}

export async function deleteEvalSuite(networkId: string, suiteId: string): Promise<void> {
  await http.delete(`${suiteBase(networkId)}/${encodeURIComponent(suiteId)}`, {
    skipErrorToast: true,
  });
}

const caseBase = (networkId: string) =>
  `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/cases`;

export async function getEvalCapabilities(networkId: string): Promise<{
  external_agent?: boolean;
  case_management: boolean;
  template_management?: boolean;

  run_plans?: boolean;
  run_plan_management?: boolean;
  run_plan_automatic?: boolean;
  run_plan_automatic_reason?: string;
}> {
  const response = await http.get<{
    external_agent?: boolean;
    case_management: boolean;
    template_management?: boolean;

    run_plans?: boolean;
    run_plan_management?: boolean;
    run_plan_automatic?: boolean;
    run_plan_automatic_reason?: string;
  }>(`/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/capabilities`, {
    skipErrorToast: true,
  });
  return response.data;
}

const runPlanBase = (networkId: string) =>
  `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/run-plans`;

export async function getEvalRunPlanCount(
  networkId: string,
  signal?: AbortSignal,
): Promise<number> {
  const response = await http.get<EvalRunPlanPage>(runPlanBase(networkId), {
    params: { page: 1, limit: 1 },
    signal,
    skipErrorToast: true,
  });
  const count = response.data.total_all ?? response.data.total;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid Eval Run plan count");
  return count;
}

export async function listEvalRunPlans(
  networkId: string,
  page = 1,
  filters: EvalRunPlanSearch = {},
): Promise<EvalRunPlanPage> {
  const response = await http.get<EvalRunPlanPage>(runPlanBase(networkId), {
    params: { ...filters, page, limit: 20 },
    skipErrorToast: true,
  });
  return response.data;
}

export async function createEvalRunPlan(
  networkId: string,
  mutation: EvalRunPlanMutation,
): Promise<EvalRunPlan> {
  const response = await http.post<EvalRunPlan>(runPlanBase(networkId), mutation, {
    skipErrorToast: true,
  });
  return response.data;
}

export async function updateEvalRunPlan(
  networkId: string,
  planId: string,
  mutation: EvalRunPlanMutation,
): Promise<EvalRunPlan> {
  const response = await http.put<EvalRunPlan>(
    `${runPlanBase(networkId)}/${encodeURIComponent(planId)}`,
    mutation,
    { skipErrorToast: true },
  );
  return response.data;
}

export async function setEvalRunPlanEnabled(
  networkId: string,
  plan: Pick<EvalRunPlan, "id" | "revision">,
  enabled: boolean,
): Promise<EvalRunPlan> {
  const response = await http.post<EvalRunPlan>(
    `${runPlanBase(networkId)}/${encodeURIComponent(plan.id)}/state`,
    { revision: plan.revision, enabled },
    { skipErrorToast: true },
  );
  return response.data;
}

export async function runEvalRunPlanNow(networkId: string, planId: string): Promise<M0Run> {
  const response = await http.post<M0Run>(
    `${runPlanBase(networkId)}/${encodeURIComponent(planId)}/run`,
    {},
    { skipErrorToast: true },
  );
  return response.data;
}

export async function beginEvalRunPlanAuthorization(
  networkId: string,
  planId: string,
  redirectURI: string,
): Promise<{ state: string; code_challenge: string }> {
  const response = await http.post<{ state: string; code_challenge: string }>(
    `${runPlanBase(networkId)}/${encodeURIComponent(planId)}/authorization`,
    { redirect_uri: redirectURI },
    { skipErrorToast: true },
  );
  return response.data;
}

export async function completeEvalRunPlanAuthorization(
  networkId: string,
  planId: string,
  response: { state: string; code: string },
): Promise<void> {
  await http.post(
    `${runPlanBase(networkId)}/${encodeURIComponent(planId)}/authorization/complete`,
    response,
    { skipErrorToast: true },
  );
}

export async function deleteEvalRunPlan(
  networkId: string,
  plan: Pick<EvalRunPlan, "id" | "revision">,
): Promise<void> {
  await http.delete(`${runPlanBase(networkId)}/${encodeURIComponent(plan.id)}`, {
    params: { revision: plan.revision },
    skipErrorToast: true,
  });
}

export async function createEvalCase(
  networkId: string,
  definition: EvalCaseDefinition,
  enabled: boolean,
): Promise<EvalCaseRevision> {
  const response = await http.post<EvalCaseRevision>(
    caseBase(networkId),
    { definition, enabled },
    {
      skipErrorToast: true,
      transformRequest: transformPrecisionSafeJSONRequest,
      headers: { "Content-Type": "application/json" },
      transformResponse: (data: unknown) =>
        typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
    },
  );
  return response.data;
}

export async function getEvalCaseDraft(networkId: string, caseId: string): Promise<EvalCaseDraft> {
  const response = await http.get<EvalCaseDraft>(
    `${caseBase(networkId)}/${encodeURIComponent(caseId)}`,
    {
      skipErrorToast: true,
      transformResponse: (data: unknown) =>
        typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
    },
  );
  return response.data;
}

export async function replaceEvalCase(
  networkId: string,
  draft: EvalCaseDraft,
  enabled: boolean,
): Promise<EvalCaseRevision> {
  const response = await http.put<EvalCaseRevision>(
    `${caseBase(networkId)}/${encodeURIComponent(draft.case_id)}`,
    { revision: draft.revision, checksum: draft.checksum, definition: draft.definition, enabled },
    {
      skipErrorToast: true,
      transformRequest: transformPrecisionSafeJSONRequest,
      headers: { "Content-Type": "application/json" },
      transformResponse: (data: unknown) =>
        typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
    },
  );
  return response.data;
}

export async function setEvalCaseEnabled(
  networkId: string,
  caseId: string,
  enabled: boolean,
): Promise<void> {
  await http.post(
    `${caseBase(networkId)}/${encodeURIComponent(caseId)}/state`,
    { enabled },
    { skipErrorToast: true },
  );
}

/** Recorded server facts; availability alone never implies complete data coverage. */
export type EvalExecutionFacts = {
  version: 1;
  resource_kind: string;
  resource_id: string;
  source: string;
  shape: "records" | "aggregate" | "document" | "text" | "scalar" | "declaration" | "unknown";
  scope: "sample" | "all" | "invocation" | "declaration" | "object_pair" | "path" | "unknown";
  scope_details?: {
    unit:
      | "endpoint_instances"
      | "bridge_records"
      | "object_pairs"
      | "paths"
      | "associations"
      | "declarations"
      | "invocations";
    limit?: number;
    end?: "source" | "target" | "both";
    source?: { resource_kind: string; resource_id: string; identity: Record<string, unknown> };
    target?: { resource_kind: string; resource_id: string; identity: Record<string, unknown> };
    via?: { resource_kind: string; resource_id: string; identity: Record<string, unknown> };
  };
  completeness: "complete" | "partial" | "unknown";
  read_rows?: number;
  checked_rows?: number;
  total_rows?: number;
  evidence_status: "complete" | "partial" | "unavailable";
};

/** Frozen server-generated pipeline, never submitted as client execution authority. */
export type EvalExecutionPlan = {
  version: 1;
  resource_kind: string;
  resource_id: string;
  executor: string;
  definition_sha256: string;
  steps: { id: string; module: "execution" | "checks" | "judging"; depends_on?: string[] }[];
  budget: { max_attempts: 1; timeout_seconds: number };
};

export type EvalResourceQuerySummary = {
  relation_check?: {
    rule: string;
    source_object_type: string;
    target_object_type: string;
    relation_type: string;
    checked: number;
    violations?: number;
    findings?: Record<string, unknown>[];
    actual?: Record<string, unknown>;
    boundary?: string;
    scope?: Record<string, unknown>;
  };
  assessment_scope?: string;
  resource_kind: string;
  resource_id: string;
  scope: { mode: string; limit?: number };
  execution_error?: string;
  execution_id?: string;
  execution_status?: string;
  target_count?: number;
};

export type EvalCaseTrialResult = {
  facts?: EvalExecutionFacts;
  trial_id: string;
  definition_checksum: string;
  interaction_id?: string;
  actual?: unknown;
  expected: unknown;
  evaluation: {
    quality_outcome: "pass" | "fail" | "inconclusive" | "review_required";
    assertions: { id: string; outcome: string; reason?: string }[];
    finding_class?: string;
  };
  error_class?: string;
  resource_query_summary?: EvalResourceQuerySummary;
  evidence_status: string;
};

export async function trialEvalCase(
  networkId: string,
  definition: EvalCaseDefinition,
): Promise<EvalCaseTrialResult> {
  const requestBytes = new Uint8Array(16);
  crypto.getRandomValues(requestBytes);
  requestBytes[6] = (requestBytes[6] & 0x0f) | 0x40;
  requestBytes[8] = (requestBytes[8] & 0x3f) | 0x80;
  const hex = Array.from(requestBytes, (part) => part.toString(16).padStart(2, "0")).join("");
  const requestId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const response = await http.post<EvalCaseTrialResult>(
    `${caseBase(networkId)}/trial`,
    definition,
    {
      skipErrorToast: true,
      transformRequest: transformPrecisionSafeJSONRequest,
      headers: { "Content-Type": "application/json", "X-Eval-Trial-Request-ID": requestId },
      // Source resolution precedes the server's 60-second execution/evidence
      // budget. Do not abort a valid trial at the ordinary 30-second UI limit.
      timeout: 120000,
      transformResponse: (data: unknown) =>
        typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
    },
  );
  return response.data;
}

export async function removeEvalCase(
  networkId: string,
  caseId: string,
  mode: "delete",
): Promise<{ result: "deleted" }> {
  const response = await http.delete<{ result: "deleted" }>(
    `${caseBase(networkId)}/${encodeURIComponent(caseId)}`,
    { params: { mode }, skipErrorToast: true },
  );
  return response.data;
}

export type EvalTemplateConfig = {
  execution_support?: Record<
    string,
    { status: "supported" | "unsupported"; reason: string; check?: EvalRuleCheck }
  >;
  check_capabilities?: RuleCheckCapability[];
  revision: number;
  checksum: string;
  rules: EvalTemplateRule[];
};

const templateConfigBase = (networkId: string) =>
  `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/template-config`;

export async function getEvalTemplateConfig(networkId: string): Promise<EvalTemplateConfig> {
  const response = await http.get<EvalTemplateConfig>(templateConfigBase(networkId), {
    skipErrorToast: true,
    transformResponse: (data: unknown) =>
      typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
  });
  return response.data;
}

export type EvalRuleMatchPreview = {
  total_resources: number;
  scanned_resources: number;
  total_targets: number;
  matched_targets: number;
  unreadable: number;
  examples: string[];
};

export async function previewEvalRuleMatches(
  networkId: string,
  kind: EvalRuleKind,
  applicability: NonNullable<EvalTemplateRule["applicability"]>,
): Promise<EvalRuleMatchPreview> {
  const response = await http.post<EvalRuleMatchPreview>(
    `${templateConfigBase(networkId)}/match-preview`,
    { kind, applicability },
    { skipErrorToast: true },
  );
  return response.data;
}

export async function saveEvalTemplateConfig(
  networkId: string,
  config: EvalTemplateConfig,
  rules: EvalTemplateRule[],
): Promise<EvalTemplateConfig> {
  const response = await http.put<EvalTemplateConfig>(
    templateConfigBase(networkId),
    { revision: config.revision, checksum: config.checksum, rules },
    {
      skipErrorToast: true,
      transformRequest: transformPrecisionSafeJSONRequest,
      headers: { "Content-Type": "application/json" },
      transformResponse: (data: unknown) =>
        typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
    },
  );
  return response.data;
}

export type EvalTemplateResource = {
  id: string;
  name: string;
  kind: string;
  metadata?: Record<string, unknown>;
};

export type M0CaseRun = {
  id: string;
  case_id: string;
  case_title: string;
  case_version_id: string;
  execution_status: M0Run["execution_status"];
  quality_outcome: M0Run["quality_outcome"];
  assessment_scope?: "runtime" | "declaration";
  duration_ms: number | null;
};

export type M1RunScope =
  { kind: "suite"; suite_id: string; version: number } | { kind: "cases"; case_ids: string[] };

export type M1CaseRunPage = {
  entries: M0CaseRun[];
  total: number;
  next_cursor: string | null;
};

export type M0CaseDetail = M0CaseRun & {
  case_version?: number;
  assessment_target?: {
    kind: "resource" | "business_scenario";
    resources: { resource_id: string; resource_kind: string; name?: string }[];
  };
  result_revision?: number;
  result_checksum?: string;
  input_spec?: Record<string, unknown>;
  observation?: {
    facts?: EvalExecutionFacts;
    resource_query_summary?: EvalResourceQuerySummary;
    normalized_output?: Record<string, unknown>;
    query_summary?: {
      scope: { mode: "sample" | "all"; limit?: number };
      checked_rows: number;
      read_rows?: number;
      reference_rows?: number;
      program_version?: number;
      aggregate_scope?: string;
      aggregate_checks?: number;
      aggregate_results?: {
        function: string;
        field: string;
        operator: string;
        actual_exact: string;
        expected: unknown;
        passed: boolean;
      }[];
      total_count?: number;
      violations: number;
      violation_examples?: {
        resource_id: string;
        resource_name: string;
        field: string;
        declared_type?: string;
        actual_type: string;
        value: unknown;
        primary_key: Record<string, unknown>;
        record_index: number;
        reason: string;
      }[];
      violation_examples_limit?: number;
      violation_examples_truncated?: boolean;
      violation_examples_unavailable?: string;
      primary_keys?: string[];
      check_fields?: string[];
      object_type_id?: string;
      visibility?: string;
    };
    failure_class?: string;
    source_verified?: boolean;
    evidence_status?: string;
    source_kind?: string;
    answer?: string;
  };
  assertions: { id: string; type: string; outcome: string; message?: string }[];
  findings: { id: string; category: string; title: string }[];
  evidence_refs?: { interaction_id?: string; operation_id?: string; receipt_id?: string };
  target_snapshot?: {
    execution_plan?: EvalExecutionPlan;
    runner?: string;
    branch?: string;
    object_data?: {
      rule_id: string;
      rule_revision: number;
      primary_keys: string[];
      fields?: string[];
      scope?: { mode: "sample" | "all"; limit?: number };
    };
    capability?: {
      metadata_type?: string;
      operation?: string;
      name?: string;
      capability_id?: string;
      version?: string;
      version_status?: string;
    };
  };
};

const base = (networkId: string) =>
  `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/runs`;

export const CASE_LIST_BATCH_SIZE = 50;

export type EvalCaseResourceSummaryPage = {
  entries: { name: string; kinds: string[]; case_count: number }[];
  total: number;
  case_total: number;
  page: number;
  limit: number;
};

export async function listEvalCaseResourceSummary(
  networkId: string,
  resourceType: string | undefined,
  page: number,
  limit = 10,
  signal?: AbortSignal,
  status?: "enabled" | "disabled",
): Promise<EvalCaseResourceSummaryPage> {
  const response = await http.get<EvalCaseResourceSummaryPage>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/case-resource-summary`,
    {
      params: { resource_type: resourceType, page, limit, ...(status ? { status } : {}) },
      skipErrorToast: true,
      ...(signal ? { signal } : {}),
    },
  );
  return response.data;
}

export async function listEvalCases(
  networkId: string,
  search = "",
  cursor?: string,
  status?: "enabled" | "disabled",
  resourceFilter?: { name?: string; type?: string },
  resultFilter?: { result?: string; participation?: string },
): Promise<EvalCasePage> {
  const response = await http.get<EvalCasePage>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/cases`,
    {
      params: {
        limit: CASE_LIST_BATCH_SIZE,
        q: search || undefined,
        cursor,
        status,
        resource_name: resourceFilter?.name || undefined,
        resource_type: resourceFilter?.type || undefined,
        ...(resultFilter?.result ? { result: resultFilter.result } : {}),
        ...(resultFilter?.participation ? { participation: resultFilter.participation } : {}),
      },
      skipErrorToast: true,
    },
  );
  return response.data;
}

export async function listM0Runs(networkId: string, limit = 50): Promise<M0Run[]> {
  const response = await http.get<{ entries: M0Run[] }>(base(networkId), {
    params: { limit },
    skipErrorToast: true,
  });
  return response.data.entries;
}

export async function searchM0Runs(
  networkId: string,
  query: M0RunSearch,
  signal?: AbortSignal,
): Promise<M0RunSearchPage> {
  const response = await http.get<M0RunSearchPage>(`${base(networkId)}/search`, {
    params: query,
    skipErrorToast: true,
    ...(signal ? { signal } : {}),
  });
  return response.data;
}

export async function compareEvalRuns(
  networkId: string,
  baseline: Pick<M0Run, "id" | "result_revision">,
  candidate: Pick<M0Run, "id" | "result_revision">,
  baselineRevision = baseline.result_revision,
  candidateRevision = candidate.result_revision,
): Promise<EvalRunComparison> {
  if (!baselineRevision || !candidateRevision) {
    throw new Error(i18n.t("knowledgeNetwork.eval.foundation.comparison.resultRequired"));
  }
  const response = await http.get<EvalRunComparison>(`${base(networkId)}/compare`, {
    params: {
      baseline_run_id: baseline.id,
      candidate_run_id: candidate.id,
      baseline_result_revision: baselineRevision,
      candidate_result_revision: candidateRevision,
    },
    skipErrorToast: true,
  });
  return response.data;
}

export async function getEvalRunResultRevisionPage(
  networkId: string,
  runId: string,
  before?: number,
): Promise<EvalRunResultRevisionPage> {
  const response = await http.get<EvalRunResultRevisionPage>(
    `${base(networkId)}/${encodeURIComponent(runId)}/result-revisions`,
    { params: before ? { before } : undefined, skipErrorToast: true },
  );
  const page = response.data;
  const next = page.next_before;
  if (
    !Array.isArray(page.entries) ||
    (next !== undefined &&
      (!Number.isSafeInteger(next) ||
        next < 1 ||
        !page.entries.length ||
        next !== page.entries[page.entries.length - 1].revision ||
        (before !== undefined && next >= before)))
  ) {
    throw new Error("Invalid Eval result revision page");
  }
  return page;
}

export async function getM1RunCapabilities(networkId: string): Promise<boolean> {
  try {
    const response = await http.get<{ available: boolean }>(
      `${base(networkId)}/multi/capabilities`,
      { skipErrorToast: true },
    );
    return response.data.available === true;
  } catch {
    return false;
  }
}

export type EvalCallableFunction = { resource_id?: string; name: string; operation: string };

export async function listEvalCallableFunctions(
  networkId: string,
): Promise<EvalCallableFunction[]> {
  const response = await http.get<{ entries: EvalCallableFunction[] }>(
    `${base(networkId)}/multi/functions`,
    { skipErrorToast: true },
  );
  return response.data.entries;
}

export async function createM1Run(
  networkId: string,
  scope: M1RunScope,
  idempotencyKey: string,
): Promise<M0Run> {
  const response = await http.post<M0Run>(
    `${base(networkId)}/multi`,
    { scope, target: { branch: "main", data_baseline_id: "" }, idempotency_key: idempotencyKey },
    { skipErrorToast: true },
  );
  return response.data;
}

export type M1RunPreview = {
  case_count: number;
  eligible: boolean;
  execution_mode: "platform" | "external" | "scheduled";
  reasons: string[];
};

export async function previewM1RunSelection(
  networkId: string,
  scope: M1RunScope,
  executionMode: M1RunPreview["execution_mode"] = "platform",
): Promise<M1RunPreview> {
  const response = await http.post<M1RunPreview>(
    `${base(networkId)}/multi/preview`,
    { scope, execution_mode: executionMode },
    { skipErrorToast: true },
  );
  return response.data;
}

export async function listRunCases(
  networkId: string,
  runId: string,
  cursor?: string,
  outcome?: NonNullable<M0Run["quality_outcome"]>,
  signal?: AbortSignal,
  search?: string,
  assessmentScope?: "runtime" | "declaration",
): Promise<M1CaseRunPage> {
  const response = await http.get<M1CaseRunPage>(
    `${base(networkId)}/${encodeURIComponent(runId)}/cases`,
    {
      params: {
        limit: 20,
        cursor,
        outcome,
        ...(search ? { q: search } : {}),
        ...(assessmentScope ? { assessment_scope: assessmentScope } : {}),
      },
      signal,
      skipErrorToast: true,
    },
  );
  return response.data;
}

export async function getRunCaseDetail(
  networkId: string,
  runId: string,
  caseRunId: string,
  resultRevision?: number,
  signal?: AbortSignal,
): Promise<M0CaseDetail> {
  const response = await http.get<M0CaseDetail>(
    `${base(networkId)}/${encodeURIComponent(runId)}/cases/${encodeURIComponent(caseRunId)}`,
    { params: { result_revision: resultRevision }, signal, skipErrorToast: true },
  );
  return response.data;
}

export async function getM0Run(
  networkId: string,
  runId: string,
  signal?: AbortSignal,
): Promise<M0Run> {
  const response = await http.get<M0Run>(`${base(networkId)}/${encodeURIComponent(runId)}`, {
    signal,
    skipErrorToast: true,
  });
  return response.data;
}

export async function cancelM0Run(networkId: string, runId: string): Promise<M0Run> {
  const response = await http.post<M0Run>(
    `${base(networkId)}/${encodeURIComponent(runId)}/cancel`,
    {},
    { skipErrorToast: true },
  );
  return response.data;
}

export async function getM0OperationAttempt(
  operationId: string,
  attempt: number,
): Promise<unknown> {
  const response = await http.get<unknown>(
    `/agent-observability/v1/operations/${encodeURIComponent(operationId)}/attempts/${attempt}`,
    {
      skipErrorToast: true,
      transformResponse: (data: unknown) =>
        typeof data === "string" ? parsePrecisionPreservingJSON(data) : data,
    },
  );
  return response.data;
}

export async function getM0Evidence(
  kind: "interaction" | "operation" | "receipt",
  id: string,
): Promise<unknown> {
  const resource = {
    interaction: "interactions",
    operation: "operations",
    receipt: "receipts",
  }[kind];
  const response = await http.get<unknown>(
    `/agent-observability/v1/${resource}/${encodeURIComponent(id)}`,
    { skipErrorToast: true },
  );
  return response.data;
}

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const caseResultFilters = [
  "all",
  "evaluated",
  "no_result",
  "passed",
  "failed",
  "inconclusive",
  "review_required",
  "in_progress",
  "execution_failed",
  "cancelled",
  "not_run",
  "declaration",
  "declaration_passed",
  "declaration_problem",
] as const;
export type CaseResultFilter = (typeof caseResultFilters)[number];
export const caseResourceTypes = [
  "all",
  "objectType",
  "relationType",
  "action",
  "metric",
  "function",
  "api",
  "mcp",
  "skill",
  "scenario",
] as const;
export type CaseResourceType = (typeof caseResourceTypes)[number];
export type EvalCaseFilters = {
  view: "library" | "suites";
  search: string;
  status: "all" | "enabled" | "disabled";
  result: CaseResultFilter;
  participation: "all" | "participating" | "excluded";
  resource: string;
  resourceType: CaseResourceType;
};
export const defaultCaseFilters: EvalCaseFilters = {
  view: "library",
  search: "",
  status: "all",
  result: "all",
  participation: "all",
  resource: "",
  resourceType: "all",
};
const keys: Record<keyof EvalCaseFilters, string> = {
  view: "case_view",
  search: "case_q",
  status: "case_status",
  result: "case_result",
  participation: "case_scope",
  resource: "case_resource",
  resourceType: "case_type",
};
const member = <T extends string>(raw: string | null, values: readonly T[], fallback: T): T =>
  values.includes(raw as T) ? (raw as T) : fallback;
export function readCaseFilters(search: string): EvalCaseFilters {
  const params = new URLSearchParams(search);
  return {
    view: member(params.get(keys.view), ["library", "suites"], "library"),
    search: (params.get(keys.search) || "").slice(0, 128),
    status: member(params.get(keys.status), ["all", "enabled", "disabled"], "all"),
    result: member(params.get(keys.result), caseResultFilters, "all"),
    participation: member(
      params.get(keys.participation),
      ["all", "participating", "excluded"],
      "all",
    ),
    resource: (params.get(keys.resource) || "").slice(0, 128),
    resourceType: member(params.get(keys.resourceType), caseResourceTypes, "all"),
  };
}
export function writeCaseFilters(
  params: URLSearchParams,
  filters: EvalCaseFilters,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(keys) as (keyof EvalCaseFilters)[]) {
    if (filters[key] === defaultCaseFilters[key]) next.delete(keys[key]);
    else next.set(keys[key], filters[key]);
  }
  return next;
}

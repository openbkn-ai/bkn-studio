/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { EvalOverview } from "./m0-run.service";

export type OverviewResource = NonNullable<EvalOverview["resource_details"]>[number];
export type OverviewResourceCase = NonNullable<EvalOverview["case_details"]>[number];
export type ResourceResultFilter = "problem" | "review" | "passed" | "pending" | "all";
export type ResourceResultRow = OverviewResource & {
  cases: OverviewResourceCase[];
  failures: OverviewResourceCase[];
  reviews: OverviewResourceCase[];
  group: Exclude<ResourceResultFilter, "all"> | "excluded";
};
export const resourceCaseNeedsReview = (entry: OverviewResourceCase) =>
  ["inconclusive", "review_required", "execution_failed", "declaration_problem"].includes(
    entry.status,
  );

export function buildResourceResultRows(overview: EvalOverview): ResourceResultRow[] {
  const byResource = new Map<string, OverviewResourceCase[]>();
  for (const entry of overview.case_details ?? []) {
    if (!entry.enabled || entry.excluded || entry.target_kind === "business_scenario") continue;
    for (const target of entry.targets ?? []) {
      const key = `${target.kind}:${target.id}`;
      const entries = byResource.get(key) ?? [];
      if (!entries.some((item) => item.id === entry.id)) entries.push(entry);
      byResource.set(key, entries);
    }
  }
  const resources = (overview.resource_details ?? []).map((resource): ResourceResultRow => {
    const cases = byResource.get(`${resource.kind}:${resource.id}`) ?? [];
    const failures = cases.filter((entry) => entry.status === "failed");
    const reviews = cases.filter(resourceCaseNeedsReview);
    const group = !resource.in_scope
      ? "excluded"
      : failures.length || resource.problem_cases > 0
        ? "problem"
        : reviews.length || (resource.review_cases ?? 0) > 0
          ? "review"
          : resource.status === "passed"
            ? "passed"
            : "pending";
    return { ...resource, cases, failures, reviews, group };
  });
  // Scenarios are case-level assessment targets, not knowledge-network resources.
  // Use their explicit target kind and case identity; never infer one from missing bindings.
  const scenarios = (overview.case_details ?? [])
    .filter(
      (entry) => entry.target_kind === "business_scenario" && entry.enabled && !entry.excluded,
    )
    .map((entry): ResourceResultRow => {
      const failed = entry.status === "failed";
      const review = resourceCaseNeedsReview(entry);
      const passed = entry.status === "passed";
      return {
        kind: "scenario",
        id: entry.id,
        name: entry.title,
        in_scope: true,
        status: failed ? "problem" : review ? "review" : passed ? "passed" : "not_run",
        case_count: 1,
        evaluated_cases: failed || review || passed ? 1 : 0,
        passed_cases: passed ? 1 : 0,
        problem_cases: failed ? 1 : 0,
        review_cases: review ? 1 : 0,
        pending_cases: failed || review || passed ? 0 : 1,
        latest_result_at: entry.latest_result_at,
        latest_run_id: entry.latest_run_id,
        latest_quality_outcome: entry.latest_quality_outcome ?? undefined,
        cases: [entry],
        failures: failed ? [entry] : [],
        reviews: review ? [entry] : [],
        group: failed ? "problem" : review ? "review" : passed ? "passed" : "pending",
      };
    });
  return [...resources, ...scenarios].sort((a, b) => {
    const order = { problem: 0, review: 1, pending: 2, passed: 3, excluded: 4 };
    return (
      order[a.group] - order[b.group] ||
      b.problem_cases - a.problem_cases ||
      a.name.localeCompare(b.name)
    );
  });
}

export const resourceCaseSummary = (entry: OverviewResourceCase) =>
  [entry.target_name, entry.rule_title].filter(Boolean).join(" · ") || entry.title;

export function filterResourceResults(
  rows: ResourceResultRow[],
  filter: ResourceResultFilter,
  kind: string,
  query: string,
) {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (filter === "all" || row.group === filter) &&
      (kind === "all" || row.kind === kind) &&
      (!search ||
        [row.name, row.id, ...row.cases.map(resourceCaseSummary), ...row.cases.map((c) => c.title)]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search)),
  );
}

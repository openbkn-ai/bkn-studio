/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  resourceCaseNeedsReview,
  type OverviewResourceCase,
  type OverviewResource,
} from "./eval-overview-resources";

export type CoverageAction = "create" | "apply" | "cases" | "results" | "run" | "repair" | "scope";

/** Actions depend on the resource's current state, not the statistic used to open it. */
export function resourceCoverageActions(
  resource: OverviewResource,
  cases: OverviewResourceCase[],
  canManage: boolean,
  hasRules: boolean,
): { actions: CoverageAction[]; runIds: string[] } {
  if (!resource.in_scope) return { actions: canManage ? ["scope"] : [], runIds: [] };
  const active = cases.filter((entry) => entry.enabled && !entry.excluded);
  const hasResults =
    resource.evaluated_cases > 0 ||
    active.some((entry) => entry.latest_run_id && entry.latest_case_run_id);
  const pending = active.filter((entry) => ["not_run", "cancelled"].includes(entry.status));
  const failures = active.filter((entry) => entry.status === "failed");
  const reviews = active.filter(resourceCaseNeedsReview);
  // Continue unfinished checks first. Rechecks target failed/review cases before passed ones.
  const candidates = pending.length
    ? pending
    : failures.length
      ? failures
      : reviews.length
        ? reviews
        : active;
  const runIds = candidates
    .filter((entry) => entry.runnable && entry.status !== "in_progress")
    .map((entry) => entry.id);
  const actions: CoverageAction[] = [];
  if (hasResults || active.some((entry) => entry.status === "in_progress")) actions.push("results");
  if (cases.length || resource.case_count > 0) actions.push("cases");
  else if (canManage) actions.push("create");
  if (canManage && runIds.length > 0 && runIds.length <= 50) actions.push("run");
  if (canManage && failures.some((entry) => entry.latest_run_id && entry.latest_case_run_id))
    actions.push("repair");
  if (canManage && hasRules) actions.push("apply");
  return { actions, runIds };
}

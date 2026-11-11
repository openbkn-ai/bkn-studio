/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { M0Run } from "./m0-run.service";

export type RunListFilters = {
  search: string;
  status: M0Run["execution_status"] | "all";
  outcome: NonNullable<M0Run["quality_outcome"]> | "all";
  from: string;
  to: string;
  page: number;
};
export type RunDetailLocation = {
  runId?: string;
  caseRunId?: string;
  tab?: "result" | "evidence";
  outcome?: RunListFilters["outcome"];
  revision?: number;
  comparison?: boolean;
};
const detailKeys = [
  "run_id",
  "case_run_id",
  "result_tab",
  "run_case_result",
  "result_revision",
  "run_view",
];
const positive = (value: string | null) =>
  value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value)
    : undefined;
export function readRunDetail(search: string): RunDetailLocation {
  const params = new URLSearchParams(search);
  const runId = params.get("run_id")?.slice(0, 128);
  if (!runId || params.get("tab") !== "runs") return {};
  const outcome = params.get("run_case_result");
  return {
    runId,
    caseRunId: params.get("case_run_id")?.slice(0, 128) || undefined,
    tab: params.get("result_tab") === "evidence" ? "evidence" : "result",
    outcome: ["pass", "fail", "inconclusive", "review_required"].includes(outcome ?? "")
      ? (outcome as RunListFilters["outcome"])
      : "all",
    revision: positive(params.get("result_revision")),
    comparison: params.get("run_view") === "compare",
  };
}
export function writeRunDetail(
  current: URLSearchParams,
  detail: RunDetailLocation,
): URLSearchParams {
  const next = new URLSearchParams(current);
  detailKeys.forEach((key) => next.delete(key));
  if (!detail.runId) return next;
  next.set("tab", "runs");
  next.set("run_id", detail.runId);
  if (detail.caseRunId) next.set("case_run_id", detail.caseRunId);
  if (detail.tab === "evidence") next.set("result_tab", "evidence");
  if (detail.outcome && detail.outcome !== "all") next.set("run_case_result", detail.outcome);
  if (detail.revision) next.set("result_revision", String(detail.revision));
  if (detail.comparison) next.set("run_view", "compare");
  return next;
}
export function readRunListFilters(search: string): RunListFilters {
  const p = new URLSearchParams(search);
  const status = p.get("run_status");
  const outcome = p.get("run_result");
  const date = (key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(p.get(key) ?? "") ? p.get(key)! : "");
  return {
    search: p.get("run_q")?.slice(0, 128) ?? "",
    status: ["queued", "running", "completed", "failed", "cancelled"].includes(status ?? "")
      ? (status as RunListFilters["status"])
      : "all",
    outcome: ["pass", "fail", "inconclusive"].includes(outcome ?? "")
      ? (outcome as RunListFilters["outcome"])
      : "all",
    from: date("run_from"),
    to: date("run_to"),
    page: positive(p.get("run_page")) ?? 1,
  };
}
export function writeRunListFilters(
  current: URLSearchParams,
  filters: RunListFilters,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const values = {
    run_q: filters.search,
    run_status: filters.status === "all" ? "" : filters.status,
    run_result: filters.outcome === "all" ? "" : filters.outcome,
    run_from: filters.from,
    run_to: filters.to,
    run_page: filters.page === 1 ? "" : String(filters.page),
  };
  Object.entries(values).forEach(([key, value]) =>
    value ? next.set(key, value) : next.delete(key),
  );
  return next;
}

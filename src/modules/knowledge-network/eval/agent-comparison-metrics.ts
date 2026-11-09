/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { AgentComparison, AgentComparisonCase } from "./agent-comparison.service";

export type ComparisonDifference = "all" | "different" | "unique" | "all_pass" | "none_pass";
export type ComparisonFocus = {
  runId: string;
  kind: "pass" | "fail" | "inconclusive" | "review_required" | "unique" | "gained" | "lost";
};
export type AgentMetrics = {
  total: number;
  passed: number;
  failed: number;
  inconclusive: number;
  reviewRequired: number;
  gained: number;
  lost: number;
  unique: number;
  passRate: number | null;
  delta: number | null;
  timingCount: number;
  p50: number | null;
  p90: number | null;
};
export function percentile(values: number[], quantile: number): number | null {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * Math.max(0, Math.min(1, quantile));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
}
export const isDifferent = (row: AgentComparisonCase) =>
  new Set(row.results.map((cell) => cell.quality_outcome)).size > 1;
export const uniquePassRunId = (row: AgentComparisonCase) => {
  const passed = row.results.filter((cell) => cell.quality_outcome === "pass");
  return row.results.length > 1 && passed.length === 1 ? passed[0].run_id : undefined;
};
export function matchesFocus(
  row: AgentComparisonCase,
  focus: ComparisonFocus,
  baselineId: string,
): boolean {
  const current = row.results.find((cell) => cell.run_id === focus.runId);
  const baseline = row.results.find((cell) => cell.run_id === baselineId);
  if (!current) return false;
  if (focus.kind === "unique") return uniquePassRunId(row) === focus.runId;
  if (focus.kind === "gained")
    return Boolean(
      baseline && current.quality_outcome === "pass" && baseline.quality_outcome !== "pass",
    );
  if (focus.kind === "lost")
    return Boolean(
      baseline && current.quality_outcome !== "pass" && baseline.quality_outcome === "pass",
    );
  return current.quality_outcome === focus.kind;
}
export function buildAgentMetrics(
  comparison: AgentComparison,
  baselineId: string,
): Record<string, AgentMetrics> {
  const rates = new Map(
    comparison.runs.map((run) => [
      run.id,
      comparison.cases.filter((row) =>
        row.results.some((cell) => cell.run_id === run.id && cell.quality_outcome === "pass"),
      ).length,
    ]),
  );
  const total = comparison.cases.length;
  return Object.fromEntries(
    comparison.runs.map((run) => {
      const values = comparison.cases.flatMap((row) => {
        const value = row.results.find((cell) => cell.run_id === run.id)?.duration_ms;
        return typeof value === "number" && Number.isFinite(value) && value >= 0 ? [value] : [];
      });
      const count = (kind: ComparisonFocus["kind"]) =>
        comparison.cases.filter((row) => matchesFocus(row, { runId: run.id, kind }, baselineId))
          .length;
      const passed = rates.get(run.id) ?? 0;
      return [
        run.id,
        {
          total,
          passed,
          failed: count("fail"),
          inconclusive: count("inconclusive"),
          reviewRequired: count("review_required"),
          gained: count("gained"),
          lost: count("lost"),
          unique: count("unique"),
          passRate: total ? (passed / total) * 100 : null,
          delta: total ? ((passed - (rates.get(baselineId) ?? 0)) / total) * 100 : null,
          timingCount: values.length,
          p50: percentile(values, 0.5),
          p90: percentile(values, 0.9),
        } satisfies AgentMetrics,
      ];
    }),
  );
}
export function filterComparisonCases(
  comparison: AgentComparison,
  options: {
    query: string;
    difference: ComparisonDifference;
    outcome: string;
    changesOnly: boolean;
    baselineId: string;
    focus?: ComparisonFocus;
  },
): AgentComparisonCase[] {
  const query = options.query.trim().toLocaleLowerCase();
  return comparison.cases
    .filter((row) => {
      if (query && !`${row.title} ${row.case_id}`.toLocaleLowerCase().includes(query)) return false;
      if (options.difference === "different" && !isDifferent(row)) return false;
      if (options.difference === "unique" && !uniquePassRunId(row)) return false;
      if (
        options.difference === "all_pass" &&
        !row.results.every((cell) => cell.quality_outcome === "pass")
      )
        return false;
      if (
        options.difference === "none_pass" &&
        row.results.some((cell) => cell.quality_outcome === "pass")
      )
        return false;
      if (
        options.outcome !== "all" &&
        !row.results.some((cell) => cell.quality_outcome === options.outcome)
      )
        return false;
      if (options.focus && !matchesFocus(row, options.focus, options.baselineId)) return false;
      const baseline = row.results.find((cell) => cell.run_id === options.baselineId);
      if (
        options.changesOnly &&
        (!baseline ||
          !row.results.some(
            (cell) =>
              cell.run_id !== options.baselineId &&
              cell.quality_outcome !== baseline.quality_outcome,
          ))
      )
        return false;
      return true;
    })
    .sort((a, b) => Number(isDifferent(b)) - Number(isDifferent(a)));
}

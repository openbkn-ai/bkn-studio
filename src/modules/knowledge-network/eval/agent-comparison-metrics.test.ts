/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, it } from "vitest";
import {
  buildAgentMetrics,
  filterComparisonCases,
  percentile,
  uniquePassRunId,
} from "./agent-comparison-metrics";
import type { AgentComparison, AgentComparisonCell } from "./agent-comparison.service";
const outcomes: AgentComparisonCell["quality_outcome"][][] = [
  ["pass", "fail", "pass"],
  ["fail", "fail", "pass"],
  ["pass", "pass", "pass"],
  ["pass", "pass", "fail"],
  ["inconclusive", "pass", "review_required"],
  ["review_required", "fail", "review_required"],
  ["pass", "fail", "pass"],
];
const comparison: AgentComparison = {
  suite_id: "suite",
  suite_version: 1,
  target_snapshot_compatible: true,
  data_baseline_matched: true,
  runs: ["a", "b", "c"].map((id) => ({
    id,
    execution_status: "completed",
    phase: null,
    quality_outcome: "pass",
    progress: { planned_cases: 7, completed_cases: 7 },
    result_revision: 1,
    data_baseline_id: "base",
    mean_case_duration_ms: null,
    duration_case_count: 0,
  })),
  cases: outcomes.map((values, i) => ({
    case_id: `c${i + 1}`,
    case_version_id: `v${i + 1}`,
    title: `Question ${i + 1}`,
    results: values.map((quality_outcome, j) => ({
      run_id: ["a", "b", "c"][j],
      case_run_id: `cr-${j}-${i}`,
      quality_outcome,
      duration_ms:
        j === 0
          ? [100, 200, 300, 400, null, -1, null][i]
          : j === 1
            ? [0, 500, null, 1000, 1500, null, null][i]
            : null,
    })),
  })),
};
it("computes counts, percentage point differences and aligned pass-set changes from frozen cells", () => {
  const metrics = buildAgentMetrics(comparison, "a");
  expect(metrics.a).toMatchObject({
    total: 7,
    passed: 4,
    failed: 1,
    inconclusive: 1,
    reviewRequired: 1,
    gained: 0,
    lost: 0,
    unique: 0,
  });
  expect(metrics.b).toMatchObject({ passed: 3, failed: 4, gained: 1, lost: 2, unique: 1 });
  expect(metrics.c).toMatchObject({ passed: 4, gained: 1, lost: 1, unique: 1 });
  expect(metrics.b.delta).toBeCloseTo(-100 / 7);
  expect(metrics.b.passRate).toBeCloseTo(300 / 7);
  const changed = buildAgentMetrics(comparison, "c");
  expect(changed.b).toMatchObject({ gained: 2, lost: 3 });
});
it("excludes missing and invalid timing while retaining real zero and computing interpolated percentiles", () => {
  const metrics = buildAgentMetrics(comparison, "a");
  expect(metrics.a).toMatchObject({ timingCount: 4, p50: 250, p90: 370 });
  expect(metrics.b.timingCount).toBe(4);
  expect(metrics.c).toMatchObject({ timingCount: 0, p50: null, p90: null });
  expect(percentile([0], 0.9)).toBe(0);
  expect(percentile([null as unknown as number, NaN, -10], 0.5)).toBeNull();
});
it("handles empty comparisons without inventing zero percent or timings", () => {
  const result = buildAgentMetrics({ ...comparison, cases: [] }, "a");
  expect(result.a).toMatchObject({ total: 0, passRate: null, delta: null, p50: null, p90: null });
});
it("combines search, difference, result and metric drilldown filters without changing frozen order", () => {
  const defaults = {
    query: "",
    difference: "all" as const,
    outcome: "all",
    changesOnly: false,
    baselineId: "a",
  };
  expect(filterComparisonCases(comparison, defaults).at(-1)?.case_id).toBe("c3");
  expect(comparison.cases[0].case_id).toBe("c1");
  expect(
    filterComparisonCases(comparison, { ...defaults, difference: "unique" }).map(
      (row) => row.case_id,
    ),
  ).toEqual(["c2", "c5"]);
  expect(
    filterComparisonCases(comparison, { ...defaults, difference: "none_pass" }).map(
      (row) => row.case_id,
    ),
  ).toEqual(["c6"]);
  expect(
    filterComparisonCases(comparison, { ...defaults, difference: "all_pass" }).map(
      (row) => row.case_id,
    ),
  ).toEqual(["c3"]);
  expect(
    filterComparisonCases(comparison, {
      ...defaults,
      focus: { runId: "b", kind: "fail" },
      outcome: "pass",
    }).map((row) => row.case_id),
  ).toEqual(["c1", "c2", "c7"]);
  expect(
    filterComparisonCases(comparison, {
      ...defaults,
      query: "  QUESTION 5 ",
      changesOnly: true,
      focus: { runId: "b", kind: "gained" },
    }).map((row) => row.case_id),
  ).toEqual(["c5"]);
  expect(uniquePassRunId(comparison.cases[4])).toBe("b");
});

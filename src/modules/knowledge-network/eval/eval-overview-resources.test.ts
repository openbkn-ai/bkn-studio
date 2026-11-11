/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, it } from "vitest";
import {
  buildResourceResultRows,
  filterResourceResults,
  type OverviewResourceCase,
} from "./eval-overview-resources";
import type { EvalOverview } from "./m0-run.service";

it("joins cases by resource identity across runs, excludes inactive cases and never guesses by name", () => {
  const resource = (id: string) => ({
    kind: "objectType",
    id,
    name: "物料",
    in_scope: true,
    status: "problem" as const,
    case_count: 2,
    evaluated_cases: 2,
    passed_cases: 0,
    problem_cases: 2,
    pending_cases: 0,
  });
  const entry = (id: string, target: string, run: string): OverviewResourceCase => ({
    id,
    title: `${id} · entry_id`,
    enabled: true,
    runnable: true,
    excluded: false,
    target_names: ["物料"],
    targets: [{ kind: "objectType", id: target }],
    status: "failed",
    latest_run_id: run,
  });
  const overview = {
    resource_details: [
      resource("one"),
      { ...resource("two"), status: "uncovered", problem_cases: 0 },
    ],
    case_details: [
      entry("a", "one", "run-old"),
      entry("b", "one", "run-new"),
      { ...entry("inactive", "one", "run-other"), enabled: false },
      { ...entry("excluded", "one", "run-excluded"), excluded: true },
      { ...entry("unbound", "one", "run-x"), targets: [] },
    ],
  } as EvalOverview;
  const rows = buildResourceResultRows(overview);
  expect(rows.find((row) => row.id === "one")?.failures.map((c) => c.latest_run_id)).toEqual([
    "run-old",
    "run-new",
  ]);
  expect(rows.find((row) => row.id === "two")?.cases).toEqual([]);
  expect(filterResourceResults(rows, "problem", "all", "entry_id").map((r) => r.id)).toEqual([
    "one",
  ]);
  expect(filterResourceResults(rows, "pending", "function", "")).toEqual([]);
});

it("keeps confirmed failures, uncertainty, incomplete assessment, pass and exclusion separate", () => {
  const resources = ["problem", "review", "passed", "not_run", "excluded"].map((status, index) => ({
    kind: "function",
    id: String(index),
    name: status,
    in_scope: status !== "excluded",
    status,
    case_count: 1,
    evaluated_cases: 0,
    passed_cases: 0,
    problem_cases: status === "problem" ? 1 : 0,
    review_cases: status === "review" ? 1 : 0,
    pending_cases: 0,
  }));
  const rows = buildResourceResultRows({
    resource_details: resources,
    case_details: [],
  } as unknown as EvalOverview);
  expect(rows.map((r) => r.group)).toEqual(["problem", "review", "pending", "passed", "excluded"]);
  expect(filterResourceResults(rows, "all", "all", "")).toHaveLength(5);
  expect(filterResourceResults(rows, "review", "all", "")).toHaveLength(1);
});

it("includes explicit scenario cases by case identity without assigning their failures to resources", () => {
  const overview = {
    resource_details: [
      {
        kind: "function",
        id: "same-id",
        name: "供货计算",
        in_scope: true,
        status: "uncovered",
        case_count: 0,
        evaluated_cases: 0,
        passed_cases: 0,
        problem_cases: 0,
        pending_cases: 0,
      },
    ],
    case_details: [
      "failed",
      "inconclusive",
      "execution_failed",
      "not_run",
      "passed",
      "cancelled",
      "in_progress",
    ].map((status, index) => ({
      id: index === 0 ? "same-id" : `scenario-${index}`,
      title: "订单履约场景",
      enabled: true,
      runnable: true,
      excluded: false,
      target_kind: "business_scenario",
      // Even an execution dependency is not a single assessed resource.
      targets: [{ kind: "function", id: "same-id" }],
      target_names: [],
      status,
      latest_run_id: `run-${index}`,
      latest_case_run_id: `cr-${index}`,
    })),
  } as unknown as EvalOverview;
  overview.case_details!.push(
    { ...overview.case_details![0], id: "disabled", enabled: false },
    { ...overview.case_details![0], id: "excluded", excluded: true },
    { ...overview.case_details![0], id: "unbound-resource", target_kind: "resource", targets: [] },
  );
  const rows = buildResourceResultRows(overview);
  const scenarios = rows.filter((row) => row.kind === "scenario");
  expect(scenarios).toHaveLength(7);
  expect(scenarios.map((row) => row.group)).toEqual([
    "problem",
    "review",
    "review",
    "pending",
    "pending",
    "pending",
    "passed",
  ]);
  const failure = scenarios.find((row) => row.id === "same-id")!;
  expect(failure.failures[0].latest_case_run_id).toBe("cr-0");
  expect(failure.problem_cases).toBe(1);
  expect(rows.find((row) => row.kind === "function")?.cases).toEqual([]);
  expect(filterResourceResults(rows, "problem", "scenario", "订单")).toEqual([failure]);
  expect(overview.resource_details).toHaveLength(1);
});

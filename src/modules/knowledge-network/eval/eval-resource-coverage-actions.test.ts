/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, it } from "vitest";
import { resourceCoverageActions } from "./eval-resource-coverage-actions";
import type { OverviewResource, OverviewResourceCase } from "./eval-overview-resources";

const resource: OverviewResource = {
  id: "material",
  kind: "objectType",
  name: "物料",
  in_scope: true,
  status: "uncovered",
  case_count: 0,
  evaluated_cases: 0,
  passed_cases: 0,
  problem_cases: 0,
  pending_cases: 0,
};
const entry = (
  status: OverviewResourceCase["status"],
  id: string = status,
): OverviewResourceCase => ({
  id,
  title: id,
  status,
  enabled: true,
  excluded: false,
  runnable: true,
  target_names: ["物料"],
  ...(!["not_run", "inactive"].includes(status)
    ? { latest_run_id: `run-${id}`, latest_case_run_id: `cr-${id}` }
    : {}),
});
it("offers creation only without configured cases, never a nonexistent result", () => {
  expect(resourceCoverageActions(resource, [], true, true).actions).toEqual(["create", "apply"]);
  expect(resourceCoverageActions(resource, [], true, false).actions).toEqual(["create"]);
});
it("keeps disabled definitions discoverable without offering run or duplicate creation", () => {
  expect(
    resourceCoverageActions(resource, [{ ...entry("inactive"), enabled: false }], true, false)
      .actions,
  ).toEqual(["cases"]);
});
it("only offers scope changes for excluded resources", () => {
  expect(
    resourceCoverageActions({ ...resource, in_scope: false }, [entry("failed")], true, true),
  ).toEqual({ actions: ["scope"], runIds: [] });
});
it("runs untested cases without offering results", () => {
  expect(resourceCoverageActions(resource, [entry("not_run")], true, false)).toEqual({
    actions: ["cases", "run"],
    runIds: ["not_run"],
  });
});
it("continues pending cases rather than rerunning passed cases in partial coverage", () => {
  expect(
    resourceCoverageActions(resource, [entry("passed"), entry("not_run")], true, false).runIds,
  ).toEqual(["not_run"]);
});
it("offers repair only for current failed results, not execution exceptions", () => {
  expect(resourceCoverageActions(resource, [entry("failed")], true, false).actions).toContain(
    "repair",
  );
  expect(
    resourceCoverageActions(resource, [entry("execution_failed")], true, false).actions,
  ).not.toContain("repair");
});
it("does not resubmit running cases and keeps their results accessible", () => {
  expect(resourceCoverageActions(resource, [entry("in_progress")], true, false).actions).toEqual([
    "results",
    "cases",
  ]);
});
it("does not silently truncate more than fifty cases into a partial run", () => {
  const cases = Array.from({ length: 51 }, (_, i) => entry("not_run", String(i)));
  expect(resourceCoverageActions(resource, cases, true, false).actions).not.toContain("run");
});
it("read-only access never offers mutations", () => {
  expect(resourceCoverageActions(resource, [entry("failed")], false, true).actions).toEqual([
    "results",
    "cases",
  ]);
});

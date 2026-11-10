/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import {
  readRunDetail,
  writeRunDetail,
  readRunListFilters,
  writeRunListFilters,
} from "./eval-run-navigation";

describe("run page navigation", () => {
  it("restores an exact run, Case, evidence tab, revision and outcome", () => {
    expect(
      readRunDetail(
        "?tab=runs&run_id=run-1&case_run_id=case-2&result_tab=evidence&run_case_result=fail&result_revision=3&run_view=compare",
      ),
    ).toEqual({
      runId: "run-1",
      caseRunId: "case-2",
      tab: "evidence",
      outcome: "fail",
      revision: 3,
      comparison: true,
    });
  });
  it("does not open stale run links in another functional page", () => {
    expect(readRunDetail("?tab=cases&run_id=run-1")).toEqual({});
    expect(readRunDetail("?tab=runs")).toEqual({});
  });
  it("normalizes invalid run detail filters", () => {
    expect(
      readRunDetail(
        "?tab=runs&run_id=run-1&result_tab=invalid&run_case_result=bad&result_revision=-1",
      ),
    ).toMatchObject({ tab: "result", outcome: "all", revision: undefined });
  });
  it("returns to the list without losing its filters or unrelated context", () => {
    const source = new URLSearchParams(
      "?tab=runs&run_q=stock&run_status=completed&run_page=2&context=keep",
    );
    const detail = writeRunDetail(source, {
      runId: "run-1",
      caseRunId: "case-2",
      tab: "evidence",
      comparison: true,
    });
    expect(source.has("run_id")).toBe(false);
    expect(writeRunDetail(detail, {}).toString()).toBe(source.toString());
  });
  it("clears stale Case and comparison state when opening another run", () => {
    const next = writeRunDetail(
      new URLSearchParams(
        "?tab=runs&run_id=old&case_run_id=old-case&result_tab=evidence&result_revision=2&run_view=compare",
      ),
      { runId: "new" },
    );
    expect(next.toString()).toBe("tab=runs&run_id=new");
  });
  it("round-trips run list search, status, result, dates and pagination", () => {
    const filters = {
      search: "采购订单",
      status: "completed" as const,
      outcome: "fail" as const,
      from: "2026-11-01",
      to: "2026-11-06",
      page: 3,
    };
    const params = writeRunListFilters(new URLSearchParams("context=keep"), filters);
    expect(readRunListFilters(params.toString())).toEqual(filters);
    expect(params.get("context")).toBe("keep");
  });
  it("normalizes unsupported list filters and invalid pages", () => {
    expect(
      readRunListFilters("?run_status=bad&run_result=bad&run_page=Infinity&run_from=bad"),
    ).toEqual({ search: "", status: "all", outcome: "all", from: "", to: "", page: 1 });
  });
  it("omits default filters from shareable URLs", () => {
    expect(
      writeRunListFilters(
        new URLSearchParams("run_q=old&run_page=3&run_status=failed"),
        readRunListFilters(""),
      ).toString(),
    ).toBe("");
  });
});

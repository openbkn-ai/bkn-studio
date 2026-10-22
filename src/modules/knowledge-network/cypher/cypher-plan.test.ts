/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { cypherPlanFrom, splitExplain, withExplain } from "./cypher-plan";

describe("splitExplain", () => {
  it("takes a leading EXPLAIN off, in any case and across lines", () => {
    expect(splitExplain("EXPLAIN MATCH (a:x) RETURN a")).toEqual({
      query: "MATCH (a:x) RETURN a",
      explain: true,
    });
    expect(splitExplain("  explain\nMATCH (a:x) RETURN a")).toEqual({
      query: "MATCH (a:x) RETURN a",
      explain: true,
    });
  });

  it("leaves a query without it, or one that only starts with the letters, as written", () => {
    expect(splitExplain("MATCH (a:x) RETURN a")).toEqual({
      query: "MATCH (a:x) RETURN a",
      explain: false,
    });
    expect(splitExplain("EXPLAINED").explain).toBe(false);
  });

  it("adds EXPLAIN once", () => {
    expect(withExplain("MATCH (a:x) RETURN a")).toBe("EXPLAIN MATCH (a:x) RETURN a");
    expect(withExplain("EXPLAIN MATCH (a:x) RETURN a")).toBe("EXPLAIN MATCH (a:x) RETURN a");
  });
});

describe("cypherPlanFrom", () => {
  it("reads the plan and drops what it does not know", () => {
    expect(
      cypherPlanFrom({
        shape: "aggregate",
        objects: [{ alias: "a", object_type_id: "teams" }, "junk"],
        relations: [{ relation_type_id: "r", source: "b", target: "a", direction: "incoming" }],
        conditions: [{ expression: "a.x > ?", properties: ["teams.x"], where: "having" }],
        columns: [{ name: "n", kind: "count", type: { kind: "integer" } }],
        ordering: [{ column: "n", descending: true }],
        limit: 1000,
        limit_source: "default",
        reads: ["teams.x"],
        warnings: ["no LIMIT"],
        warning_codes: ["default_limit"],
        sql: "SELECT …",
      }),
    ).toEqual({
      shape: "aggregate",
      objects: [{ alias: "a", object_type_id: "teams" }],
      relations: [{ relation_type_id: "r", source: "b", target: "a", direction: "incoming" }],
      conditions: [{ expression: "a.x > ?", properties: ["teams.x"], where: "having" }],
      grouping: [],
      columns: [{ name: "n", kind: "count", type: { kind: "integer" } }],
      ordering: [{ column: "n", descending: true }],
      limit: 1000,
      limit_source: "default",
      reads: ["teams.x"],
      row_filtered: [],
      warnings: ["no LIMIT"],
      warning_codes: ["default_limit"],
    });
  });

  it("is null without a shape", () => {
    expect(cypherPlanFrom(undefined)).toBeNull();
    expect(cypherPlanFrom({ objects: [] })).toBeNull();
  });
});

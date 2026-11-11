/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  cypherArguments,
  cypherFunctionNotices,
  shapeCypherResult,
  syncCypherInputs,
} from "./cypher-function";

describe("cypherFunctionNotices", () => {
  const kinds = (code: string, shape: "value" | "table") =>
    cypherFunctionNotices(code, shape).map((notice) => notice.kind);

  it("says nothing about a statement that needs no word", () => {
    expect(kinds("MATCH (s:supplier) WHERE s.id = $id RETURN count(s)", "value")).toEqual([]);
    expect(kinds("MATCH (s:supplier) RETURN s.name LIMIT 50", "table")).toEqual([]);
    expect(
      kinds("MATCH (o:order) RETURN o.amount ORDER BY o.created_at DESC LIMIT 1", "value"),
    ).toEqual([]);
  });

  it("tells a table without LIMIT that it is cut at the default and says so", () => {
    expect(cypherFunctionNotices("MATCH (s:supplier) RETURN s.name", "table")).toEqual([
      { kind: "table-default-limit", level: "info", rows: 1000 },
    ]);
  });

  it("reads the final RETURN's LIMIT, not an inner WITH's", () => {
    expect(
      kinds("MATCH (s:supplier) WITH s LIMIT 10 MATCH (s)-[:supplies]->(m) RETURN m.name", "table"),
    ).toEqual(["table-default-limit"]);
  });

  it("warns that LIMIT 1 without ORDER BY picks an arbitrary row", () => {
    expect(kinds("MATCH (o:order) WHERE o.code = $code RETURN o.amount LIMIT 1", "value")).toEqual([
      "value-unordered-limit",
    ]);
  });

  it("takes a parameter as SKIP and LIMIT", () => {
    expect(kinds("MATCH (s:supplier) RETURN s.name SKIP $offset LIMIT $n", "table")).toEqual([]);
    expect(kinds("MATCH (s) RETURN s.name LIMIT $`row count`", "table")).toEqual([]);
  });

  it("warns above the largest LIMIT bkn-backend runs", () => {
    expect(kinds("MATCH (s) RETURN s.name LIMIT 20000", "table")).toEqual(["limit-too-large"]);
  });

  it("ignores clauses written inside strings and comments", () => {
    expect(kinds("MATCH (s) WHERE s.note <> 'LIMIT 1' RETURN s.name // LIMIT 5", "table")).toEqual([
      "table-default-limit",
    ]);
    expect(kinds("MATCH (s) RETURN s.name /* ORDER BY s.id */ LIMIT 1", "value")).toEqual([
      "value-unordered-limit",
    ]);
  });

  it("keeps the positional parameter warning", () => {
    expect(kinds("MATCH (s {id: $0}) RETURN s.name LIMIT 5", "table")).toEqual(["positional"]);
  });
});

describe("syncCypherInputs", () => {
  it("follows the statement, keeping what was declared", () => {
    const inputs = [
      { name: "stale", type: "string", required: true, description: "gone" },
      { name: "min", type: "number", required: false, description: "lower bound", example: 3 },
    ];
    expect(
      syncCypherInputs(
        inputs,
        "MATCH (o:po) WHERE o.supplier = $id AND o.qty > $min RETURN count(o)",
      ),
    ).toEqual([
      { name: "id", type: "string", required: true, description: "" },
      { name: "min", type: "number", required: true, description: "lower bound", example: 3 },
    ]);
  });

  it("makes a new SKIP or LIMIT parameter a number", () => {
    expect(
      syncCypherInputs(
        [{ name: "n", type: "string", required: true, description: "kept" }],
        "MATCH (o:po) WHERE o.note = 'LIMIT $x' RETURN o.id SKIP $from LIMIT $n",
      ),
    ).toEqual([
      { name: "from", type: "number", required: true, description: "" },
      { name: "n", type: "string", required: true, description: "kept" },
    ]);
  });
});

describe("cypherArguments", () => {
  const inputs = [
    { name: "id", type: "string" },
    { name: "min", type: "number" },
    { name: "active", type: "boolean" },
    { name: "ids", type: "array", sub_parameters: [{ name: "items", type: "number" }] },
  ];

  it("converts to the declared types and drops the undeclared", () => {
    expect(
      cypherArguments(
        { id: 76904023, min: "5", active: "true", ids: ["1", 2], extra: "x" },
        inputs,
      ),
    ).toEqual({ parameters: { id: "76904023", min: 5, active: true, ids: [1, 2] } });
  });

  it.each([
    [
      { id: "S1", min: 1, active: true },
      { kind: "missing", names: ["ids"] },
    ],
    [
      { id: null, min: 1, active: true, ids: [1] },
      { kind: "missing", names: ["id"] },
    ],
    [
      { id: "S1", min: "many", active: true, ids: [1] },
      { kind: "type", name: "min", expected: "number" },
    ],
    [
      { id: "S1", min: 1, active: true, ids: [1, null] },
      { kind: "null-in-list", name: "ids" },
    ],
    [[1, 2], { kind: "not-object" }],
  ])("refuses %j", (args, problem) => {
    expect(cypherArguments(args, inputs)).toEqual({ problem });
  });
});

describe("shapeCypherResult", () => {
  const column = [{ name: "n" }];

  it("returns one value, or null for no row", () => {
    expect(shapeCypherResult({ columns: column, entries: [{ n: 16 }] }, "value")).toEqual({
      output: { value: 16 },
    });
    expect(shapeCypherResult({ columns: column, entries: [] }, "value")).toEqual({
      output: { value: null },
    });
  });

  it.each([
    [
      { columns: [{ name: "a" }, { name: "b" }], entries: [] },
      { kind: "columns", count: 2 },
    ],
    [
      { columns: [{ name: "s" }], entries: [{ s: {} }], valueTypes: { s: { kind: "object" } } },
      { kind: "graph", column: "s", valueKind: "object" },
    ],
    [
      { columns: column, entries: [{ n: [1] }] },
      { kind: "graph", column: "n", valueKind: "list" },
    ],
    [
      { columns: column, entries: [{ n: 1 }, { n: 2 }], limited: true },
      { kind: "rows", count: 2, more: true },
    ],
  ])("refuses a value result that does not fit: %j", (result, problem) => {
    expect(shapeCypherResult(result, "value")).toEqual({ problem });
  });

  it("passes the rows through for the table shape", () => {
    expect(
      shapeCypherResult({ columns: column, entries: [{ n: 1 }, { n: 2 }], limited: true }, "table"),
    ).toEqual({ output: { columns: column, entries: [{ n: 1 }, { n: 2 }], limited: true } });
  });
});

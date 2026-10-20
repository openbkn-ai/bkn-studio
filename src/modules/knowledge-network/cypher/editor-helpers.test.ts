/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { cypherSuggestions, type CypherCompletionSchema } from "./cypher-completion";
import { errorMarkFrom } from "./error-mark";
import { MAX_HISTORY, rememberQuery, stepHistory } from "./cypher-history";
import { nodeLookupQuery } from "./cypher-samples";

const schema: CypherCompletionSchema = {
  objectTypes: [
    { id: "teams", name: "球队" },
    { id: "my-type", name: "带横线" },
  ],
  relationTypes: [
    { id: "rel_goals_team", name: "进球所属球队", sourceId: "goals", targetId: "teams" },
  ],
  properties: { teams: [{ name: "team_name", displayName: "球队名" }] },
};

const labels = (before: string, full = before) =>
  cypherSuggestions(before, full, schema).map((item) => item.insert);

describe("cypherSuggestions", () => {
  it("offers object types after a node colon, quoting ids that need it", () => {
    expect(labels("MATCH (t:")).toEqual(["teams", "`my-type`"]);
    expect(labels("MATCH (t:te")).toEqual(["teams", "`my-type`"]);
  });

  it("offers relation types inside a relationship", () => {
    expect(labels("MATCH (g)-[r:")).toEqual(["rel_goals_team"]);
    expect(labels("MATCH (g)-[:")).toEqual(["rel_goals_team"]);
  });

  it("offers the properties of a labeled variable", () => {
    const full = "MATCH (t:teams) WHERE t.";
    expect(labels(full, full)).toEqual(["team_name"]);
    expect(labels("MATCH (x) WHERE x.", "MATCH (x) WHERE x.")).toEqual([]);
  });

  it("falls back to keywords and functions, and ignores colons inside strings", () => {
    expect(labels("MATCH (t:teams) ")).toContain("WHERE");
    expect(labels("MATCH (t:teams) ")).toContain("count()");
    expect(labels("MATCH (t) WHERE t.note = '(a:")).toContain("RETURN");
  });
});

describe("errorMarkFrom", () => {
  it("reads both position forms, columns counted from 0", () => {
    expect(errorMarkFrom("line 1, column 32: != is not supported", "x")).toMatchObject({
      line: 1,
      column: 33,
    });
    expect(errorMarkFrom("line 2:0: a WITH after …", "a\nb")).toMatchObject({ line: 2, column: 1 });
    expect(errorMarkFrom("line 9:0: x", "one line")?.line).toBe(1);
    expect(errorMarkFrom("no data source bound", "x")).toBeNull();
  });
});

describe("query history", () => {
  it("keeps the newest first without repeats, up to the limit", () => {
    let history: string[] = [];
    for (let index = 0; index < MAX_HISTORY + 3; index += 1)
      history = rememberQuery(history, `RETURN ${index}`);
    history = rememberQuery(history, `RETURN ${MAX_HISTORY}`);
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0]).toBe(`RETURN ${MAX_HISTORY}`);
    expect(history.filter((item) => item === `RETURN ${MAX_HISTORY}`)).toHaveLength(1);
    expect(rememberQuery(["a"], "  ")).toEqual(["a"]);
  });

  it("steps between the draft and the oldest entry", () => {
    expect(stepHistory(-1, 3, true)).toBe(0);
    expect(stepHistory(2, 3, true)).toBe(2);
    expect(stepHistory(0, 3, false)).toBe(-1);
    expect(stepHistory(-1, 0, true)).toBe(-1);
  });
});

describe("nodeLookupQuery", () => {
  it("reads a node back by its key, escaping string literals", () => {
    expect(nodeLookupQuery("teams", { key_id: 86 })).toBe(
      "MATCH (n:teams) WHERE n.key_id = 86 RETURN n LIMIT 1",
    );
    expect(nodeLookupQuery("my-type", { code: "O'Neil\\x", n: 2 })).toBe(
      "MATCH (n:`my-type`) WHERE n.code = 'O\\'Neil\\\\x' AND n.n = 2 RETURN n LIMIT 1",
    );
    expect(nodeLookupQuery("teams", { id: null })).toBeNull();
    expect(nodeLookupQuery("teams", {})).toBeNull();
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { ObjectTypeMeta } from "./overview.service";

import { buildEdgePageQuery, labelColumns, nodeFromRow } from "./overview-queries";

const players: ObjectTypeMeta = {
  id: "players",
  name: "球员",
  primaryKeys: ["key_id"],
  properties: [
    { name: "key_id" },
    { name: "family_name" },
    { name: "given_name" },
    { name: "Name" },
  ],
};

describe("labelColumns", () => {
  it("reads the keys, the configured property and the first name-like one", () => {
    expect(labelColumns(players, "family_name")).toEqual(["key_id", "family_name", "Name"]);
  });

  it("reads every property a label template names", () => {
    expect(labelColumns(players, "{given_name} {family_name}")).toEqual([
      "key_id",
      "given_name",
      "family_name",
      "Name",
    ]);
  });

  it("falls back to the first property that is not a key", () => {
    const meta = { ...players, properties: [{ name: "key_id" }, { name: "birth_date" }] };
    expect(labelColumns(meta)).toEqual(["key_id", "birth_date"]);
  });

  it("ignores a configured property the type does not declare", () => {
    expect(labelColumns(players, "missing")).toEqual(["key_id", "Name"]);
  });
});

describe("buildEdgePageQuery", () => {
  it("orders by both ends' keys and pages with SKIP and LIMIT", () => {
    const matches: ObjectTypeMeta = { ...players, id: "matches", primaryKeys: ["key_id"] };
    const { query } = buildEdgePageQuery(
      { id: "rel_goals_player", name: "", sourceOtId: "matches", targetOtId: "players" },
      { meta: matches, columns: ["key_id"] },
      { meta: players, columns: ["key_id", "family_name"] },
      { skip: 400, limit: 200 },
    );
    expect(query).toBe(
      [
        "MATCH (a:`matches`)-[:`rel_goals_player`]->(b:`players`)",
        "RETURN a.`key_id` AS `a__key_id`, b.`key_id` AS `b__key_id`, b.`family_name` AS `b__family_name`",
        "ORDER BY `a__key_id`, `b__key_id`",
        "SKIP 400",
        "LIMIT 200",
      ].join("\n"),
    );
  });
});

describe("nodeFromRow", () => {
  it("builds the ontology-query instance id and skips a row without its key", () => {
    const row = { b__key_id: "6207", b__family_name: "Messi" };
    expect(nodeFromRow(players, row, "b", "family_name")).toEqual({
      id: "players-6207",
      otId: "players",
      identity: { key_id: "6207" },
      display: "Messi",
    });
    expect(nodeFromRow(players, { b__family_name: "x" }, "b")).toBeNull();
  });
});

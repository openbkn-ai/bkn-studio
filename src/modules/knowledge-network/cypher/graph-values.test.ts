/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { VALUE_NODE_FILL_OPACITY, buildGraphOption } from "./graph-option";
import {
  GRAPH_NODE_LIMIT,
  VALUE_TYPE_PREFIX,
  buildCypherGraph,
  cypherCode,
  describeCell,
  graphKeyValue,
  resultHoldsGraph,
  resultToCsv,
  returnedNodeLabels,
  returnedVariables,
  valueNodeId,
  type CypherSchemaNames,
  type ObjectValue,
} from "./graph-values";

const names: CypherSchemaNames = {
  objectTypes: { goals: "进球", teams: "球队", material: "物料", product: "产品" },
  relationTypes: { rel_goals_team: "进球所属球队" },
  displayKeys: { teams: "team_name" },
};

function team(id: number, name?: string): ObjectValue {
  return {
    kind: "object",
    object_type_id: "teams",
    key: { team_id: { type: "integer", value: String(id) } },
    ...(name ? { properties: { team_name: name } } : {}),
  };
}

function goal(id: number): ObjectValue {
  return {
    kind: "object",
    object_type_id: "goals",
    key: { goal_id: { type: "string", value: `G${id}` } },
  };
}

describe("reading the query text", () => {
  it("ignores keywords inside strings and comments", () => {
    expect(cypherCode("WHERE t.note = 'RETURN x' // RETURN y\nRETURN t")).not.toMatch(
      /RETURN x|RETURN y/,
    );
    expect(
      returnedVariables("MATCH (t:teams) WHERE t.note = 'RETURN fake' RETURN t, t.name LIMIT 5"),
    ).toEqual(["t"]);
  });

  it("finds returned node variables with their labels, aliases and collect included", () => {
    const query =
      "MATCH (g:goals)-[r:rel_goals_team]->(t:`teams`) WHERE t.team_name = 'Brazil' RETURN g AS source, 'USES' AS relationType, t AS target, collect(DISTINCT g) AS evidence, count(g) AS n ORDER BY n DESC LIMIT 5";
    expect(returnedVariables(query)).toEqual(["g", "t"]);
    expect(returnedNodeLabels(query)).toEqual({ g: "goals", t: "teams" });
  });

  it("returns nothing for a count, and skips variables whose label it cannot see", () => {
    expect(returnedNodeLabels("MATCH (g:goals) RETURN count(*) AS n")).toEqual({});
    expect(returnedNodeLabels("MATCH (g:goals)-[r]->(x) RETURN g, r, x")).toEqual({ g: "goals" });
  });
});

describe("graph values", () => {
  it("keeps key numbers exact and big integers as text", () => {
    expect(graphKeyValue({ type: "integer", value: "42" })).toBe(42);
    expect(graphKeyValue({ type: "long", value: "9007199254740993" })).toBe("9007199254740993");
    expect(graphKeyValue({ type: "string", value: "007" })).toBe("007");
  });

  it("tells graph results from plain rows, value_types included", () => {
    expect(resultHoldsGraph({ entries: [{ n: 79 }] })).toBe(false);
    expect(resultHoldsGraph({ entries: [{ t: team(1) }] })).toBe(true);
    expect(resultHoldsGraph({ entries: [], valueTypes: { t: { kind: "object" } } })).toBe(true);
    expect(
      resultHoldsGraph({
        entries: [],
        valueTypes: { e: { kind: "list", element: { kind: "object" } } },
      }),
    ).toBe(true);
  });

  it("draws nodes and modeled relationships, named by the display property", () => {
    const relation = {
      kind: "relation",
      relation_type_id: "rel_goals_team",
      source: goal(1),
      target: team(7, "Brazil"),
    };
    const graph = buildCypherGraph(
      {
        entries: [
          { g: goal(1), r: relation, t: team(7, "Brazil") },
          { g: goal(2), r: { ...relation, source: goal(2) }, t: team(7) },
        ],
      },
      names,
    );
    expect(graph.nodes.map((node) => node.label).sort()).toEqual(["Brazil", "G1", "G2"]);
    expect(graph.nodes.find((node) => node.objectTypeId === "teams")).toMatchObject({
      objectTypeName: "球队",
      key: { team_id: 7 },
      properties: { team_name: "Brazil" },
    });
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.every((edge) => !edge.derived && edge.name === "进球所属球队")).toBe(true);
  });

  it("draws a derived edge dashed and counts its evidence", () => {
    const product = { kind: "object", object_type_id: "product", key: { pk: "P1" } };
    const material = (pk: string) => ({ kind: "object", object_type_id: "material", key: { pk } });
    const graph = buildCypherGraph(
      {
        entries: [
          {
            source: product,
            relationType: "USES",
            target: material("M1"),
            evidence: [goal(1), goal(2)],
          },
          { source: product, relationType: "USES", target: material("M2"), n: 4 },
          { source: product, relationType: "USES", target: material("M3"), codes: ["a", "b", "c"] },
        ],
      },
      names,
    );
    const derived = graph.edges.filter((edge) => edge.derived);
    expect(derived.map((edge) => [edge.name, edge.count])).toEqual([
      ["USES", 2],
      ["USES", 4],
      ["USES", 3],
    ]);
    const edges = buildGraphOption(graph).data.edges ?? [];
    expect(edges).toHaveLength(3);
    expect(edges.every((edge) => edge.style?.lineDash?.toString() === "4,3")).toBe(true);
    expect(edges.map((edge) => edge.style?.labelText)).toEqual([
      "USES (2)",
      "USES (4)",
      "USES (3)",
    ]);
  });

  it("draws a value end of a derived edge as a value node shared by the same value", () => {
    const graph = buildCypherGraph(
      {
        entries: [
          { source: team(1, "Argentina"), relationType: "主场结果", target: "胜", score: "3–3" },
          { source: team(2, "France"), relationType: "主场结果", target: "胜", score: "2–0" },
          { source: team(3, "Japan"), relationType: "主场结果", target: "未胜", score: "1–1" },
          { source: "胜", relationType: "主场结果", target: team(4, "Brazil") },
          // Both ends values, or an empty end: nothing to draw.
          { source: "胜", relationType: "主场结果", target: "未胜" },
          { source: team(5, "Spain"), relationType: "主场结果", target: null },
          { source: team(6, "Ghana"), relationType: "主场结果", target: "" },
          // A long text is prose, not a category.
          { source: team(7, "Peru"), relationType: "主场结果", target: "长".repeat(201) },
        ],
      },
      names,
    );
    const values = graph.nodes.filter((node) => node.value);
    expect(values.map((node) => [node.id, node.label, node.objectTypeId])).toEqual([
      ["value|主场结果|胜", "胜", `${VALUE_TYPE_PREFIX}主场结果`],
      ["value|主场结果|未胜", "未胜", `${VALUE_TYPE_PREFIX}主场结果`],
    ]);
    expect(values.every((node) => Object.keys(node.key).length === 0)).toBe(true);
    const derived = graph.edges.filter((edge) => edge.derived);
    expect(derived.map((edge) => [edge.source, edge.target])).toEqual([
      ["teams:team_id=1", "value|主场结果|胜"],
      ["teams:team_id=2", "value|主场结果|胜"],
      ["teams:team_id=3", "value|主场结果|未胜"],
      ["value|主场结果|胜", "teams:team_id=4"],
    ]);
    // The same value under another name is another node.
    expect(valueNodeId("结论", "胜")).not.toBe(valueNodeId("主场结果", "胜"));

    const drawn = buildGraphOption(graph).data.nodes ?? [];
    const win = drawn.find((node) => node.id === "value|主场结果|胜");
    expect(win?.style).toMatchObject({
      fill: win?.style?.stroke,
      fillOpacity: VALUE_NODE_FILL_OPACITY,
      lineDash: [4, 3],
    });
    expect(drawn.find((node) => node.id === "teams:team_id=1")?.style?.lineDash).toBeUndefined();
  });

  it("hangs scalar columns on the row's node, by prefix when the row has several", () => {
    const one = buildCypherGraph(
      { entries: [{ t: team(1), goal_count: 303, top: "Pelé", ids: [1, 2] }] },
      { ...names, displayKeys: { teams: "goal_count" } },
    );
    expect(one.nodes[0].computed).toEqual({ goal_count: 303, top: "Pelé" });
    // A computed value chosen as the caption becomes the label.
    expect(one.nodes[0].label).toBe("303");

    const two = buildCypherGraph(
      { entries: [{ g: goal(1), t: team(2), t_count: 4, g_minute: 12, total: 9 }] },
      names,
    );
    const byType = Object.fromEntries(two.nodes.map((node) => [node.objectTypeId, node.computed]));
    expect(byType.teams).toEqual({ count: 4 });
    expect(byType.goals).toEqual({ minute: 12 });
  });

  it("draws at most the node limit and drops edges to nodes left out", () => {
    const entries = Array.from({ length: GRAPH_NODE_LIMIT + 5 }, (_, index) => ({
      t: team(index),
    }));
    const graph = buildCypherGraph({ entries }, names);
    expect(graph.nodes).toHaveLength(GRAPH_NODE_LIMIT);
    expect(graph.totalNodes).toBe(GRAPH_NODE_LIMIT + 5);

    const small = buildCypherGraph(
      {
        entries: [
          { t: team(1) },
          {
            r: {
              kind: "relation",
              relation_type_id: "rel_goals_team",
              source: goal(1),
              target: team(1),
            },
          },
        ],
      },
      names,
      1,
    );
    expect(small.nodes).toHaveLength(1);
    expect(small.edges).toEqual([]);
  });
});

describe("table cells", () => {
  it("reads nodes, relationships, collections and scalars", () => {
    expect(describeCell(team(7, "Brazil"), names)).toMatchObject({
      kind: "object",
      text: "球队 · Brazil",
    });
    expect(
      describeCell(
        {
          kind: "relation",
          relation_type_id: "rel_goals_team",
          source: goal(1),
          target: team(7, "Brazil"),
        },
        names,
      ).text,
    ).toBe("G1 —进球所属球队→ Brazil");
    expect(describeCell([1, 2, 3], names)).toMatchObject({ kind: "json", text: "[3]" });
    expect(describeCell({ a: 1 }, names)).toMatchObject({ kind: "json", text: "{1}" });
    expect(describeCell("9007199254740993", names)).toEqual({
      kind: "scalar",
      text: "9007199254740993",
    });
  });

  it("exports CSV with quoting", () => {
    const csv = resultToCsv(
      {
        columns: [{ name: "t" }, { name: "note" }, { name: "ids" }],
        entries: [{ t: team(7, "Brazil"), note: 'say "hi", ok', ids: [1, 2] }],
      },
      names,
    );
    expect(csv).toBe('t,note,ids\n球队 · Brazil,"say ""hi"", ok","[1,2]"');
  });
});

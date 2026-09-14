/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildCypherQuery, cypherRowsToGraph, isCypherParseError, parseCypherPattern, type CypherPattern } from "./cypher-pattern";

describe("parseCypherPattern", () => {
  it("reads variables, labels and directed relationships from a chain", () => {
    const parsed = parseCypherPattern("MATCH (k:knowledge)-[:knowledge_cites_block]->(b:block)<-[r:fact_cites_block]-(f:fact) WHERE k.title <> 'x'");
    expect(isCypherParseError(parsed)).toBe(false);
    const pattern = parsed as CypherPattern;
    expect(pattern.nodes).toEqual([
      { variable: "k", label: "knowledge" },
      { variable: "b", label: "block" },
      { variable: "f", label: "fact" },
    ]);
    expect(pattern.edges).toEqual([
      { from: "k", to: "b", relation: "knowledge_cites_block" },
      { from: "f", to: "b", relation: "fact_cites_block" },
    ]);
  });

  it("prepends MATCH when the user starts with the pattern and accepts Chinese labels", () => {
    const parsed = parseCypherPattern("(k:知识)-[:knowledge_about_component]->(c:零件品类)") as CypherPattern;
    expect(parsed.body.startsWith("MATCH ")).toBe(true);
    expect(parsed.nodes.map((n) => n.label)).toEqual(["知识", "零件品类"]);
    expect(parsed.edges).toHaveLength(1);
  });

  it("reads several paths, comma-separated or as more MATCH clauses", () => {
    const many = parseCypherPattern("MATCH (a:x)-[:r]->(b:y) MATCH (b)-[:s]->(c:z)");
    expect(isCypherParseError(many)).toBe(false);
    expect((many as CypherPattern).edges).toEqual([
      { from: "a", to: "b", relation: "r" },
      { from: "b", to: "c", relation: "s" },
    ]);
    const comma = parseCypherPattern("MATCH (t:teams)<-[:r1]-(pa:appearances), (pa)-[:r2]->(p:players)");
    expect(isCypherParseError(comma)).toBe(false);
    expect((comma as CypherPattern).edges).toEqual([
      { from: "pa", to: "t", relation: "r1" },
      { from: "pa", to: "p", relation: "r2" },
    ]);
  });

  it("takes an undirected relation and an inline property map", () => {
    const undirected = parseCypherPattern("MATCH (a:x)-[:r]-(b:y)");
    expect((undirected as CypherPattern).edges).toEqual([{ from: "a", to: "b", relation: "r" }]);
    const inline = parseCypherPattern("MATCH (p:product {name: '问界M7'})-[:r]->(k:knowledge)");
    expect(isCypherParseError(inline)).toBe(false);
    expect((inline as CypherPattern).nodes).toEqual([
      { variable: "p", label: "product" },
      { variable: "k", label: "knowledge" },
    ]);
  });

  it("rejects empty input, a RETURN clause, and unlabeled variables", () => {
    expect(parseCypherPattern("   ")).toEqual({ error: "empty" });
    expect(parseCypherPattern("MATCH (k:knowledge) RETURN k.id")).toEqual({ error: "return_present" });
    expect(parseCypherPattern("MATCH (k)-[:r]->(b:block)")).toEqual({ error: "unlabeled", detail: "k" });
    expect(parseCypherPattern("MATCH WHERE 1 = 1")).toEqual({ error: "no_nodes" });
  });
});

describe("buildCypherQuery / cypherRowsToGraph", () => {
  const pattern = parseCypherPattern("MATCH (k:knowledge)-[:knowledge_cites_block]->(b:block)") as CypherPattern;
  const resolved = [
    { variable: "k", label: "knowledge", otId: "knowledge", otName: "知识", primaryKeys: ["id"] },
    { variable: "b", label: "block", otId: "block", otName: "原文块", primaryKeys: ["id"] },
  ];
  const edges = [{ from: "k", to: "b", relation: "knowledge_cites_block", relTypeId: "knowledge_cites_block", relTypeName: "引用原文块" }];

  it("projects every primary key with a stable alias and caps the rows", () => {
    expect(buildCypherQuery(pattern, resolved, 200)).toBe(
      "MATCH (k:knowledge)-[:knowledge_cites_block]->(b:block)\nRETURN DISTINCT k.id AS k__id, b.id AS b__id\nLIMIT 200",
    );
  });

  it("turns rows into deduplicated nodes and edges keyed like the rest of the explorer", () => {
    const graph = cypherRowsToGraph(
      [
        { k__id: "k1", b__id: "b1" },
        { k__id: "k1", b__id: "b2" },
        { k__id: "k2", b__id: null },
      ],
      resolved,
      edges,
    );
    expect(graph.nodes.map((n) => n.id)).toEqual(["knowledge-k1", "block-b1", "block-b2", "knowledge-k2"]);
    expect(graph.nodes[0]).toMatchObject({ otId: "knowledge", otName: "知识", identity: { id: "k1" }, display: "k1" });
    expect(graph.edges.map((e) => e.id)).toEqual(["knowledge-k1|knowledge_cites_block|block-b1", "knowledge-k1|knowledge_cites_block|block-b2"]);
  });
});

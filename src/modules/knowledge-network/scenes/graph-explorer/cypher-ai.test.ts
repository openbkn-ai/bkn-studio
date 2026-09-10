/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildCypherPrompt, extractCypherFragment } from "./cypher-ai";

describe("buildCypherPrompt", () => {
  it("lists object types with properties and directed relation types", () => {
    const { system, user } = buildCypherPrompt(
      {
        object_types: [{ id: "knowledge", name: "知识", comment: "抽取的知识", data_properties: [{ name: "id", type: "string" }, { name: "title" }] }],
        relation_types: [{ id: "knowledge_cites_block", name: "引用原文块", sourceId: "knowledge", targetId: "block" }],
      },
      "  问界M7 引用了哪些原文块  ",
    );
    expect(system).toContain("- knowledge（知识） — 抽取的知识");
    expect(system).toContain("属性: id:string, title");
    expect(system).toContain("(knowledge)-[:knowledge_cites_block]->(block)");
    expect(system).toContain("不要写 RETURN");
    expect(user).toBe("问界M7 引用了哪些原文块");
  });
});

describe("extractCypherFragment", () => {
  it("strips fences, leading prose and a trailing RETURN", () => {
    expect(extractCypherFragment("好的，模式如下：\n```cypher\nMATCH (k:knowledge)-[:knowledge_cites_block]->(b:block)\nWHERE k.title <> ''\nRETURN k.id\n```")).toBe(
      "MATCH (k:knowledge)-[:knowledge_cites_block]->(b:block)\nWHERE k.title <> ''",
    );
    expect(extractCypherFragment("MATCH (p:product) LIMIT 5;")).toBe("MATCH (p:product)");
    expect(extractCypherFragment("(p:product)")).toBe("(p:product)");
  });
});

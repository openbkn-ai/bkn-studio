/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildCypherPrompt, extractCypherFragment, inlineMapsToWhere, type CypherPromptTexts } from "./cypher-ai";

const texts: CypherPromptTexts = {
  intro: "INTRO",
  rulesHeader: "RULES",
  rules: ["only MATCH", "no RETURN"],
  propertiesLabel: "props",
  objectTypesHeader: "OBJECTS",
  relationTypesHeader: "RELATIONS",
};

describe("buildCypherPrompt", () => {
  it("lists object types with properties and directed relation types", () => {
    const { system, user } = buildCypherPrompt(
      {
        object_types: [{ id: "knowledge", name: "知识", comment: "抽取的知识", data_properties: [{ name: "id", type: "string" }, { name: "title" }] }],
        relation_types: [{ id: "knowledge_cites_block", name: "引用原文块", sourceId: "knowledge", targetId: "block" }],
      },
      "  问界M7 引用了哪些原文块  ",
      texts,
    );
    expect(system).toContain("- knowledge (知识) - 抽取的知识");
    expect(system).toContain("props: id:string, title");
    expect(system).toContain("(knowledge)-[:knowledge_cites_block]->(block)");
    expect(system).toContain("1. only MATCH\n2. no RETURN");
    expect(system.startsWith("INTRO\n\nRULES\n")).toBe(true);
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

  it("moves inline property maps into the WHERE clause", () => {
    expect(inlineMapsToWhere("MATCH (p:product {name: '问界M7'})<-[:knowledge_about_product]-(k:knowledge)")).toBe(
      "MATCH (p:product)<-[:knowledge_about_product]-(k:knowledge)\nWHERE p.name = '问界M7'",
    );
    expect(inlineMapsToWhere("MATCH (p:product {name: 'a, b', seats: 5})-[:r]->(k:knowledge) WHERE k.title <> ''")).toBe(
      "MATCH (p:product)-[:r]->(k:knowledge) WHERE p.name = 'a, b' AND p.seats = 5 AND k.title <> ''",
    );
    expect(inlineMapsToWhere("MATCH (p:product)")).toBe("MATCH (p:product)");
  });
});

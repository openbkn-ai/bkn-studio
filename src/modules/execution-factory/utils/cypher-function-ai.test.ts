/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  applySuggestedParameters,
  cypherFunctionMessage,
  parseCypherFunctionAnswer,
  type CypherFunctionAiTexts,
} from "./cypher-function-ai";

const texts: CypherFunctionAiTexts = {
  request: "REQUEST {{description}}",
  contract: "CONTRACT",
  parameters: "PARAMETERS",
  trial: "TRIAL",
  shapeValue: "VALUE",
  shapeTable: "TABLE",
  answer: "ANSWER",
  existing: "EXISTING",
};

describe("cypherFunctionMessage", () => {
  it("states the contract for the chosen shape and lists the declared parameters", () => {
    const message = cypherFunctionMessage({
      description: "  count a supplier's orders ",
      shape: "value",
      inputs: [
        { name: "code", type: "string", description: "supplier code" },
        { name: "min", type: "number" },
      ],
      texts,
    });
    expect(message.split("\n")).toEqual([
      "REQUEST count a supplier's orders",
      "CONTRACT",
      "- PARAMETERS",
      "- TRIAL",
      "- VALUE",
      "- ANSWER",
      "EXISTING",
      "- $code (string): supplier code",
      "- $min (number)",
    ]);
  });

  it("asks for a table when the function returns one, and lists nothing when none is declared", () => {
    const message = cypherFunctionMessage({ description: "x", shape: "table", inputs: [], texts });
    expect(message).toContain("- TABLE");
    expect(message).not.toContain("VALUE");
    expect(message).not.toContain("EXISTING");
  });
});

describe("parseCypherFunctionAnswer", () => {
  const answer = [
    "试跑通过。",
    "```cypher",
    "MATCH (o:po) WHERE o.supplier_code = $supplier_code AND o.qty > $min RETURN count(o) AS n",
    "```",
    "参数：",
    "```json",
    JSON.stringify([
      { name: "supplier_code", type: "string", description: "供应商编码", example: "S001" },
      { name: "$min", type: "integer", description: "最小数量", example: 5 },
      { name: "unused", type: "string", description: "语句里没有" },
      { name: "odd", type: "date" },
    ]),
    "```",
  ].join("\n");

  it("takes the query from the cypher block even though the json block comes last", () => {
    expect(parseCypherFunctionAnswer(answer).query).toBe(
      "MATCH (o:po) WHERE o.supplier_code = $supplier_code AND o.qty > $min RETURN count(o) AS n",
    );
  });

  it("keeps what it says about parameters the query uses, and only types it knows", () => {
    expect(parseCypherFunctionAnswer(answer).parameters).toEqual({
      supplier_code: { type: "string", description: "供应商编码", example: "S001" },
      min: { type: "integer", description: "最小数量", example: 5 },
    });
  });

  it("reads a {parameters: [...]} object too, and ignores a json block that is no list", () => {
    const wrapped =
      '```cypher\nMATCH (s) WHERE s.id IN $ids RETURN s.name\n```\n```json\n{"parameters": [{"name": "ids", "type": "array", "example": [1, 2]}]}\n```\n```json\nnot json\n```';
    expect(parseCypherFunctionAnswer(wrapped).parameters).toEqual({
      ids: { type: "array", example: [1, 2] },
    });
  });

  it("finds no query in an answer that has none", () => {
    expect(parseCypherFunctionAnswer("没有找到相关的对象类。").query).toBe("");
  });
});

describe("applySuggestedParameters", () => {
  it("fills only what the author left blank", () => {
    expect(
      applySuggestedParameters(
        [
          { name: "code", type: "string", required: true, description: "" },
          { name: "min", type: "string", required: true, description: "作者写的", example: 3 },
          { name: "other", type: "string", required: true, description: "" },
        ],
        {
          code: { type: "string", description: "供应商编码", example: "S001" },
          min: { type: "number", description: "Agent 写的", example: 5 },
        },
      ),
    ).toEqual([
      { name: "code", type: "string", required: true, description: "供应商编码", example: "S001" },
      { name: "min", type: "string", required: true, description: "作者写的", example: 3 },
      { name: "other", type: "string", required: true, description: "" },
    ]);
  });

  it("gives a new list parameter its item type from the example", () => {
    expect(
      applySuggestedParameters([{ name: "ids", type: "string", required: true, description: "" }], {
        ids: { type: "array", example: [1, 2] },
      }),
    ).toEqual([
      {
        name: "ids",
        type: "array",
        required: true,
        description: "",
        example: [1, 2],
        sub_parameters: [{ name: "items", type: "number" }],
      },
    ]);
  });
});

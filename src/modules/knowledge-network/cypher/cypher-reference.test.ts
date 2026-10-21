/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { cypherReferenceEnUS } from "../locales/en-US/cypher-reference";
import { cypherReferenceZhCN } from "../locales/zh-CN/cypher-reference";
import { cypherReference } from "./cypher-reference";

describe("cypherReference", () => {
  it("has the same sections, rules and notes in both languages", () => {
    const shape = (texts: typeof cypherReferenceZhCN) =>
      texts.map((section) => [section.rules.length, section.notes?.length ?? 0]);
    expect(shape(cypherReferenceZhCN)).toEqual(shape(cypherReferenceEnUS));
    // Each note belongs to the example in the same place.
    const examples = cypherReference("zh-CN").map((section) => section.examples?.length ?? 0);
    expect(cypherReferenceZhCN.map((section) => section.notes?.length ?? 0)).toEqual(examples);
  });

  it("speaks the reader's language", () => {
    expect(cypherReference("zh-CN").map((section) => section.title)).toContain("不支持");
    expect(cypherReference("en-US").map((section) => section.title)).toContain("Not supported");
  });

  it("keeps the examples the same in both languages, and within the subset", () => {
    const queries = (language: string) =>
      cypherReference(language)
        .flatMap((section) => section.examples ?? [])
        .map((example) => example.query);
    expect(queries("zh-CN")).toEqual(queries("en-US"));
    for (const query of queries("zh-CN")) {
      expect(query).not.toContain("!=");
      expect(query).not.toMatch(/-\[\]-/);
      // The page runs complete queries only.
      expect(query).toMatch(/\bRETURN\b/);
    }
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { cypherReference } from "./cypher-reference";

describe("cypherReference", () => {
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

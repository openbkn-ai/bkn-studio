/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { cypherQueryPart as enUS } from "../locales/en-US/cypher-query";
import { cypherQueryPart as zhCN } from "../locales/zh-CN/cypher-query";
import { previewRawText } from "./raw-preview";

const lines = (count: number) => Array.from({ length: count }, (_, i) => `line ${i}`).join("\n");

describe("previewRawText", () => {
  it("keeps text within both budgets whole", () => {
    const text = lines(10);
    expect(previewRawText(text, 10, 1000)).toEqual({
      text,
      shownLines: 10,
      totalLines: 10,
      truncated: false,
    });
    expect(previewRawText("", 10, 1000)).toMatchObject({ text: "", truncated: false });
  });

  it("cuts at the line budget and counts every line", () => {
    const preview = previewRawText(lines(69_041), 2000, 10_000_000);
    expect(preview).toMatchObject({ truncated: true, cutBy: "lines" });
    expect(preview.shownLines).toBe(2000);
    expect(preview.totalLines).toBe(69_041);
    expect(preview.text.endsWith("line 1999")).toBe(true);
  });

  it("cuts at the character budget when lines are long", () => {
    const text = "x".repeat(5000);
    const preview = previewRawText(text, 2000, 1000);
    expect(preview).toMatchObject({ totalLines: 1, truncated: true, cutBy: "chars" });
    expect(preview.text).toHaveLength(1000);
  });

  it("tells a cut mid-line by characters, not by a line count that looks whole", () => {
    // Few lines, one of them very long: the cut lands inside line 3 of 5.
    const text = ["{", '  "a": 1,', `  "big": "${"y".repeat(5000)}",`, '  "b": 2', "}"].join("\n");
    const preview = previewRawText(text, 2000, 1000);
    expect(preview).toMatchObject({ truncated: true, cutBy: "chars", totalLines: 5 });
    expect(preview.text).toHaveLength(1000);
  });
});

describe("raw view messages", () => {
  // The scene test's t() returns keys, so a message under the wrong block would only show on screen.
  it.each([
    ["zh-CN", zhCN],
    ["en-US", enUS],
  ])("%s has every message the raw view reads", (_, part) => {
    const raw: Record<string, string> = part.cypherQuery.raw;
    for (const key of ["download", "truncated", "truncatedChars"]) {
      expect(raw[key], key).toMatch(/\S/);
    }
    expect(raw.truncated).toContain("{{shown}}");
    expect(raw.truncatedChars).toContain("{{shown}}");
  });
});

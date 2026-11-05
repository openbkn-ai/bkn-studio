/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

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
    expect(preview.truncated).toBe(true);
    expect(preview.shownLines).toBe(2000);
    expect(preview.totalLines).toBe(69_041);
    expect(preview.text.endsWith("line 1999")).toBe(true);
  });

  it("cuts at the character budget when lines are long", () => {
    const text = "x".repeat(5000);
    const preview = previewRawText(text, 2000, 1000);
    expect(preview).toMatchObject({ shownLines: 1, totalLines: 1, truncated: true });
    expect(preview.text).toHaveLength(1000);
  });
});

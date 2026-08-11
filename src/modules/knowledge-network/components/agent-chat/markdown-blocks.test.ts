/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { closeOpenMarkdown, splitMarkdownBlocks } from "./markdown-blocks";

describe("splitMarkdownBlocks", () => {
  it("splits by blank lines and drops the blank line itself", () => {
    expect(splitMarkdownBlocks("## Title\n\nBody one\n\nBody two")).toEqual(["## Title", "Body one", "Body two"]);
  });

  it("does not split blank lines inside fenced code blocks", () => {
    const text = "Intro\n\n```sql\nSELECT 1\n\nFROM t\n```\n\nOutro";
    expect(splitMarkdownBlocks(text)).toEqual(["Intro", "```sql\nSELECT 1\n\nFROM t\n```", "Outro"]);
  });

  it("does not split blank lines between loose-list items", () => {
    const text = "1. Alpha\n\n2. Beta\n\nEnd";
    expect(splitMarkdownBlocks(text)).toEqual(["1. Alpha\n\n2. Beta", "End"]);
  });

  it("keeps a table as one block", () => {
    const text = "| a | b |\n| --- | --- |\n| 1 | 2 |\n\nNext paragraph";
    expect(splitMarkdownBlocks(text)).toEqual(["| a | b |\n| --- | --- |\n| 1 | 2 |", "Next paragraph"]);
  });

  it("keeps completed blocks as the same string during streaming increments", () => {
    const head = splitMarkdownBlocks("## Title\n\nBody one")[0];
    const later = splitMarkdownBlocks("## Title\n\nBody one\n\nBody two is streaming")[0];
    expect(later).toBe(head);
  });
});

describe("closeOpenMarkdown", () => {
  it("completes an open code fence", () => {
    expect(closeOpenMarkdown("```sql\nSELECT 1")).toBe("```sql\nSELECT 1\n```");
  });

  it("leaves a closed fence unchanged", () => {
    const done = "```sql\nSELECT 1\n```";
    expect(closeOpenMarkdown(done)).toBe(done);
  });

  it("completes open bold syntax", () => {
    expect(closeOpenMarkdown("**Kashima Stadium")).toBe("**Kashima Stadium**");
  });

  it("completes open inline code syntax", () => {
    expect(closeOpenMarkdown("Query with `SELECT")).toBe("Query with `SELECT`");
  });

  it("closes inline code before bold when code is inside bold", () => {
    expect(closeOpenMarkdown("**`run_sql")).toBe("**`run_sql`**");
  });

  it("completes bold syntax across lines", () => {
    expect(closeOpenMarkdown("**Conclusion: this is a longer bold section\nstill streaming")).toBe(
      "**Conclusion: this is a longer bold section\nstill streaming**",
    );
  });

  it("matches only within the current paragraph", () => {
    const block = "1. **Alpha**\n\n2. **Beta";
    expect(closeOpenMarkdown(block)).toBe(`${block}**`);
  });

  it("does not pair inline markers inside a paragraph with a fence line", () => {
    const block = "- Example:\n\n  ```sql\n  SELECT 1\n  ```";
    expect(closeOpenMarkdown(block)).toBe(block);
  });

  it("leaves paired syntax unchanged", () => {
    const done = "**Kashima** Stadium `run_sql` done";
    expect(closeOpenMarkdown(done)).toBe(done);
  });
});

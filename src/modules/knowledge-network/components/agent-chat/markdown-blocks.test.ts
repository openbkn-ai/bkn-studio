/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { closeOpenMarkdown, splitMarkdownBlocks } from "./markdown-blocks";

describe("splitMarkdownBlocks", () => {
  it("按空行切块，丢掉空行本身", () => {
    expect(splitMarkdownBlocks("## 标题\n\n正文一\n\n正文二")).toEqual(["## 标题", "正文一", "正文二"]);
  });

  it("围栏代码块内部的空行不切", () => {
    const text = "前言\n\n```sql\nSELECT 1\n\nFROM t\n```\n\n后记";
    expect(splitMarkdownBlocks(text)).toEqual(["前言", "```sql\nSELECT 1\n\nFROM t\n```", "后记"]);
  });

  it("loose list 的项间空行不切（否则拆成两个列表、有序列表重新编号）", () => {
    const text = "1. 甲\n\n2. 乙\n\n结尾";
    expect(splitMarkdownBlocks(text)).toEqual(["1. 甲\n\n2. 乙", "结尾"]);
  });

  it("表格整块保留（GFM 表格内无空行）", () => {
    const text = "| a | b |\n| --- | --- |\n| 1 | 2 |\n\n下一段";
    expect(splitMarkdownBlocks(text)).toEqual(["| a | b |\n| --- | --- |\n| 1 | 2 |", "下一段"]);
  });

  it("流式增量下已完成的块保持同一字符串（memo 才拦得住重渲）", () => {
    const head = splitMarkdownBlocks("## 标题\n\n正文一")[0];
    const later = splitMarkdownBlocks("## 标题\n\n正文一\n\n正文二还在写")[0];
    expect(later).toBe(head);
  });
});

describe("closeOpenMarkdown", () => {
  it("补未闭合的代码围栏", () => {
    expect(closeOpenMarkdown("```sql\nSELECT 1")).toBe("```sql\nSELECT 1\n```");
  });

  it("已闭合的围栏不动", () => {
    const done = "```sql\nSELECT 1\n```";
    expect(closeOpenMarkdown(done)).toBe(done);
  });

  it("补未闭合的加粗", () => {
    expect(closeOpenMarkdown("**鹿岛体育场")).toBe("**鹿岛体育场**");
  });

  it("补未闭合的行内代码", () => {
    expect(closeOpenMarkdown("查询用 `SELECT")).toBe("查询用 `SELECT`");
  });

  it("代码在加粗里时先闭代码再闭加粗", () => {
    expect(closeOpenMarkdown("**`run_sql")).toBe("**`run_sql`**");
  });

  it("补跨行的加粗（只扫最后一行会漏）", () => {
    expect(closeOpenMarkdown("**结论：这里是一段比较长的加粗\n还在往下写")).toBe(
      "**结论：这里是一段比较长的加粗\n还在往下写**",
    );
  });

  it("配对只看当前段落，前面已闭合的段落不参与", () => {
    const block = "1. **甲**\n\n2. **乙";
    expect(closeOpenMarkdown(block)).toBe(`${block}**`);
  });

  it("段里有围栏行就不配对（反引号会把计数带偏）", () => {
    const block = "- 例子：\n\n  ```sql\n  SELECT 1\n  ```";
    expect(closeOpenMarkdown(block)).toBe(block);
  });

  it("成对的语法不动", () => {
    const done = "**鹿岛**体育场 `run_sql` 完事";
    expect(closeOpenMarkdown(done)).toBe(done);
  });
});

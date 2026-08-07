/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownView } from "./ChatPane";

describe("MarkdownView", () => {
  it("多块正文渲染成真正的块级元素（不是一坨纯文本）", () => {
    const { container } = render(<MarkdownView text={"## 鹿岛体育场\n\n位于日本茨城县。\n\n- 甲\n- 乙"} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("鹿岛体育场");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("流式中也渲染 Markdown，尾块的半截语法补全后不露原始标记", () => {
    const { container } = render(<MarkdownView text={"## 结论\n\n最像动物的是 **鹿岛"} streaming />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("结论");
    expect(container.querySelector("strong")?.textContent).toBe("鹿岛");
    expect(container.textContent).not.toContain("**");
  });

  it("非流式不分块：跨块的引用式链接定义照常解析（分块会把它切坏）", () => {
    const { container } = render(<MarkdownView text={"见 [文档][d] 说明。\n\n[d]: https://example.com"} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.textContent).toBe("文档");
    expect(container.textContent).not.toContain("[d]");
  });

  it("流式中未闭合的代码围栏渲染成 pre，而不是漏出 ```", () => {
    const { container } = render(<MarkdownView text={"查询：\n\n```sql\nSELECT 1"} streaming />);
    expect(container.querySelector("pre code")?.textContent?.trim()).toBe("SELECT 1");
    expect(container.textContent).not.toContain("```");
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownText } from "./MarkdownText";

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaid }));

describe("MarkdownText", () => {
  it("多块正文渲染成真正的块级元素（不是一坨纯文本）", () => {
    const { container } = render(
      <MarkdownText text={"## 鹿岛体育场\n\n位于日本茨城县。\n\n- 甲\n- 乙"} />,
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("鹿岛体育场");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("流式中也渲染 Markdown，尾块的半截语法补全后不露原始标记", () => {
    const { container } = render(
      <MarkdownText text={"## 结论\n\n最像动物的是 **鹿岛"} streaming />,
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("结论");
    expect(container.querySelector("strong")?.textContent).toBe("鹿岛");
    expect(container.textContent).not.toContain("**");
  });

  it("非流式不分块：跨块的引用式链接定义照常解析（分块会把它切坏）", () => {
    const { container } = render(
      <MarkdownText text={"见 [文档][d] 说明。\n\n[d]: https://example.com"} />,
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.textContent).toBe("文档");
    expect(container.textContent).not.toContain("[d]");
  });

  it("流式中未闭合的代码围栏渲染成 pre，而不是漏出 ```", () => {
    const { container } = render(<MarkdownText text={"查询：\n\n```sql\nSELECT 1"} streaming />);
    expect(container.querySelector("pre code")?.textContent?.trim()).toBe("SELECT 1");
    expect(container.textContent).not.toContain("```");
  });
});

describe("MarkdownText 里的 mermaid", () => {
  const DIAGRAM = "graph LR\n  A --> B";

  beforeEach(() => {
    mermaid.initialize.mockReset();
    mermaid.parse.mockReset().mockResolvedValue({ diagramType: "flowchart" });
    mermaid.render.mockReset().mockResolvedValue({ svg: '<svg data-testid="diagram"></svg>' });
  });

  it("mermaid 代码块画成图，用 strict 安全级别", async () => {
    render(<MarkdownText text={"```mermaid\n" + DIAGRAM + "\n```"} />);
    expect(await screen.findByTestId("diagram")).toBeInTheDocument();
    expect(mermaid.render).toHaveBeenCalledWith(expect.any(String), DIAGRAM);
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict", startOnLoad: false }),
    );
  });

  it("不是合法的图时保留原文", async () => {
    mermaid.parse.mockRejectedValue(new Error("Parse error on line 1"));
    const { container } = render(<MarkdownText text={"```mermaid\nnot a diagram\n```"} />);
    await waitFor(() => expect(mermaid.parse).toHaveBeenCalled());
    expect(mermaid.render).not.toHaveBeenCalled();
    expect(container.querySelector("pre code")?.textContent).toBe("not a diagram");
  });

  it("其他代码块不受影响", () => {
    const { container } = render(<MarkdownText text={"```sql\nselect 1\n```"} />);
    expect(container.querySelector("pre code.language-sql")?.textContent).toBe("select 1\n");
    expect(mermaid.parse).not.toHaveBeenCalled();
  });

  // Drawn diagrams are kept for the page, so each test below draws a source of its own.
  it("流式中还没写完的尾块只显示原文，写完的块才画图", async () => {
    const source = "graph LR\n  A --> C";
    const { container, rerender } = render(
      <MarkdownText text={"## 流程\n\n```mermaid\ngraph LR\n  A -->"} streaming />,
    );
    expect(container.querySelector("pre code")?.textContent).toContain("A -->");
    expect(mermaid.parse).not.toHaveBeenCalled();
    rerender(
      <MarkdownText text={"## 流程\n\n```mermaid\n" + source + "\n```\n\n说明"} streaming />,
    );
    expect(await screen.findByTestId("diagram")).toBeInTheDocument();
    expect(mermaid.parse).toHaveBeenCalledTimes(1);
  });

  it("流式结束改为整体渲染时，已画好的图直接保留，不退回原文、不重画", async () => {
    const text = "## 流程\n\n```mermaid\ngraph LR\n  A --> D\n```\n\n说明";
    const { container, rerender } = render(<MarkdownText text={text} streaming />);
    expect(await screen.findByTestId("diagram")).toBeInTheDocument();
    rerender(<MarkdownText text={text} />);
    expect(screen.getByTestId("diagram")).toBeInTheDocument();
    expect(container.querySelector("pre code.language-mermaid")).toBeNull();
    await Promise.resolve();
    expect(mermaid.render).toHaveBeenCalledTimes(1);
  });
});

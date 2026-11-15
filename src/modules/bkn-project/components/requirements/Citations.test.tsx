/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequirementDocumentContent } from "@/modules/bkn-project/types/requirements";

import { DocumentViewer } from "./Citations";

const getDocumentMock = vi.hoisted(() => vi.fn());
const scrollIntoView = vi.fn();

vi.mock("@/modules/bkn-project/services/requirements.service", () => ({
  getDocument: getDocumentMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const MARKDOWN = [
  "# 采购规范",
  "",
  "> 以合同为准。",
  "",
  "| 字段 | 说明 |",
  "| --- | --- |",
  "| 合同号 | 每份合同唯一 |",
  "| 供应商 | 签约的一方 |",
  "",
  "```",
  "code line",
  "```",
].join("\n");

function document(content: string, format: string): RequirementDocumentContent {
  return {
    blocks: [],
    content,
    createTime: 0,
    docType: "business",
    format,
    id: "d1",
    name: format === "markdown" ? "spec.md" : "spec.txt",
    size: content.length,
    uploaderId: "u1",
  };
}

describe("DocumentViewer", () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
    scrollIntoView.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it("renders Markdown and marks the table row a quote is in", async () => {
    getDocumentMock.mockResolvedValue(document(MARKDOWN, "markdown"));
    const start = MARKDOWN.indexOf("每份合同唯一");
    render(
      <DocumentViewer
        documentId="d1"
        onClose={() => undefined}
        projectId="p1"
        range={{ end: start + "每份合同唯一".length, start }}
      />,
    );

    expect(await screen.findByRole("heading", { name: "采购规范" })).toBeInTheDocument();
    expect(screen.queryByText(/# 采购规范/)).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("以合同为准。").closest("blockquote")).not.toBeNull();
    expect(screen.getByText("code line").closest("pre")).not.toBeNull();

    const cited = window.document.querySelectorAll("[data-cited]");
    expect(cited).toHaveLength(1);
    expect(cited[0].tagName).toBe("TR");
    expect(cited[0].textContent).toContain("合同号");
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it("marks each block a quote runs across, and nothing without a quote", async () => {
    getDocumentMock.mockResolvedValue(document(MARKDOWN, "markdown"));
    const start = MARKDOWN.indexOf("采购规范");
    const view = render(
      <DocumentViewer
        documentId="d1"
        onClose={() => undefined}
        projectId="p1"
        range={{ end: MARKDOWN.indexOf("以合同为准") + 2, start }}
      />,
    );
    await screen.findByRole("heading", { name: "采购规范" });
    expect(
      [...window.document.querySelectorAll("[data-cited]")].map((node) => node.tagName),
    ).toEqual(["H1", "P"]);
    view.unmount();

    render(<DocumentViewer documentId="d1" onClose={() => undefined} projectId="p1" />);
    await screen.findByRole("heading", { name: "采购规范" });
    expect(window.document.querySelectorAll("[data-cited]")).toHaveLength(0);
  });

  it("keeps plain text as it is, the quote marked exactly", async () => {
    const text = "# not a heading\nthe quoted words here";
    getDocumentMock.mockResolvedValue(document(text, "text"));
    const start = text.indexOf("quoted words");
    render(
      <DocumentViewer
        documentId="d1"
        onClose={() => undefined}
        projectId="p1"
        range={{ end: start + "quoted words".length, start }}
      />,
    );

    const mark = await screen.findByText("quoted words");
    expect(mark.tagName).toBe("MARK");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

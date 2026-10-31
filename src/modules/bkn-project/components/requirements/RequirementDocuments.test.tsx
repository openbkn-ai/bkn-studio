/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { RequirementDocument } from "@/modules/bkn-project/types/requirements";

const uploadDocumentsMock = vi.hoisted(() => vi.fn());
const setDocumentTypeMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: vi.fn() } }),
}));

vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  setDocumentType: setDocumentTypeMock,
  uploadDocuments: uploadDocumentsMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { RequirementDocuments } from "./RequirementDocuments";

const documents: RequirementDocument[] = [
  {
    createTime: Date.parse("2026-10-29T09:00:00"),
    docType: "prd",
    format: "markdown",
    id: "d1",
    name: "ward-prd.md",
    size: 2048,
    uploaderId: "me",
  },
];

function renderDocuments(canEdit = true) {
  const onChanged = vi.fn();
  const view = renderWithoutAntdStyles(
    <RequirementDocuments
      canEdit={canEdit}
      documents={documents}
      onChanged={onChanged}
      projectId="p1"
    />,
  );
  return { onChanged, view };
}

describe("RequirementDocuments", () => {
  beforeAll(() => {
    // Ant Design reads breakpoints, which jsdom lacks.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
  });

  it("uploads documents and says how each went", async () => {
    uploadDocumentsMock.mockResolvedValue([
      { code: "", documentId: "d3", name: "new.md", outcome: "created" },
      { code: "Requirement.UnsupportedFormat", documentId: "", name: "a.pdf", outcome: "rejected" },
    ]);
    const { onChanged } = renderDocuments();

    fireEvent.click(screen.getByRole("button", { name: "上传文档" }));
    const dialog = within(await screen.findByRole("dialog"));
    const input = dialog
      .getByText("拖入文件，或点击选择")
      .closest(".ant-upload")!
      .querySelector("input")!;
    // Two files of one name stay two, and one of them can be taken out on its own.
    fireEvent.change(input, {
      target: { files: [new File(["# x"], "new.md"), new File(["# y"], "new.md")] },
    });
    const listed = () => document.querySelectorAll(".ant-upload-list-item");
    await waitFor(() => expect(listed()).toHaveLength(2));
    fireEvent.click(listed()[1].querySelector(".ant-upload-list-item-actions button")!);
    await waitFor(() => expect(listed()).toHaveLength(1));
    fireEvent.click(await dialog.findByRole("button", { name: "上传所选" }));
    expect(uploadDocumentsMock.mock.calls[0][1]).toHaveLength(1);

    expect(await dialog.findByText("已上传")).toBeInTheDocument();
    expect(dialog.getByText("只支持 Markdown 和纯文本文件")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: /完\s*成/ }));
    // Closing reads the documents again, once; the files went up once.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 5000 });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(uploadDocumentsMock).toHaveBeenCalledTimes(1);
  });

  it("lets the owner type a document; others only read", async () => {
    setDocumentTypeMock.mockResolvedValue(undefined);
    const { view } = renderDocuments();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "「ward-prd.md」的文档类型" }));
    fireEvent.click(await screen.findByTitle("标准"));
    await waitFor(() => expect(setDocumentTypeMock).toHaveBeenCalledWith("p1", "d1", "standard"));
    view.unmount();

    renderDocuments(false);
    expect(screen.getByText("产品需求")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "上传文档" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

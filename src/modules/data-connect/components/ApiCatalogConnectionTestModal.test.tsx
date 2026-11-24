/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiCatalogConnectionTestModal } from "./ApiCatalogConnectionTestModal";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ApiCatalogConnectionTestModal", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }));
  });

  it.each(["footer", "close icon", "Escape"])(
    "keeps the %s close action active while a connection test is pending",
    (action) => {
      const onClose = vi.fn();
      const onRun = vi.fn();
      render(
        <ApiCatalogConnectionTestModal
          saved
          defaultScope="saved"
          canTestDraft
          canTestSaved
          loading
          result={null}
          revision={0}
          onRun={onRun}
          onClose={onClose}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /dataConnect\.apiCatalog\.startTest$/ }));
      expect(onRun).not.toHaveBeenCalled();
      if (action === "Escape")
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", keyCode: 27, which: 27 });
      else
        fireEvent.click(
          screen.getByRole("button", { name: action === "footer" ? "common.close" : "Close" }),
        );
      expect(onClose).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps unsaved configuration unavailable to a saved-Catalog-only caller", async () => {
    const onRun = vi.fn();
    render(
      <ApiCatalogConnectionTestModal
        saved
        defaultScope="saved"
        canTestDraft={false}
        canTestSaved
        loading={false}
        result={null}
        revision={0}
        onRun={onRun}
        onClose={vi.fn()}
      />,
    );
    const scope = screen.getByRole("combobox", { name: "dataConnect.apiCatalog.testScope" });
    fireEvent.mouseDown(scope);
    const draft = await screen.findByText("dataConnect.apiCatalog.draft");
    expect(draft.closest(".ant-select-item-option")).toHaveClass("ant-select-item-option-disabled");
    fireEvent.click(draft);
    fireEvent.keyDown(scope, { key: "Escape", keyCode: 27, which: 27 });
    fireEvent.click(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" }));
    expect(onRun).toHaveBeenCalledWith("saved");
  });

  it.each([true, false])("offers one connection test with login configured: %s", (hasLogin) => {
    const onRun = vi.fn();
    render(
      <ApiCatalogConnectionTestModal
        saved
        savedLogin={hasLogin}
        defaultScope="saved"
        canTestDraft
        canTestSaved
        loading={false}
        result={null}
        revision={0}
        onRun={onRun}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("combobox", { name: "dataConnect.apiCatalog.testTarget" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(
      screen.getByText(
        `dataConnect.apiCatalog.${hasLogin ? "loginTestHint" : "transportTestHint"}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("dataConnect.apiCatalog.resourceTestHint")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" }));
    expect(onRun).toHaveBeenCalledWith("saved");
  });

  it("updates the explanation for the selected configuration", async () => {
    const onRun = vi.fn();
    render(
      <ApiCatalogConnectionTestModal
        saved
        savedLogin
        draftLogin={false}
        defaultScope="saved"
        canTestDraft
        canTestSaved
        loading={false}
        result={null}
        revision={0}
        onRun={onRun}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("dataConnect.apiCatalog.loginTestHint")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataConnect.apiCatalog.testScope" }));
    fireEvent.click(await screen.findByText("dataConnect.apiCatalog.draft"));
    expect(screen.getByText("dataConnect.apiCatalog.transportTestHint")).toBeInTheDocument();
    expect(screen.queryByText("dataConnect.apiCatalog.loginTestHint")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" }));
    expect(onRun).toHaveBeenCalledWith("draft");
  });
});

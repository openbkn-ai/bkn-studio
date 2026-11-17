/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiCatalogConnectionTestModal } from "./ApiCatalogConnectionTestModal";

const listResourcesMock = vi.hoisted(() => vi.fn());
const getResourceMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/data-connect/services/api-catalog-test.service", () => {
  return {
    listApiCatalogTestResources: listResourcesMock,
    getApiCatalogTestResource: getResourceMock,
    canTestApiCatalogResource: (resource: { operations: string[] }) =>
      resource.operations.includes("query_data"),
  };
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ApiCatalogConnectionTestModal", () => {
  beforeEach(() => {
    listResourcesMock.mockReset();
    listResourcesMock.mockResolvedValue({ items: [], total: 0 });
    getResourceMock.mockReset();
    getResourceMock.mockResolvedValue(null);
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
    expect(onRun).toHaveBeenCalledWith("saved", "transport");
  });

  it("keeps unsupported login and Resource tests disabled without silently selecting them", async () => {
    const onRun = vi.fn();
    render(
      <ApiCatalogConnectionTestModal
        saved
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
    const target = screen.getByRole("combobox", { name: "dataConnect.apiCatalog.testTarget" });
    fireEvent.mouseDown(target);
    for (const name of [
      "dataConnect.apiCatalog.loginScope",
      "dataConnect.apiCatalog.resourceScope",
    ]) {
      const option = await screen.findByText(name);
      expect(option.closest(".ant-select-item-option")).toHaveClass(
        "ant-select-item-option-disabled",
      );
      fireEvent.click(option);
    }
    fireEvent.keyDown(target, { key: "Escape", keyCode: 27, which: 27 });
    fireEvent.click(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" }));
    expect(onRun).toHaveBeenCalledWith("saved", "transport");
  });

  it("offers explicit login only for a selected configuration with a login definition", async () => {
    const onRun = vi.fn();
    render(
      <ApiCatalogConnectionTestModal
        saved
        catalogId="catalog-1"
        catalogEnabled
        savedLogin
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
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "dataConnect.apiCatalog.testTarget" }),
    );
    fireEvent.click(await screen.findByText("dataConnect.apiCatalog.loginScope"));
    fireEvent.click(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" }));
    expect(onRun).toHaveBeenCalledWith("saved", "login");
  });

  it("loads permission-checked read candidates and submits paging only for the selected saved Resource", async () => {
    const resource = {
      id: "orders",
      name: "Orders",
      catalogId: "catalog-1",
      category: "api",
      effectType: "read",
      enabled: true,
      status: "active",
      operations: ["query_data"],
    };
    listResourcesMock.mockResolvedValue({
      items: [resource, { ...resource, id: "private", name: "Private", operations: [] }],
      total: 2,
    });
    getResourceMock.mockResolvedValue({
      ...resource,
      pagingRule: { mode: "offset", default_limit: 10, max_limit: 20 },
    });
    const onRun = vi.fn();
    render(
      <ApiCatalogConnectionTestModal
        saved
        catalogId="catalog-1"
        catalogEnabled
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
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "dataConnect.apiCatalog.testTarget" }),
    );
    fireEvent.click(await screen.findByText("dataConnect.apiCatalog.resourceScope"));
    await waitFor(() => expect(listResourcesMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataConnect.apiCatalog.resource" }));
    const privateOption = await screen.findByText(
      "Private — dataConnect.apiCatalog.resourceDenied",
    );
    expect(privateOption.closest(".ant-select-item-option")).toHaveClass(
      "ant-select-item-option-disabled",
    );
    fireEvent.click(await screen.findByText("Orders"));
    await screen.findByRole("checkbox", { name: "dataConnect.apiCatalog.paging" });
    fireEvent.click(screen.getByRole("checkbox", { name: "dataConnect.apiCatalog.paging" }));
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.offset"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.limit"), {
      target: { value: "21" },
    });
    expect(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("dataConnect.apiCatalog.limit"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" }));
    expect(onRun).toHaveBeenCalledWith("saved", "resource", {
      resourceId: "orders",
      paging: { offset: 0, limit: 2 },
    });
    expect(getResourceMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a candidate whose detail no longer grants query permission", async () => {
    const resource = {
      id: "orders",
      name: "Orders",
      catalogId: "catalog-1",
      category: "api",
      effectType: "read",
      enabled: true,
      status: "active",
      operations: ["query_data"],
    };
    listResourcesMock.mockResolvedValue({ items: [resource], total: 1 });
    getResourceMock.mockResolvedValue({ ...resource, operations: [] });
    const onRun = vi.fn();
    render(
      <ApiCatalogConnectionTestModal
        saved
        catalogId="catalog-1"
        catalogEnabled
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
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "dataConnect.apiCatalog.testTarget" }),
    );
    fireEvent.click(await screen.findByText("dataConnect.apiCatalog.resourceScope"));
    await waitFor(() => expect(listResourcesMock).toHaveBeenCalledTimes(1));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "dataConnect.apiCatalog.resource" }));
    fireEvent.click(await screen.findByText("Orders"));
    await screen.findByText("dataConnect.apiCatalog.resourceRequired");
    fireEvent.click(screen.getByRole("button", { name: "dataConnect.apiCatalog.startTest" }));
    expect(onRun).not.toHaveBeenCalled();
  });
});

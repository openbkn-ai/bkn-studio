/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@/app/locales/i18n";

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import type { Entitlement } from "@/framework/entitlement/types";
import { registerExtension, resetExtensionsForTesting } from "@/framework/extension/registry";
import { CatalogDetailTabs } from "@/modules/data-catalog/components/CatalogDetailTabs";
import type { CatalogRecord } from "@/shared/catalog/types";

afterEach(() => {
  resetExtensionsForTesting();
  vi.restoreAllMocks();
});

const catalog = { connectorType: "objectstorage", id: "catalog-1", name: "Files" } as CatalogRecord;

function entitlement(overrides: Partial<Entitlement>): Entitlement {
  return {
    capabilities: [],
    edition: "community",
    extensions: [],
    features: [],
    licensed: false,
    limits: {},
    state: "unlicensed",
    ...overrides,
  };
}

function renderDetail(snapshot: Entitlement | null, loading = false) {
  return render(
    <EntitlementContext.Provider value={{ loading, refresh: async () => {}, snapshot }}>
      <MemoryRouter>
        <CatalogDetailTabs catalog={catalog} resources={<p>resource list</p>} />
      </MemoryRouter>
    </EntitlementContext.Provider>,
  );
}

/** graph_explorer is a catalogued Professional capability, so it exercises the edition gate. */
function registerFilesTab(capability = "graph_explorer", render = () => <p>file list</p>) {
  registerExtension({
    capability,
    catalogDetailTabs: [
      {
        id: "files",
        labelKey: "dataCatalog.catalogDetail.resourcesTab",
        match: (record) => record.connectorType === "objectstorage",
        render,
      },
    ],
    id: "file-catalog",
  });
}

const professional = entitlement({
  capabilities: ["graph_explorer"],
  edition: "professional",
  extensions: ["graph_explorer"],
  licensed: true,
  state: "valid",
});

describe("CatalogDetailTabs", () => {
  it("renders only the resource list, without a tab bar, when no extension adds a tab", () => {
    const { container } = renderDetail(professional);

    expect(screen.getByText("resource list")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(container.innerHTML).toBe("<p>resource list</p>");
  });

  it("renders only the resource list when the tab does not match this catalog", () => {
    registerExtension({
      capability: "graph_explorer",
      catalogDetailTabs: [
        { id: "files", labelKey: "x", match: () => false, render: () => <p>file list</p> },
      ],
      id: "file-catalog",
    });
    renderDetail(professional);

    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("leaves the tab out when this image does not carry the capability", () => {
    registerFilesTab();
    renderDetail(entitlement({ edition: "professional", licensed: true, state: "valid" }));

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("resource list")).toBeInTheDocument();
  });

  it("shows the tab and mounts its content only when selected, once the licence covers it", () => {
    const renderFiles = vi.fn(() => <p>file list</p>);
    registerFilesTab("graph_explorer", renderFiles);
    renderDetail(professional);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(renderFiles).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("tab")[1]);

    expect(screen.getByText("file list")).toBeInTheDocument();
    expect(screen.queryByText("专业版")).toBeNull();
  });

  it("badges the tab and shows the upgrade card instead of content when the licence falls short", () => {
    const renderFiles = vi.fn(() => <p>file list</p>);
    registerFilesTab("graph_explorer", renderFiles);
    renderDetail(
      entitlement({ edition: "community", extensions: ["graph_explorer"], state: "valid" }),
    );

    expect(screen.getAllByRole("tab")[1]).toHaveTextContent("专业版");

    fireEvent.click(screen.getAllByRole("tab")[1]);

    expect(screen.getByRole("link", { name: "升级到专业版" })).toBeInTheDocument();
    expect(screen.queryByText("file list")).toBeNull();
    expect(renderFiles).not.toHaveBeenCalled();
  });

  it("does not offer an upgrade while the licence is unknown", () => {
    registerFilesTab();
    renderDetail(null);

    fireEvent.click(screen.getAllByRole("tab")[1]);

    expect(screen.queryByRole("link", { name: "升级到专业版" })).toBeNull();
    expect(screen.queryByText("file list")).toBeNull();
  });

  it("keeps the panel usable when a tab fails to render", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    registerFilesTab("graph_explorer", () => {
      throw new Error("render failed");
    });
    renderDetail(professional);

    fireEvent.click(screen.getAllByRole("tab")[1]);

    expect(screen.getByText("该页签加载失败，不影响其他页签。")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("tab")[0]);

    expect(screen.getByText("resource list")).toBeInTheDocument();
  });
});

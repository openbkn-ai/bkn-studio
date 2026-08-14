/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const loadAnalyzerCapabilitiesMock = vi.hoisted(() => vi.fn());
const loadEmbeddingModelOptionsMock = vi.hoisted(() => vi.fn());
const getCatalogResourceMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}));

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  listBuildTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: getCatalogResourceMock,
  updateCatalogResource: vi.fn(),
}));

vi.mock("@/modules/data-catalog/utils/analyzer-capabilities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/data-catalog/utils/analyzer-capabilities")>()),
  loadAnalyzerCapabilities: loadAnalyzerCapabilitiesMock,
}));

vi.mock("@/modules/data-catalog/utils/embedding-model-options", () => ({
  findUnregisteredEmbeddingModel: vi.fn().mockReturnValue(null),
  isRegisteredEmbeddingModel: vi.fn().mockReturnValue(true),
  loadEmbeddingModelOptions: loadEmbeddingModelOptionsMock,
  pickRegisteredEmbeddingModelId: vi.fn().mockReturnValue(undefined),
}));

import { IndexConfigFormPanel } from "./IndexConfigFormPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "title", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
  updatedAt: 0,
};

describe("IndexConfigFormPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogResourceMock.mockResolvedValue(resource);
    loadAnalyzerCapabilitiesMock.mockResolvedValue({ errorMessage: null, options: ["standard"], state: "ready" });
    loadEmbeddingModelOptionsMock.mockResolvedValue({
      errorMessage: null,
      options: [{ dimensions: 1024, id: "model-1", name: "Model 1" }],
      state: "ready",
    });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  it("preserves analyzer capabilities when the same resource is refreshed", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={resource} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(1));

    rerender(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={{ ...resource }} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("dataCatalog.build.analyzersLoading")).toBeNull();
  });

  it("explains the Chinese-search limitation when no Chinese analyzer is enabled", async () => {
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: null,
      options: ["standard", "english"],
      state: "ready",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={resource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.fulltextChineseAnalyzerUnavailableHint");
    expect(screen.queryByText("dataCatalog.build.fulltextChineseAnalyzerAvailableHint")).toBeNull();
  });

  it("keeps a vector-only resource saveable when analyzer capabilities are unavailable", async () => {
    const vectorResource: CatalogResource = {
      ...resource,
      schema: [{
        features: [{ config: { embedding_model: "model-1" }, featureType: "vector" }],
        name: "title",
        type: "string",
      }],
    };
    getCatalogResourceMock.mockResolvedValue(vectorResource);
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: "capabilities unavailable",
      options: [],
      state: "error",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={vectorResource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.analyzersLoadError");
    expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }).getAttribute("disabled"),
    ).toBeNull();
  });

  it("retries analyzer capability loading for full-text resources", async () => {
    const fulltextResource: CatalogResource = {
      ...resource,
      schema: [{
        features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
        name: "title",
        type: "string",
      }],
    };
    getCatalogResourceMock.mockResolvedValue(fulltextResource);
    loadAnalyzerCapabilitiesMock.mockResolvedValueOnce({
      errorMessage: "capabilities unavailable",
      options: [],
      state: "error",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={fulltextResource} />
      </MemoryRouter>,
    );

    const retryButton = await screen.findByRole("button", { name: "dataCatalog.build.retryLoadAnalyzers" });
    fireEvent.click(retryButton);
    await waitFor(() => expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.queryAllByText("dataCatalog.build.analyzersLoading")).toHaveLength(0);
      expect(screen.queryByRole("button", { name: "dataCatalog.build.retryLoadAnalyzers" })).toBeNull();
    });
  });
});

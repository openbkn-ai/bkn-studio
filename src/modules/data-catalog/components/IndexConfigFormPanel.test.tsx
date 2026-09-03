/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const loadAnalyzerCapabilitiesMock = vi.hoisted(() => vi.fn());
const loadEmbeddingModelOptionsMock = vi.hoisted(() => vi.fn());
const getCatalogResourceMock = vi.hoisted(() => vi.fn());
const listBuildTasksMock = vi.hoisted(() => vi.fn());
const updateCatalogResourceMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}));

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  listBuildTasks: listBuildTasksMock,
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: getCatalogResourceMock,
  updateCatalogResource: updateCatalogResourceMock,
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
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "title", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
  expectedUpdateTime: 0,
};

describe("IndexConfigFormPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogResourceMock.mockReset().mockResolvedValue(resource);
    listBuildTasksMock.mockReset().mockResolvedValue([]);
    updateCatalogResourceMock.mockReset();
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

  it("keeps vector and full-text metrics visible when build controls are hidden", () => {
    render(
      <MemoryRouter>
        <IndexConfigFormPanel
          active
          hideBuildControls
          resource={{
            ...resource,
            schema: [{
              features: [
                { config: { embedding_model: "model-1" }, featureType: "vector" },
                { config: { analyzer: "standard" }, featureType: "fulltext" },
              ],
              name: "title",
              type: "string",
            }],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("dataCatalog.build.embeddingFieldCount")).toBeTruthy();
    expect(screen.getByText("dataCatalog.build.fulltextFieldCount")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.build.configCanBuild")).toBeNull();
  });

  it("preserves freshly generated semantic metadata when saving index config", async () => {
    const configuredResource: CatalogResource = {
      ...resource,
      indexConfig: { incrementalFields: ["title"], primaryKeyFields: ["title"] },
      schema: [{
        features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
        name: "title",
        type: "string",
      }],
    };
    const semanticResource: CatalogResource = {
      ...configuredResource,
      description: "Monthly parking pass records",
      enabled: false,
      expectedUpdateTime: 200,
      name: "Monthly passes",
      schema: [{
        description: "Unique monthly pass identifier",
        displayName: "Pass ID",
        features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
        name: "title",
        type: "string",
      }],
    };
    getCatalogResourceMock.mockResolvedValue(semanticResource);
    updateCatalogResourceMock.mockResolvedValue(semanticResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={semanticResource} />
      </MemoryRouter>,
    );

    await screen.findByText("title");
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.build.saveIndexConfig" }));

    await waitFor(() => {
      expect(updateCatalogResourceMock).toHaveBeenCalledWith("resource-1", expect.objectContaining({
        description: semanticResource.description,
        enabled: false,
        expectedUpdateTime: semanticResource.expectedUpdateTime,
        name: semanticResource.name,
        schema: [expect.objectContaining({
          description: "Unique monthly pass identifier",
          displayName: "Pass ID",
          name: "title",
        })],
      }));
    });
  });

  it("explains the Chinese-search limitation when no Chinese analyzer is enabled", async () => {
    const fulltextResource: CatalogResource = {
      ...resource,
      schema: [{
        features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
        name: "title",
        type: "string",
      }],
    };
    getCatalogResourceMock.mockResolvedValue(fulltextResource);
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: null,
      options: ["standard", "english"],
      state: "ready",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={fulltextResource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.fulltextChineseAnalyzerUnavailableHint");
    expect(screen.queryByText("dataCatalog.build.fulltextChineseAnalyzerAvailableHint")).toBeNull();
  });

  it("recognizes other IK analyzers returned by the server", async () => {
    const fulltextResource: CatalogResource = {
      ...resource,
      schema: [{
        features: [{ config: { analyzer: "ik_smart" }, featureType: "fulltext" }],
        name: "title",
        type: "string",
      }],
    };
    getCatalogResourceMock.mockResolvedValue(fulltextResource);
    loadAnalyzerCapabilitiesMock.mockResolvedValue({
      errorMessage: null,
      options: ["standard", "ik_smart"],
      state: "ready",
    });

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={fulltextResource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.fulltextChineseAnalyzerAvailableHint");
    expect(screen.queryByText("dataCatalog.build.fulltextChineseAnalyzerUnavailableHint")).toBeNull();
  });

  it("does not show Chinese analyzer guidance for a resource without full-text fields", async () => {
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

    await waitFor(() => expect(screen.queryByText("dataCatalog.build.analyzersLoading")).toBeNull());
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
    await screen.findByText("dataCatalog.build.analyzers.english");
    expect(screen.queryByText("dataCatalog.build.fulltextChineseAnalyzerUnavailableHint")).toBeNull();
  });

  it("allows removing configured key fields that no longer exist in the schema", async () => {
    const staleKeyResource: CatalogResource = {
      ...resource,
      indexConfig: { incrementalFields: ["removed_order_no"], primaryKeyFields: ["removed_order_no"] },
    };
    getCatalogResourceMock.mockResolvedValue(staleKeyResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={staleKeyResource} />
      </MemoryRouter>,
    );

    const removeButton = await screen.findByRole("button", {
      name: "dataCatalog.build.removeInvalidKeyFields",
    });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "dataCatalog.build.removeInvalidKeyFields" }),
      ).toBeNull();
    });
  });

  it("does not mark a feature-only configuration as buildable", async () => {
    const featureOnlyResource: CatalogResource = {
      ...resource,
      schema: [{
        features: [{ config: { embedding_model: "model-1" }, featureType: "vector" }],
        name: "title",
        type: "string",
      }],
    };
    getCatalogResourceMock.mockResolvedValue(featureOnlyResource);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={featureOnlyResource} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("dataCatalog.build.configCannotBuild")).toBeTruthy();
  });

  it("keeps resource key fields when an active task has no configuration snapshot", async () => {
    const configuredResource: CatalogResource = {
      ...resource,
      indexConfig: { incrementalFields: ["title"], primaryKeyFields: ["title"] },
      schema: [{
        features: [{ config: { analyzer: "standard" }, featureType: "fulltext" }],
        name: "title",
        type: "string",
      }],
    };
    listBuildTasksMock.mockResolvedValue([{
      createTime: 1,
      embeddingFields: [],
      embeddingModel: "",
      error: null,
      finishTime: null,
      fulltextAnalyzer: "standard",
      fulltextFields: ["title"],
      id: "running-task",
      incrementalFields: [],
      lastProgressTime: null,
      mode: "batch",
      modelDimensions: 0,
      primaryKeyFields: [],
      resourceId: configuredResource.id,
      startTime: 1,
      status: "running",
      syncedCount: 0,
      totalCount: 1,
    } satisfies BuildTask]);

    render(
      <MemoryRouter>
        <IndexConfigFormPanel active resource={configuredResource} />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.build.activeTaskLocked");
    expect(screen.getByText("dataCatalog.build.configCanBuild")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.build.configCannotBuild")).toBeNull();
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

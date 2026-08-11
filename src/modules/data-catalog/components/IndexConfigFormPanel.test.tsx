/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const loadAnalyzerCapabilitiesMock = vi.hoisted(() => vi.fn());
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
  loadEmbeddingModelOptions: vi.fn().mockResolvedValue({ errorMessage: null, options: [], state: "empty" }),
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
    getCatalogResourceMock.mockResolvedValue(resource);
    loadAnalyzerCapabilitiesMock.mockResolvedValue({ errorMessage: null, options: ["standard"], state: "ready" });
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

  it("reloads analyzer capabilities when the same resource is refreshed", async () => {
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

    await waitFor(() => expect(loadAnalyzerCapabilitiesMock).toHaveBeenCalledTimes(2));
  });
});

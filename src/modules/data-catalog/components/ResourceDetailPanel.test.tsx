/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const getCatalogResourceMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: getCatalogResourceMock,
  updateCatalogResource: vi.fn(),
}));

import { ResourceDetailPanel } from "./ResourceDetailPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "id", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
  updatedAt: 0,
};

describe("ResourceDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("returns the resource fetched after returning to the detail tab to its parent", async () => {
    const latestResource = { ...resource, name: "Orders" };
    const onResourceRefreshed = vi.fn();
    getCatalogResourceMock.mockResolvedValue(latestResource);

    const { rerender } = render(
      <MemoryRouter>
        <ResourceDetailPanel active={false} catalog={null} onResourceRefreshed={onResourceRefreshed} resource={resource} />
      </MemoryRouter>,
    );

    await act(async () => {});

    rerender(
      <MemoryRouter>
        <ResourceDetailPanel active catalog={null} onResourceRefreshed={onResourceRefreshed} resource={resource} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(onResourceRefreshed).toHaveBeenCalledWith(latestResource));
    expect(getCatalogResourceMock).toHaveBeenCalledWith(resource.id);
  });
});

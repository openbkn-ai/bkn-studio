/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const getCatalogResourceMock = vi.hoisted(() => vi.fn());
const updateCatalogResourceMock = vi.hoisted(() => vi.fn());
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
  updateCatalogResource: updateCatalogResourceMock,
}));

import { ResourceDetailPanel } from "./ResourceDetailPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "id", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
  expectedUpdateTime: 0,
};

describe("ResourceDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCatalogResourceMock.mockResolvedValue(undefined);
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

  it("renders the refreshed resource supplied by the workspace without another request", async () => {
    const latestResource = { ...resource, name: "Orders" };

    const { rerender } = render(
      <MemoryRouter>
        <ResourceDetailPanel active={false} catalog={null} resource={resource} />
      </MemoryRouter>,
    );

    await act(async () => {});

    rerender(
      <MemoryRouter>
        <ResourceDetailPanel active catalog={null} resource={latestResource} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Orders")).toBeTruthy();
    expect(getCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("refreshes the resource version after an update conflict", async () => {
    const latestResource = {
      ...resource,
      description: "server description",
      expectedUpdateTime: 200,
    };
    const onResourceRefreshed = vi.fn();
    updateCatalogResourceMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
    getCatalogResourceMock.mockResolvedValue(latestResource);

    const { container } = render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          catalog={null}
          onResourceRefreshed={onResourceRefreshed}
          resource={{ ...resource, expectedUpdateTime: 100 }}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.resource.editFields" }));
    const descriptionInput = container.querySelector("textarea");
    if (!descriptionInput) {
      throw new Error("resource description input not found");
    }
    fireEvent.change(descriptionInput, {
      target: { value: "local description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(onResourceRefreshed).toHaveBeenCalledWith(latestResource);
    });
    expect(getCatalogResourceMock).toHaveBeenCalledWith(resource.id);
    expect(await screen.findByText("server description")).toBeTruthy();
  });
});

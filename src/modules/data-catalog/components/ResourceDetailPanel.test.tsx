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
  operations: ["modify", "query_data", "view_detail"],
  rowCount: 1,
  estimatedRowCount: 1,
  schemaName: "public",
  schema: [
    {
      name: "id",
      originalDescription: "Source order identifier",
      originalName: "source_order_id",
      originalType: "varchar(64)",
      type: "string",
    },
  ],
  sourceIdentifier: "orders",
  sourceMetadata: {
    foreignKeyCount: 1,
    indexCount: 2,
    objectType: "table",
    originalDescription: "Orders from the source database",
    originalName: "public.orders",
    primaryKeys: ["id"],
  },
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
        <ResourceDetailPanel active={false} canEdit={false} catalog={null} resource={resource} />
      </MemoryRouter>,
    );

    await act(async () => {});

    rerender(
      <MemoryRouter>
        <ResourceDetailPanel active canEdit={false} catalog={null} resource={latestResource} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Orders")).toBeTruthy();
    expect(getCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("does not place the tag space inside a paragraph", async () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, tags: ["index"] }}
        />
      </MemoryRouter>,
    );

    const tag = await screen.findByText("index");
    expect(tag.closest(".ant-space")?.parentElement?.tagName).not.toBe("P");
  });

  it("keeps zero row counts visible and exposes copy actions for identifiers", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, rowCount: null, estimatedRowCount: 0 }}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("dataCatalog.resource.estimatedRowCount")).toHaveLength(2);
    expect(screen.queryByText(resource.updateTime)).toBeNull();
    expect(screen.getAllByRole("button", { name: "dataCatalog.resource.copyValue" })).toHaveLength(
      3,
    );
  });

  it("shows an exact row count without the estimate prefix", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, rowCount: 42, estimatedRowCount: 41 }}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("42")).toHaveLength(2);
    expect(screen.queryByText("dataCatalog.resource.estimatedRowCount")).toBeNull();
  });

  it("shows the original source metadata for each field", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel active canEdit={false} catalog={null} resource={resource} />
      </MemoryRouter>,
    );

    expect(screen.getByText("source_order_id")).toBeTruthy();
    expect(screen.getByText("varchar(64)")).toBeTruthy();
    expect(screen.getByText("Source order identifier")).toBeTruthy();
  });

  it("shows the original source metadata for the resource", () => {
    const describedResource = { ...resource, description: "A long resource description" };
    render(
      <MemoryRouter>
        <ResourceDetailPanel active canEdit={false} catalog={null} resource={describedResource} />
      </MemoryRouter>,
    );

    expect(screen.getByTitle("A long resource description")).toBeTruthy();
    expect(screen.getByText("public.orders")).toBeTruthy();
    expect(screen.getByTitle("Orders from the source database")).toBeTruthy();
    expect(
      screen.getByText("dataCatalog.resource.schemaName").parentElement?.textContent,
    ).toContain("public");
    expect(
      screen.getByText("dataCatalog.resource.sourceIndexCount").parentElement?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("dataCatalog.resource.sourceForeignKeyCount").parentElement?.textContent,
    ).toContain("1");
  });

  it("does not show source metadata for a dataset", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, category: "dataset" }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("dataCatalog.resource.sourceMetadata")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.schemaName")).toBeNull();
  });

  it("keeps a resource read-only when its parent catalog cannot modify resources", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, operations: ["view_detail"] }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "dataCatalog.resource.editFields" })).toBeNull();
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
          canEdit
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

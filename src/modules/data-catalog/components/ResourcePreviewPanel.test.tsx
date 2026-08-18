/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const previewCatalogResourceMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  previewCatalogResource: previewCatalogResourceMock,
}));

import { ResourcePreviewPanel } from "./ResourcePreviewPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  category: "table",
  columnCount: 0,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 0,
  schema: [],
  sourceIdentifier: "public.orders",
  updateTime: "-",
  updatedAt: 0,
};

describe("ResourcePreviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not request preview data for a non-table resource with empty schema and no discover status", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{ ...resource, category: "dataset" }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.metadataUnavailable")).toBeTruthy();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("does not request preview data when the resource is missing but its previous schema remains", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          lastDiscoverStatus: "missing",
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.resourceMissing")).toBeTruthy();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("shows disabled lifecycle state before a simultaneous missing discovery result", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          lastDiscoverStatus: "missing",
          status: "disabled",
        }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.resourceDisabled")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.preview.resourceMissing")).toBeNull();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("does not request preview data for a stale resource with previous schema", () => {
    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          schema: [{ name: "id", type: "integer" }],
          status: "stale",
        }}
      />,
    );

    expect(screen.getByText("dataCatalog.preview.resourceStale")).toBeTruthy();
    expect(previewCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("still previews the last known schema after a later discovery failure", async () => {
    previewCatalogResourceMock.mockResolvedValue({ rows: [], total: 0 });

    render(
      <ResourcePreviewPanel
        active
        resource={{
          ...resource,
          columnCount: 1,
          lastDiscoverStatus: "error",
          schema: [{ name: "id", type: "integer" }],
        }}
      />,
    );

    await waitFor(() => {
      expect(previewCatalogResourceMock).toHaveBeenCalledWith("resource-1", {
        limit: 10,
        offset: 0,
      });
    });
  });
});

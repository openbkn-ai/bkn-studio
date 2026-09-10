/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogRecord } from "@/shared/catalog";

const countCatalogResourcesMock = vi.hoisted(() => vi.fn());
const listCatalogsMock = vi.hoisted(() => vi.fn());
const listConnectorTypesMock = vi.hoisted(() => vi.fn());
const subscribeMockDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/data-catalog/components/CatalogTreePanel", () => ({
  CatalogTreePanel: ({ onSelectCatalog }: { onSelectCatalog: (catalogId: string) => void }) => (
    <button onClick={() => onSelectCatalog("catalog-1")} type="button">select catalog</button>
  ),
}));
vi.mock("@/modules/data-catalog/components/ResourceFormDrawer", () => ({
  ResourceFormDrawer: () => null,
}));
vi.mock("@/modules/data-catalog/services/mock-db", () => ({
  subscribeMockDb: subscribeMockDbMock,
}));
vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  countCatalogResources: countCatalogResourcesMock,
  isCatalogDiscovering: () => false,
  listCatalogDiscovers: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/modules/data-connect/services/data-connect.service", () => ({
  listDataConnectConnectorTypes: listConnectorTypesMock,
}));
vi.mock("@/shared/catalog", () => ({
  catalogListAllQuery: () => ({ page: 1, pageSize: 100 }),
  getCatalog: vi.fn(),
  listCatalogs: listCatalogsMock,
}));

import { DataCatalogScene } from "./DataCatalogScene";

const catalog: CatalogRecord = {
  category: "table",
  connectorConfig: {},
  connectorType: "postgresql",
  createTime: null,
  creatorName: "-",
  description: "",
  enabled: true,
  expectedUpdateTime: 1,
  healthCheckResult: "",
  healthStatus: "unchecked",
  id: "catalog-1",
  internal: false,
  lastCheckTime: null,
  metadata: {},
  mode: "",
  name: "orders",
  operations: [],
  status: "enabled",
  tags: [],
  type: "physical",
  updateTime: null,
  updaterName: "-",
};

describe("DataCatalogScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countCatalogResourcesMock.mockResolvedValue(0);
    listCatalogsMock.mockResolvedValue({ items: [catalog], total: 1 });
    listConnectorTypesMock.mockResolvedValue([{ name: "PostgreSQL", type: "postgresql" }]);
    subscribeMockDbMock.mockImplementation(() => () => {});
  });

  it("does not reload catalogs when selecting a catalog after the first load", async () => {
    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "select catalog" }));
    await waitFor(() => expect(listConnectorTypesMock).toHaveBeenCalledTimes(1));
    expect(listCatalogsMock).toHaveBeenCalledTimes(1);
  });
});

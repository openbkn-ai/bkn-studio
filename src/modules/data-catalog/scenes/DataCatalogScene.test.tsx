/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogListQuery, CatalogRecord } from "@/shared/catalog";

const countCatalogResourcesMock = vi.hoisted(() => vi.fn());
const getCatalogMock = vi.hoisted(() => vi.fn());
const listCatalogsMock = vi.hoisted(() => vi.fn());
const listCatalogConnectorTypeStatsMock = vi.hoisted(() => vi.fn());
const subscribeMockDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/data-catalog/components/CatalogTreePanel", () => ({
  CatalogTreePanel: ({
    catalogs,
    keyword,
    onLoadCatalogsByConnectorType,
    onRefresh,
    onSearch,
    onSearchChange,
    onSelectCatalog,
  }: {
    catalogs: CatalogRecord[];
    keyword: string;
    onLoadCatalogsByConnectorType: (connectorType: string, offset?: number) => Promise<void>;
    onRefresh: () => Promise<void>;
    onSearch: (keyword?: string) => void;
    onSearchChange: (keyword: string) => void;
    onSelectCatalog: (catalogId: string) => void;
  }) => (
    <>
      <output data-testid="catalog-ids">{catalogs.map((item) => item.id).join(",")}</output>
      <output data-testid="catalog-keyword">{keyword}</output>
      <button onClick={() => onSelectCatalog("catalog-1")} type="button">select catalog</button>
      <button onClick={() => void onLoadCatalogsByConnectorType("postgresql")} type="button">load physical</button>
      <button onClick={() => void onRefresh()} type="button">refresh catalogs</button>
      <button onClick={() => onSearchChange("orders")} type="button">enter search keyword</button>
      <button onClick={() => onSearch()} type="button">search catalogs</button>
      <button onClick={() => onSearch("")} type="button">clear search catalogs</button>
    </>
  ),
}));
vi.mock("@/modules/data-catalog/components/ResourceFormDrawer", () => ({
  ResourceFormDrawer: () => null,
}));
vi.mock("@/modules/data-catalog/components/CatalogDetailPanel", () => ({
  default: ({ catalog }: { catalog: CatalogRecord }) => <output data-testid="selected-catalog-id">{catalog.id}</output>,
}));
vi.mock("@/modules/data-catalog/services/mock-db", () => ({
  subscribeMockDb: subscribeMockDbMock,
}));
vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  countCatalogResources: countCatalogResourcesMock,
  isCatalogDiscovering: () => false,
  listCatalogDiscovers: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/shared/catalog", () => ({
  catalogListAllQuery: () => ({ page: 1, pageSize: 100 }),
  getCatalog: getCatalogMock,
  listCatalogConnectorTypeStats: listCatalogConnectorTypeStatsMock,
  listCatalogs: listCatalogsMock,
}));

import { DataCatalogScene } from "./DataCatalogScene";

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

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
    getCatalogMock.mockResolvedValue(undefined);
    listCatalogsMock.mockResolvedValue({ items: [catalog], total: 1 });
    listCatalogConnectorTypeStatsMock.mockResolvedValue([{
      catalogType: "physical",
      connectorType: "postgresql",
      catalogCount: 1,
    }]);
    subscribeMockDbMock.mockImplementation(() => () => {});
  });

  it("does not reload catalogs when selecting a catalog after the first load", async () => {
    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledTimes(1));
    expect(listCatalogsMock).toHaveBeenCalledWith({
      keyword: "",
      page: 1,
      pageSize: 100,
      type: "logical",
    });
    fireEvent.click(screen.getByRole("button", { name: "select catalog" }));
    expect(listCatalogsMock).toHaveBeenCalledTimes(1);
  });

  it("shows the physical catalog selection state when no logical catalogs exist", async () => {
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });

    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("请从左侧物理数据源树中选择一个数据连接。")).toBeTruthy());
  });

  it("keeps loaded physical catalogs when refreshing logical catalogs", async () => {
    const logicalCatalog = { ...catalog, connectorType: "", id: "logical-1", type: "logical" as const };
    listCatalogsMock.mockImplementation((query: CatalogListQuery) => Promise.resolve(
      query.type === "physical"
        ? { items: [catalog], total: 1 }
        : { items: [logicalCatalog], total: 1 },
    ));

    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("catalog-ids").textContent).toBe("logical-1"));
    fireEvent.click(screen.getByRole("button", { name: "load physical" }));
    await waitFor(() => expect(screen.getByTestId("catalog-ids").textContent).toBe("logical-1,catalog-1"));

    fireEvent.click(screen.getByRole("button", { name: "refresh catalogs" }));

    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledTimes(3));
    expect(screen.getByTestId("catalog-ids").textContent).toBe("catalog-1,logical-1");
  });

  it("loads a selected physical catalog that is not in the initial page", async () => {
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });
    listCatalogConnectorTypeStatsMock.mockResolvedValue([{
      catalogCount: 1,
      catalogType: "physical",
      connectorType: "postgresql",
    }]);
    getCatalogMock.mockResolvedValue(catalog);

    render(
      <MemoryRouter initialEntries={["/data-catalog/catalog/catalog-1"]}>
        <DataCatalogScene selection={{ id: "catalog-1", type: "catalog" }} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getCatalogMock).toHaveBeenCalledWith("catalog-1"));
    await waitFor(() => expect(screen.getByTestId("selected-catalog-id").textContent).toBe("catalog-1"));

    listCatalogsMock.mockImplementation((query: CatalogListQuery) => Promise.resolve(
      query.type === "physical"
        ? { items: [catalog], total: 1 }
        : { items: [], total: 0 },
    ));

    fireEvent.click(screen.getByRole("button", { name: "load physical" }));

    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledWith({
      connectorType: "postgresql",
      keyword: "",
      page: 1,
      pageSize: 100,
      type: "physical",
    }));
    expect(screen.getByTestId("catalog-ids").textContent).toBe("catalog-1");
  });

  it("filters catalog statistics with the current search keyword", async () => {
    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listCatalogConnectorTypeStatsMock).toHaveBeenCalledWith(""));
    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));

    await waitFor(() => expect(listCatalogConnectorTypeStatsMock).toHaveBeenCalledWith("orders"));
    expect(listCatalogsMock).toHaveBeenCalledWith({
      keyword: "orders",
      page: 1,
      pageSize: 100,
      type: "logical",
    });
  });

  it("uses the value supplied by the search control when clearing a pending keyword", async () => {
    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "clear search catalogs" }));

    await waitFor(() => expect(listCatalogConnectorTypeStatsMock).toHaveBeenLastCalledWith(""));
    expect(listCatalogsMock).toHaveBeenLastCalledWith({
      keyword: "",
      page: 1,
      pageSize: 100,
      type: "logical",
    });
  });

  it("shows a search empty state instead of the create connection action when no catalogs match", async () => {
    listCatalogsMock.mockImplementation((query: CatalogListQuery) => Promise.resolve(
      query.keyword === "orders"
        ? { items: [], total: 0 }
        : { items: [catalog], total: 1 },
    ));
    listCatalogConnectorTypeStatsMock.mockImplementation((keyword) => Promise.resolve(
      keyword === "orders"
        ? []
        : [{ catalogCount: 1, catalogType: "physical", connectorType: "postgresql" }],
    ));

    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("catalog-keyword").textContent).toBe(""));
    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));

    await waitFor(() => expect(screen.getByText("没有匹配的目录")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "新建连接" })).toBeNull();
  });

  it("shows the physical catalog selection state when a search only matches physical catalogs", async () => {
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });
    listCatalogConnectorTypeStatsMock.mockImplementation((keyword) => Promise.resolve(
      keyword === "orders"
        ? [{ catalogCount: 1, catalogType: "physical", connectorType: "postgresql" }]
        : [],
    ));

    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));

    await waitFor(() => expect(screen.getByText("请从左侧物理数据源树中选择一个数据连接。")).toBeTruthy());
    expect(screen.queryByText("没有匹配的目录")).toBeNull();
  });

  it("does not restore a previously selected catalog after a new search", async () => {
    let resolveCatalog: (value: CatalogRecord) => void;
    getCatalogMock.mockReturnValue(new Promise<CatalogRecord>((resolve) => {
      resolveCatalog = resolve;
    }));
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });
    listCatalogConnectorTypeStatsMock.mockImplementation((keyword) => Promise.resolve(
      keyword === "orders" ? [] : [{ catalogCount: 1, catalogType: "physical", connectorType: "postgresql" }],
    ));

    render(
      <MemoryRouter initialEntries={["/data-catalog/catalog/catalog-1"]}>
        <DataCatalogScene selection={{ id: "catalog-1", type: "catalog" }} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getCatalogMock).toHaveBeenCalledWith("catalog-1"));
    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));
    await waitFor(() => expect(screen.getByTestId("catalog-ids").textContent).toBe(""));

    resolveCatalog!(catalog);

    await waitFor(() => expect(screen.getByTestId("catalog-ids").textContent).toBe(""));
  });

  it("ignores an earlier selected catalog error after a newer search succeeds", async () => {
    let rejectCatalog: (reason: Error) => void;
    const pendingCatalog = new Promise<CatalogRecord>((_, reject) => {
      rejectCatalog = reject;
    });
    getCatalogMock.mockImplementationOnce(() => pendingCatalog).mockResolvedValue(undefined);
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });
    listCatalogConnectorTypeStatsMock.mockImplementation((keyword) => Promise.resolve(
      keyword === "orders" ? [] : [{ catalogCount: 1, catalogType: "physical", connectorType: "postgresql" }],
    ));

    render(
      <MemoryRouter initialEntries={["/data-catalog/catalog/catalog-1"]}>
        <DataCatalogScene selection={{ id: "catalog-1", type: "catalog" }} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getCatalogMock).toHaveBeenCalledWith("catalog-1"));
    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));
    await waitFor(() => expect(screen.getByTestId("catalog-ids").textContent).toBe(""));

    rejectCatalog!(new Error("catalog unavailable"));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(screen.queryByText("catalog unavailable")).toBeNull();
  });

  it("ignores an earlier physical catalog page after searching", async () => {
    const logicalCatalog = { ...catalog, connectorType: "", id: "logical-1", type: "logical" as const };
    let resolvePhysicalCatalogs: (value: { items: CatalogRecord[]; total: number }) => void;
    const physicalCatalogs = new Promise<{ items: CatalogRecord[]; total: number }>((resolve) => {
      resolvePhysicalCatalogs = resolve;
    });
    listCatalogsMock.mockImplementation((query: CatalogListQuery) => {
      if (query.type === "physical") {
        return physicalCatalogs;
      }
      if (query.keyword === "orders") {
        return Promise.resolve({ items: [], total: 0 });
      }
      return Promise.resolve({ items: [logicalCatalog], total: 1 });
    });

    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("catalog-ids").textContent).toBe("logical-1"));
    fireEvent.click(screen.getByRole("button", { name: "load physical" }));
    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledWith({
      connectorType: "postgresql",
      keyword: "",
      page: 1,
      pageSize: 100,
      type: "physical",
    }));
    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));
    await waitFor(() => expect(screen.getByTestId("catalog-ids").textContent).toBe(""));

    resolvePhysicalCatalogs!({ items: [catalog], total: 1 });

    await waitFor(() => expect(screen.getByTestId("catalog-ids").textContent).toBe(""));
  });

  it("keeps the applied search keyword when a new search fails", async () => {
    listCatalogConnectorTypeStatsMock.mockImplementation((keyword) => (
      keyword === "orders"
        ? Promise.reject(new Error("statistics unavailable"))
        : Promise.resolve([{ catalogCount: 1, catalogType: "physical", connectorType: "postgresql" }])
    ));

    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("catalog-keyword").textContent).toBe(""));
    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));

    await waitFor(() => expect(screen.getByText("statistics unavailable")).toBeTruthy());
    expect(screen.getByTestId("catalog-keyword").textContent).toBe("");
  });

  it("keeps the current catalog route when a search fails", async () => {
    listCatalogConnectorTypeStatsMock.mockImplementation((keyword) => (
      keyword === "orders"
        ? Promise.reject(new Error("statistics unavailable"))
        : Promise.resolve([{ catalogCount: 1, catalogType: "physical", connectorType: "postgresql" }])
    ));

    render(
      <MemoryRouter initialEntries={["/data-catalog/catalog/catalog-1"]}>
        <CurrentPath />
        <DataCatalogScene selection={{ id: "catalog-1", type: "catalog" }} suppressAutoSelect />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));

    await waitFor(() => expect(screen.getByText("statistics unavailable")).toBeTruthy());
    expect(screen.getByTestId("current-path").textContent).toBe("/data-catalog/catalog/catalog-1");
  });

  it("clears a search error after a later successful search", async () => {
    listCatalogsMock.mockResolvedValue({ items: [], total: 0 });
    listCatalogConnectorTypeStatsMock.mockImplementation((keyword) => (
      keyword === "orders" && listCatalogConnectorTypeStatsMock.mock.calls.filter(([value]) => value === "orders").length === 1
        ? Promise.reject(new Error("statistics unavailable"))
        : Promise.resolve([])
    ));

    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));
    await waitFor(() => expect(screen.getByText("statistics unavailable")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));

    await waitFor(() => expect(screen.queryByText("statistics unavailable")).toBeNull());
    expect(screen.getByText("没有匹配的目录")).toBeTruthy();
  });

  it("ignores an initial load failure after a newer search succeeds", async () => {
    let rejectInitialCatalogs: (reason: Error) => void;
    const initialCatalogs = new Promise<{ items: CatalogRecord[]; total: number }>((_, reject) => {
      rejectInitialCatalogs = reject;
    });
    listCatalogsMock.mockImplementation((query: CatalogListQuery) => (
      query.keyword === "orders"
        ? Promise.resolve({ items: [], total: 0 })
        : initialCatalogs
    ));
    listCatalogConnectorTypeStatsMock.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/data-catalog"]}>
        <DataCatalogScene selection={null} suppressAutoSelect />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledWith({
      keyword: "",
      page: 1,
      pageSize: 100,
      type: "logical",
    }));
    fireEvent.click(screen.getByRole("button", { name: "enter search keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "search catalogs" }));
    await waitFor(() => expect(screen.getByText("没有匹配的目录")).toBeTruthy());

    rejectInitialCatalogs!(new Error("initial catalogs unavailable"));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(screen.queryByText("initial catalogs unavailable")).toBeNull();
    expect(screen.getByText("没有匹配的目录")).toBeTruthy();
  });
});

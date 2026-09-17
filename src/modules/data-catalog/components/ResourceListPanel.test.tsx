/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogRecord } from "@/shared/catalog";

const listCatalogResourcePageMock = vi.hoisted(() => vi.fn());
const currentPermissions = vi.hoisted(() => ({ value: [] as string[] }));
const drawerProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: currentPermissions.value } },
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  listCatalogResourcePage: listCatalogResourcePageMock,
}));

vi.mock("@/modules/system-admin/components/ObjectAuthorizeDrawer", () => ({
  ObjectAuthorizeDrawer: (props: Record<string, unknown>) => {
    drawerProps.value = props;
    return props.open ? <div data-testid="authorize-drawer" /> : null;
  },
}));

import { ResourceListPanel } from "./ResourceListPanel";

const catalog: CatalogRecord = {
  category: "database",
  connectorConfig: {},
  connectorType: "mysql",
  createTime: null,
  creatorName: "test",
  description: "",
  enabled: true,
  healthCheckResult: "",
  healthStatus: "healthy",
  id: "catalog-1",
  internal: false,
  lastCheckTime: null,
  metadata: {},
  mode: "",
  name: "nb_test_conn",
  operations: ["view_detail"],
  status: "enabled",
  tags: [],
  type: "physical",
  updateTime: null,
  expectedUpdateTime: 0,
  updaterName: "test",
};

function renderPanel(
  record: CatalogRecord,
  onOpenResource = vi.fn(),
  initialEntry = "/",
) {
  const view = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ResourceListPanel
        catalog={record}
        onCreateResource={vi.fn()}
        onOpenResource={onOpenResource}
      />
    </MemoryRouter>,
  );
  return { ...view, onOpenResource };
}

describe("ResourceListPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPermissions.value = [];
    drawerProps.value = null;
    listCatalogResourcePageMock.mockResolvedValue({ items: [], total: 0 });
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

  it("shows a manual refresh hint without a retry button when resources fail to load", async () => {
    listCatalogResourcePageMock.mockRejectedValue(new Error("resources unavailable"));
    renderPanel(catalog);

    expect(await screen.findByText("resources unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.retry" })).toBeNull();
    expect(screen.getByText("dataCatalog.loadErrorRefreshHint")).toBeInTheDocument();
  });

  it("filters resources by the selected schema", async () => {
    renderPanel(catalog, vi.fn(), "/data-catalog/catalog/catalog-1?schema=analytics");

    await waitFor(() => expect(listCatalogResourcePageMock).toHaveBeenCalledWith(expect.objectContaining({
      catalogId: "catalog-1",
      schema: "analytics",
    })));
  });

  // The bug: the button asked for admin-authz:grant, which no network_builder holds, so the person
  // who created the data connection could not share it — while bkn-safe was already accepting the
  // grant from them on /me/object-grants.
  it("offers the drawer to the catalog owner, who holds no admin point", async () => {
    renderPanel({ ...catalog, operations: ["view_detail", "authorize"] });
    await act(async () => {});

    fireEvent.click(screen.getByText("dataCatalog.catalog.authorize"));

    expect(screen.getByTestId("authorize-drawer")).toBeTruthy();
    expect(drawerProps.value?.objType).toBe("catalog");
    expect(drawerProps.value?.objId).toBe("catalog-1");
    // Tells the drawer to run in owner mode: /me endpoints, no `authorize` chip to pass on.
    expect(drawerProps.value?.objectAuthorized).toBe(true);
  });

  it("keeps the entry for an administrator without the object operation", async () => {
    currentPermissions.value = ["admin-authz:grant"];
    renderPanel(catalog);
    await act(async () => {});

    expect(screen.getByText("dataCatalog.catalog.authorize")).toBeTruthy();
    expect(drawerProps.value?.objectAuthorized).toBe(false);
  });

  it("hides the entry when the account holds neither", async () => {
    renderPanel(catalog);
    await act(async () => {});

    expect(screen.queryByText("dataCatalog.catalog.authorize")).toBeNull();
  });

  it("does not use a global resource_manage grant for another logical catalog", async () => {
    currentPermissions.value = ["catalog:resource_manage", "catalog:view_detail"];
    renderPanel({ ...catalog, connectorType: "", type: "logical" });
    await act(async () => {});

    expect(screen.queryByText("dataCatalog.resource.create")).toBeNull();
  });

  // Built-in catalogs stay read-only in Studio, owner row or not.
  it("hides the entry on an internal catalog", async () => {
    currentPermissions.value = ["admin-authz:grant"];
    renderPanel({ ...catalog, internal: true, operations: ["view_detail", "authorize"] });
    await act(async () => {});

    expect(screen.queryByText("dataCatalog.catalog.authorize")).toBeNull();
  });

  it("shows the independent resource enabled state in the list", async () => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [
        {
          catalogId: "catalog-1",
          category: "table",
          columnCount: 1,
          description: "",
          enabled: false,
          expectedUpdateTime: 0,
          id: "resource-1",
          localIndexStatus: "unavailable",
          name: "customers",
          operations: ["view_detail"],
          rowCount: 0,
          schema: [],
          sourceIdentifier: "db.customers",
          status: "stale",
          statusMessage: "source table no longer exists",
          tags: ["crm", "pii"],
          updateTime: "",
        },
      ],
      total: 1,
    });
    renderPanel(catalog);

    expect(await screen.findByText("common.disabled")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "dataCatalog.resource.tags" })).toBeTruthy();
    expect(screen.getByText("crm")).toBeTruthy();
    expect(screen.getByText("pii")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "dataCatalog.resource.resourceStatus" })).toBeTruthy();
    const resourceStatus = screen.getByText("dataCatalog.resourceStatuses.stale");
    expect(resourceStatus).toBeTruthy();
    fireEvent.mouseEnter(resourceStatus);
    expect(await screen.findByText("source table no longer exists")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "dataCatalog.resource.indexState" })).toBeTruthy();
    expect(screen.getByText("dataCatalog.resource.localIndexStatuses.unavailable")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.resource.fieldCount")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.rowCount")).toBeNull();
  });

  it("opens preview when list summaries omit schema and scale fields", async () => {
    const onOpenResource = vi.fn();
    listCatalogResourcePageMock.mockResolvedValue({
      items: [{
        catalogId: "catalog-1",
        category: "table",
        columnCount: null,
        description: "",
        expectedUpdateTime: 0,
        id: "resource-1",
        localIndexStatus: "unavailable",
        name: "customers",
        operations: ["query_data", "view_detail"],
        rowCount: null,
        schema: [],
        sourceIdentifier: "db.customers",
        updateTime: "",
      }],
      total: 1,
    });
    renderPanel(catalog, onOpenResource);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "dataCatalog.actions.preview" }));

    expect(onOpenResource).toHaveBeenCalledWith("resource-1", "preview");
  });

  it("keeps the data-index entry for datasets that support index configuration", async () => {
    const onOpenResource = vi.fn();
    listCatalogResourcePageMock.mockResolvedValue({
      items: [{
        catalogId: "catalog-1",
        category: "dataset",
        columnCount: 1,
        description: "",
        expectedUpdateTime: 0,
        id: "dataset-1",
        localIndexStatus: "unavailable",
        name: "orders_dataset",
        operations: ["view_detail"],
        rowCount: 0,
        schema: [{ name: "order_id", type: "integer" }],
        sourceIdentifier: "orders_dataset",
        updateTime: "",
      }],
      total: 1,
    });
    renderPanel(catalog, onOpenResource);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(await screen.findByRole("menuitem", {
      name: "dataCatalog.actions.dataIndex",
    }));

    expect(onOpenResource).toHaveBeenCalledWith("dataset-1", "index");
  });

  it.each([
    ["view-only", ["view_detail"]],
    ["resource manager", ["resource_manage", "view_detail"]],
    ["task manager", ["task_manage", "view_detail"]],
  ])("shows the data-index entry for a %s with resource view_detail", async (_, catalogOperations) => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [{
        catalogId: "catalog-1",
        category: "table",
        columnCount: 1,
        description: "",
        expectedUpdateTime: 0,
        id: "resource-1",
        localIndexStatus: "unavailable",
        name: "customers",
        operations: ["view_detail"],
        rowCount: 0,
        schema: [],
        sourceIdentifier: "db.customers",
        updateTime: "",
      }],
      total: 1,
    });
    renderPanel({ ...catalog, operations: catalogOperations });

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    expect(screen.getByRole("menuitem", { name: "dataCatalog.actions.dataIndex" })).toBeInTheDocument();
  });

  it.each([
    ["view-only", ["view_detail"], false],
    ["resource manager", ["resource_manage", "view_detail"], false],
    ["task manager", ["task_manage", "view_detail"], true],
  ])("shows semantic understanding only for a %s", async (_, catalogOperations, visible) => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [{
        catalogId: "catalog-1",
        category: "table",
        columnCount: 1,
        description: "",
        expectedUpdateTime: 0,
        id: "resource-1",
        localIndexStatus: "unavailable",
        name: "customers",
        operations: ["view_detail"],
        rowCount: 0,
        schema: [],
        sourceIdentifier: "db.customers",
        updateTime: "",
      }],
      total: 1,
    });
    renderPanel({ ...catalog, operations: catalogOperations });

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    const semanticUnderstanding = screen.queryByRole("menuitem", {
      name: "dataCatalog.resourceWorkspace.tabSemanticUnderstanding",
    });

    if (visible) {
      expect(semanticUnderstanding).toBeInTheDocument();
    } else {
      expect(semanticUnderstanding).toBeNull();
    }
  });

  it("keeps the data-index entry when the resource omits view_detail", async () => {
    const onOpenResource = vi.fn();
    listCatalogResourcePageMock.mockResolvedValue({
      items: [{
        catalogId: "catalog-1",
        category: "table",
        columnCount: 1,
        description: "",
        expectedUpdateTime: 0,
        id: "resource-1",
        localIndexStatus: "unavailable",
        name: "customers",
        operations: ["query_data"],
        rowCount: 0,
        schema: [],
        sourceIdentifier: "db.customers",
        updateTime: "",
      }],
      total: 1,
    });
    renderPanel({ ...catalog, operations: ["resource_manage", "task_manage", "view_detail"] }, onOpenResource);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "dataCatalog.actions.dataIndex" }));
    expect(onOpenResource).toHaveBeenCalledWith("resource-1", "index");
  });

  it("keeps index configuration reachable when the resource is disabled", async () => {
    const onOpenResource = vi.fn();
    listCatalogResourcePageMock.mockResolvedValue({
      items: [{
        catalogId: "catalog-1",
        category: "table",
        columnCount: 1,
        description: "",
        enabled: false,
        expectedUpdateTime: 0,
        id: "resource-1",
        localIndexStatus: "unavailable",
        name: "customers",
        operations: ["view_detail"],
        rowCount: 0,
        schema: [],
        sourceIdentifier: "db.customers",
        updateTime: "",
      }],
      total: 1,
    });
    renderPanel(catalog, onOpenResource);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    const indexItem = screen.getByRole("menuitem", { name: "dataCatalog.actions.dataIndex" });
    expect(indexItem).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(indexItem);
    expect(onOpenResource).toHaveBeenCalledWith("resource-1", "index");
  });

  it("hides resource preview when query_data is unavailable", async () => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [
        {
          catalogId: "catalog-1",
          category: "table",
          columnCount: 1,
          description: "",
          expectedUpdateTime: 0,
          id: "resource-1",
          localIndexStatus: "none",
          name: "customers",
          operations: ["modify", "view_detail"],
          rowCount: 0,
          schema: [],
          sourceIdentifier: "db.customers",
          updateTime: "",
        },
      ],
      total: 1,
    });
    renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    expect(screen.queryByRole("menuitem", {
      name: "dataCatalog.actions.preview",
    })).not.toBeInTheDocument();
  });

  it("disables resource preview with a reason when the resource is unavailable", async () => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [
        {
          catalogId: "catalog-1",
          category: "table",
          columnCount: 1,
          description: "",
          enabled: false,
          expectedUpdateTime: 0,
          id: "resource-1",
          localIndexStatus: "none",
          name: "customers",
          operations: ["query_data", "view_detail"],
          rowCount: 0,
          schema: [],
          sourceIdentifier: "db.customers",
          updateTime: "",
        },
      ],
      total: 1,
    });
    const { onOpenResource } = renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    const previewItem = await screen.findByRole("menuitem", {
      name: "dataCatalog.actions.preview",
    });

    expect(previewItem).toHaveAttribute("aria-disabled", "true");
    fireEvent.mouseEnter(screen.getByText("dataCatalog.actions.preview"));
    expect(await screen.findByText("dataCatalog.actions.previewDisabledHint")).toBeInTheDocument();
    fireEvent.click(previewItem);
    expect(onOpenResource).not.toHaveBeenCalledWith("resource-1", "preview");
  });

  it("disables resource preview with a reason when the catalog is disabled", async () => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [
        {
          catalogId: "catalog-1",
          category: "table",
          columnCount: 1,
          description: "",
          expectedUpdateTime: 0,
          id: "resource-1",
          localIndexStatus: "none",
          name: "customers",
          operations: ["query_data", "view_detail"],
          rowCount: 0,
          schema: [],
          sourceIdentifier: "db.customers",
          updateTime: "",
        },
      ],
      total: 1,
    });
    renderPanel({ ...catalog, enabled: false, status: "disabled" });

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    const previewItem = await screen.findByRole("menuitem", {
      name: "dataCatalog.actions.preview",
    });

    expect(previewItem).toHaveAttribute("aria-disabled", "true");
    fireEvent.mouseEnter(screen.getByText("dataCatalog.actions.preview"));
    expect(await screen.findByText("dataCatalog.gate.catalogDisabledShort")).toBeInTheDocument();
  });

  it("opens the shared authorization drawer for an individual data resource", async () => {
    currentPermissions.value = ["admin-authz:grant"];
    listCatalogResourcePageMock.mockResolvedValue({
      items: [
        {
          catalogId: "catalog-1",
          category: "table",
          columnCount: 1,
          description: "",
          expectedUpdateTime: 0,
          id: "resource-1",
          localIndexStatus: "unavailable",
          name: "customers",
          operations: ["view_detail"],
          rowCount: 0,
          schema: [],
          sourceIdentifier: "db.customers",
          updateTime: "",
        },
      ],
      total: 1,
    });
    renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(await screen.findByRole("menuitem", {
      name: /dataCatalog\.catalog\.authorize/,
    }));

    expect(screen.getByTestId("authorize-drawer")).toBeTruthy();
    expect(drawerProps.value?.objType).toBe("resource");
    expect(drawerProps.value?.objId).toBe("resource-1");
    expect(drawerProps.value?.objName).toBe("customers");
  });
});

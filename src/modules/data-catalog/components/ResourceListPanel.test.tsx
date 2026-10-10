/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogRecord } from "@/shared/catalog";

const listCatalogResourcePageMock = vi.hoisted(() => vi.fn());
const deleteCatalogResourceMock = vi.hoisted(() => vi.fn());
const getCatalogResourceMock = vi.hoisted(() => vi.fn());
type DeleteConfirmation = {
  content: ReactNode;
  okButtonProps: { danger: boolean };
  onOk: () => Promise<void>;
};
const confirmMock = vi.hoisted(() => vi.fn<(options: DeleteConfirmation) => void>());
const messageErrorMock = vi.hoisted(() => vi.fn());
const currentPermissions = vi.hoisted(() => ({ value: [] as string[] }));
const drawerProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
const editionMock = vi.hoisted(() => ({ value: "professional" }));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlement: () => ({
    edition: editionMock.value,
    licensed: editionMock.value !== "community",
    capabilities: [],
    extensions: ["enterprise"],
    limits: {},
    state: "valid",
  }),
  useEntitlementContext: () => ({
    snapshot: {
      edition: editionMock.value,
      licensed: editionMock.value !== "community",
      capabilities: [],
      extensions: ["enterprise"],
      limits: {},
      state: "valid",
    },
  }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: messageErrorMock, success: vi.fn() },
    modal: { confirm: confirmMock },
    runtimeConfig: { currentUser: { permissions: currentPermissions.value } },
  }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  listCatalogResourcePage: listCatalogResourcePageMock,
  deleteCatalogResource: deleteCatalogResourceMock,
  getCatalogResource: getCatalogResourceMock,
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
  builtin: false,
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
  onResourceDeleted = vi.fn(),
) {
  const view = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ResourceListPanel
        catalog={record}
        onCreateResource={vi.fn()}
        onOpenResource={onOpenResource}
        onResourceDeleted={onResourceDeleted}
      />
    </MemoryRouter>,
  );
  return { ...view, onOpenResource, onResourceDeleted };
}

function missingResource(overrides: Record<string, unknown> = {}) {
  return {
    catalogId: "catalog-1",
    category: "table",
    id: "resource-1",
    name: "archived_orders",
    schemaName: "crm",
    sourceIdentifier: "crm.archived_orders",
    status: "stale",
    lastDiscoverStatus: "missing",
    operations: ["view_detail", "delete"],
    schema: [],
    ...overrides,
  };
}

function deleteConfirmation() {
  const options = confirmMock.mock.lastCall?.[0];
  if (!options) {
    throw new Error("Expected a delete confirmation");
  }
  return options;
}

describe("ResourceListPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editionMock.value = "professional";
    currentPermissions.value = [];
    drawerProps.value = null;
    listCatalogResourcePageMock.mockResolvedValue({ items: [], total: 0 });
    deleteCatalogResourceMock.mockResolvedValue(undefined);
    getCatalogResourceMock.mockResolvedValue(missingResource());
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

  it.each([
    ["stale and missing with permission", {}, true],
    ["active table", { status: "active" }, false],
    ["source present", { lastDiscoverStatus: "unchanged" }, false],
    [
      "active dataset",
      { category: "dataset", status: "active", lastDiscoverStatus: undefined },
      true,
    ],
    [
      "active view",
      { category: "logical_view", status: "active", lastDiscoverStatus: undefined },
      true,
    ],
    ["without delete permission", { operations: ["view_detail"] }, false],
    [
      "dataset without delete permission",
      { category: "dataset", operations: ["view_detail"] },
      false,
    ],
  ])("shows delete for %s", async (_, overrides, visible) => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [missingResource(overrides)],
      total: 1,
    });
    renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    expect(screen.queryByRole("menuitem", { name: "common.delete" }) !== null).toBe(visible);
  });

  it.each(["dataset", "logical_view"])("deletes an active %s with permission", async (category) => {
    const resource = missingResource({ category, status: "active", lastDiscoverStatus: undefined });
    listCatalogResourcePageMock.mockResolvedValue({ items: [resource], total: 1 });
    getCatalogResourceMock.mockResolvedValue(resource);
    renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "common.delete" }));
    const modalContent = render(deleteConfirmation().content);
    expect(
      modalContent.getByText(
        "dataCatalog.resource.resourceStatus: dataCatalog.resourceStatuses.active",
      ),
    ).toBeInTheDocument();
    expect(modalContent.container).not.toHaveTextContent("dataCatalog.resource.discoverStatus");
    modalContent.unmount();

    await act(async () => {
      await deleteConfirmation().onOk();
    });
    expect(deleteCatalogResourceMock).toHaveBeenCalledWith("resource-1", {
      onlyIfStale: false,
      skipErrorToast: true,
    });
  });

  it("rejects an active view when its delete permission disappears", async () => {
    const resource = missingResource({ category: "logical_view", status: "active" });
    listCatalogResourcePageMock.mockResolvedValue({ items: [resource], total: 1 });
    getCatalogResourceMock.mockResolvedValue({ ...resource, operations: ["view_detail"] });
    renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "common.delete" }));
    await expect(deleteConfirmation().onOk()).rejects.toThrow(
      "dataCatalog.resource.deleteStateChanged",
    );
    expect(deleteCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("confirms the impact and refreshes counts after deleting", async () => {
    listCatalogResourcePageMock
      .mockResolvedValueOnce({ items: [missingResource()], total: 1 })
      .mockResolvedValue({ items: [], total: 0 });
    const { onResourceDeleted } = renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "common.delete" }));

    expect(deleteCatalogResourceMock).not.toHaveBeenCalled();
    const options = deleteConfirmation();
    expect(options.okButtonProps).toEqual({ danger: true });
    const modalContent = render(options.content);
    expect(
      modalContent.getByText("dataCatalog.resource.name: archived_orders"),
    ).toBeInTheDocument();
    expect(modalContent.getByText("dataCatalog.resource.schemaName: crm")).toBeInTheDocument();
    expect(
      modalContent.getByText("dataCatalog.resource.catalog: nb_test_conn"),
    ).toBeInTheDocument();
    expect(
      modalContent.getByText("dataCatalog.resource.deleteUnknownReferences"),
    ).toBeInTheDocument();
    modalContent.unmount();

    await act(async () => {
      await options.onOk();
    });
    expect(deleteCatalogResourceMock).toHaveBeenCalledWith("resource-1", {
      onlyIfStale: true,
      skipErrorToast: true,
    });
    expect(getCatalogResourceMock).toHaveBeenCalledWith("resource-1");
    expect(onResourceDeleted).toHaveBeenCalledOnce();
    await waitFor(() => expect(listCatalogResourcePageMock).toHaveBeenCalledTimes(2));
  });

  it("retains the resource and shows the error when deletion fails", async () => {
    listCatalogResourcePageMock.mockResolvedValue({ items: [missingResource()], total: 1 });
    deleteCatalogResourceMock.mockRejectedValue(new Error("build task is running"));
    const { onResourceDeleted } = renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "common.delete" }));
    await expect(deleteConfirmation().onOk()).rejects.toThrow("build task is running");

    expect(messageErrorMock).toHaveBeenCalledWith("build task is running");
    expect(onResourceDeleted).not.toHaveBeenCalled();
    expect(screen.getByText("archived_orders")).toBeInTheDocument();
  });

  it("rejects deletion if the resource recovered before confirmation", async () => {
    listCatalogResourcePageMock.mockResolvedValue({ items: [missingResource()], total: 1 });
    getCatalogResourceMock.mockResolvedValue(missingResource({ status: "active" }));
    renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "common.delete" }));
    await expect(deleteConfirmation().onOk()).rejects.toThrow(
      "dataCatalog.resource.deleteStateChanged",
    );

    expect(deleteCatalogResourceMock).not.toHaveBeenCalled();
    expect(messageErrorMock).toHaveBeenCalledWith("dataCatalog.resource.deleteStateChanged");
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

    await waitFor(() =>
      expect(listCatalogResourcePageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          catalogId: "catalog-1",
          schema: "analytics",
        }),
      ),
    );
  });

  it("offers Index as a resource category filter", async () => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [
        {
          catalogId: "catalog-1",
          category: "index",
          id: "index-1",
          name: "orders_index",
          sourceIdentifier: "orders_index",
          operations: ["view_detail"],
          schema: [],
        },
      ],
      total: 1,
    });
    renderPanel(catalog);
    fireEvent.click(
      (await screen.findByText("dataCatalog.resource.moreFilters")).closest("button")!,
    );
    fireEvent.mouseDown(screen.getAllByText("common.all")[0]);
    fireEvent.click(screen.getAllByText("dataCatalog.categories.index").at(-1)!);

    await waitFor(() =>
      expect(listCatalogResourcePageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "index" }),
      ),
    );
  });

  it("sorts resource names ascending by default and supports descending order", async () => {
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

    await waitFor(() =>
      expect(listCatalogResourcePageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ direction: "asc", sort: "name" }),
      ),
    );

    fireEvent.click(screen.getByRole("columnheader", { name: "dataCatalog.resource.name" }));

    await waitFor(() =>
      expect(listCatalogResourcePageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ direction: "desc", sort: "name" }),
      ),
    );
  });

  it("does not render a resize handle for the resource-name column", async () => {
    renderPanel(catalog);

    await waitFor(() =>
      expect(listCatalogResourcePageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ direction: "asc", sort: "name" }),
      ),
    );
    expect(screen.queryByRole("separator")).toBeNull();
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
    expect(screen.queryByText("dataCatalog.viewEditor.create")).toBeNull();
  });

  it("offers View creation on a manageable physical Catalog, next to authorization", async () => {
    renderPanel({ ...catalog, operations: ["resource_manage", "authorize"] });
    await act(async () => {});

    const authorization = screen.getByText("dataCatalog.catalog.authorize");
    const create = screen.getByText("dataCatalog.viewEditor.create");
    expect(
      authorization.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides View creation without a professional license", async () => {
    editionMock.value = "community";
    renderPanel({ ...catalog, operations: ["resource_manage"] });
    await act(async () => {});
    expect(screen.queryByText("dataCatalog.viewEditor.create")).toBeNull();
  });

  it("does not offer View creation on built-in or disabled Catalogs", async () => {
    const first = renderPanel({ ...catalog, builtin: true, operations: ["resource_manage"] });
    await act(async () => {});
    expect(screen.queryByText("dataCatalog.viewEditor.create")).toBeNull();
    first.unmount();

    renderPanel({ ...catalog, enabled: false, operations: ["resource_manage"] });
    await act(async () => {});
    expect(screen.queryByText("dataCatalog.viewEditor.create")).toBeNull();
  });

  // Built-in catalogs stay read-only in Studio, owner row or not.
  it("hides the entry on an internal catalog", async () => {
    currentPermissions.value = ["admin-authz:grant"];
    renderPanel({ ...catalog, builtin: true, operations: ["view_detail", "authorize"] });
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
    expect(
      screen.getByRole("columnheader", { name: "dataCatalog.resource.resourceStatus" }),
    ).toBeTruthy();
    const resourceStatus = screen.getByText("dataCatalog.resourceStatuses.stale");
    expect(resourceStatus).toBeTruthy();
    fireEvent.mouseEnter(resourceStatus);
    expect(await screen.findByText("source table no longer exists")).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "dataCatalog.resource.indexState" }),
    ).toBeTruthy();
    expect(screen.getByText("dataCatalog.resource.localIndexStatuses.unavailable")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.resource.fieldCount")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.rowCount")).toBeNull();
  });

  it("omits Dataset discovery and source status even when legacy values exist", async () => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [missingResource({ category: "dataset", statusMessage: "legacy source error" })],
      total: 1,
    });
    renderPanel(catalog);
    const row = (await screen.findByText("archived_orders")).closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    const headers = screen.getAllByRole("columnheader");
    for (const label of ["resourceStatus", "discoverStatus"]) {
      const index = headers.findIndex((header) =>
        header.textContent?.includes(`dataCatalog.resource.${label}`),
      );
      expect(index).toBeGreaterThanOrEqual(0);
      expect(cells[index]).toHaveTextContent("—");
    }
    expect(within(row).queryByText("dataCatalog.resourceStatuses.stale")).toBeNull();
    expect(within(row).queryByText("dataCatalog.discoverStatuses.missing")).toBeNull();
    expect(screen.queryByText("legacy source error")).toBeNull();
  });

  it("shows the source identifier below the resource name", async () => {
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
          name: "客户订单",
          operations: ["view_detail"],
          rowCount: 0,
          schema: [],
          sourceIdentifier: "crm_core.orders",
          updateTime: "",
        },
      ],
      total: 1,
    });
    renderPanel(catalog);

    expect(await screen.findByText("客户订单")).toBeTruthy();
    expect(screen.getByText("crm_core.orders")).toBeTruthy();
  });

  it("opens preview when list summaries omit schema and scale fields", async () => {
    const onOpenResource = vi.fn();
    listCatalogResourcePageMock.mockResolvedValue({
      items: [
        {
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
        },
      ],
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
      items: [
        {
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
        },
      ],
      total: 1,
    });
    renderPanel(catalog, onOpenResource);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "dataCatalog.actions.dataIndex",
      }),
    );

    expect(onOpenResource).toHaveBeenCalledWith("dataset-1", "index");
  });

  it("does not offer the data-index entry for a view", async () => {
    listCatalogResourcePageMock.mockResolvedValue({
      items: [
        {
          catalogId: "catalog-1",
          category: "logical_view",
          columnCount: 1,
          description: "",
          expectedUpdateTime: 0,
          id: "view-1",
          localIndexStatus: "unavailable",
          name: "orders_view",
          operations: ["view_detail", "query_data"],
          rowCount: 0,
          schema: [],
          sourceIdentifier: "view-1",
          updateTime: "",
        },
      ],
      total: 1,
    });
    renderPanel(catalog);

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    expect(screen.queryByRole("menuitem", { name: "dataCatalog.actions.dataIndex" })).toBeNull();
  });

  it.each([
    ["view-only", ["view_detail"]],
    ["resource manager", ["resource_manage", "view_detail"]],
    ["task manager", ["task_manage", "view_detail"]],
  ])(
    "shows the data-index entry for a %s with resource view_detail",
    async (_, catalogOperations) => {
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
      renderPanel({ ...catalog, operations: catalogOperations });

      fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
      expect(
        screen.getByRole("menuitem", { name: "dataCatalog.actions.dataIndex" }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    ["view-only", ["view_detail"], false],
    ["resource manager", ["resource_manage", "view_detail"], false],
    ["task manager", ["task_manage", "view_detail"], true],
  ])("shows semantic understanding only for a %s", async (_, catalogOperations, visible) => {
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
          operations: ["query_data"],
          rowCount: 0,
          schema: [],
          sourceIdentifier: "db.customers",
          updateTime: "",
        },
      ],
      total: 1,
    });
    renderPanel(
      { ...catalog, operations: ["resource_manage", "task_manage", "view_detail"] },
      onOpenResource,
    );

    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "dataCatalog.actions.dataIndex" }));
    expect(onOpenResource).toHaveBeenCalledWith("resource-1", "index");
  });

  it("keeps index configuration reachable when the resource is disabled", async () => {
    const onOpenResource = vi.fn();
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
          updateTime: "",
        },
      ],
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
    expect(
      screen.queryByRole("menuitem", {
        name: "dataCatalog.actions.preview",
      }),
    ).not.toBeInTheDocument();
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
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: /dataCatalog\.catalog\.authorize/,
      }),
    );

    expect(screen.getByTestId("authorize-drawer")).toBeTruthy();
    expect(drawerProps.value?.objType).toBe("resource");
    expect(drawerProps.value?.objId).toBe("resource-1");
    expect(drawerProps.value?.objName).toBe("customers");
  });
});

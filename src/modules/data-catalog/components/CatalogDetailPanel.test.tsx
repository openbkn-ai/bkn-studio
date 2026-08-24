/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
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

import { CatalogDetailPanel } from "./CatalogDetailPanel";

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

function renderPanel(record: CatalogRecord) {
  return render(
    <MemoryRouter>
      <CatalogDetailPanel
        catalog={record}
        onCreateResource={vi.fn()}
        onOpenResource={vi.fn()}
        tasks={[]}
      />
    </MemoryRouter>,
  );
}

describe("CatalogDetailPanel authorize entry", () => {
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

  // Built-in catalogs stay read-only in Studio, owner row or not.
  it("hides the entry on an internal catalog", async () => {
    currentPermissions.value = ["admin-authz:grant"];
    renderPanel({ ...catalog, internal: true, operations: ["view_detail", "authorize"] });
    await act(async () => {});

    expect(screen.queryByText("dataCatalog.catalog.authorize")).toBeNull();
  });
});

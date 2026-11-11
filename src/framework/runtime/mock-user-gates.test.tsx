/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/AppProviders";
import i18n from "@/app/locales/i18n";
import { DEFAULT_APP_ENTRY_PATH } from "@/app/router/app-paths";
import {
  consoleNavigation,
  filterNavByCapability,
  filterNavByPermission,
} from "@/app/shell/console-navigation";
import { CapabilityGate } from "@/framework/entitlement/CapabilityGate";
import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { fetchEntitlement } from "@/framework/entitlement/entitlement.service";
import { RequireCapability } from "@/framework/entitlement/RequireCapability";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { RequirePermission } from "@/framework/permission/RequirePermission";
import { createRuntimeConfig } from "@/framework/runtime/config";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import { ExecutionUnitCardMenu } from "@/modules/execution-factory/components/execution-unit/ExecutionUnitCardMenu";
import { executionFactoryRoutes } from "@/modules/execution-factory/routes";

vi.mock("@/modules/execution-factory/pages/CatalogListPage", () => ({
  CatalogListPage: () => <p>market catalog page</p>,
}));

// The entitlement service evaluates mock mode once, when the module loads.
vi.hoisted(() => vi.stubEnv("VITE_USE_MOCK", "true"));

describe("mock edition and user gate matrix", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it.each(
    ["community", "professional", "enterprise", "industry"].flatMap((edition) =>
      ["admin", "viewer"].map((role) => ({ edition, role })),
    ),
  )(
    "$edition / $role respects menus, direct routes and write buttons",
    async ({ edition, role }) => {
      vi.stubEnv("VITE_MOCK_EDITION", edition);
      vi.stubEnv("VITE_MOCK_USER", role);
      const config = createRuntimeConfig();
      const snapshot = await fetchEntitlement();
      const { permissions, isSuperAdmin } = config.currentUser;
      const navigation = filterNavByPermission(consoleNavigation, permissions, isSuperAdmin);
      expect(navigation.some((item) => item.key === "system-management")).toBe(role === "admin");

      const metricEntry = {
        key: "metrics",
        labelKey: "metrics",
        path: "/metrics",
        capability: "object_metrics",
        permission: "knowledge-network:metric:view",
      };
      const entries = filterNavByCapability(
        filterNavByPermission([metricEntry], permissions),
        snapshot,
      );
      expect(entries.length).toBe(edition === "community" ? 0 : 1);

      const readPage = vi.fn(() => <p>metric detail</p>);
      const writePage = vi.fn(() => <p>metric editor</p>);
      const ReadPage = readPage;
      const WritePage = writePage;
      render(
        <AppProviders runtimeConfig={config} updateLocale={vi.fn()}>
          <AntdProviders runtimeConfig={config}>
            <EntitlementContext.Provider
              value={{ loading: false, refresh: async () => {}, snapshot }}
            >
              <CapabilityGate capability="object_metrics">
                <PermissionGate permissions="knowledge-network:metric:create">
                  <button>Create metric</button>
                </PermissionGate>
              </CapabilityGate>
              <MemoryRouter initialEntries={["/metrics"]}>
                <Routes>
                  <Route
                    path="/metrics"
                    element={
                      <RequireCapability capability="object_metrics">
                        <RequirePermission permissions="knowledge-network:metric:view">
                          <ReadPage />
                        </RequirePermission>
                      </RequireCapability>
                    }
                  />
                </Routes>
              </MemoryRouter>
              <MemoryRouter initialEntries={["/metrics/create"]}>
                <Routes>
                  <Route
                    path="/metrics/create"
                    element={
                      <RequireCapability capability="object_metrics">
                        <RequirePermission permissions="knowledge-network:metric:create">
                          <WritePage />
                        </RequirePermission>
                      </RequireCapability>
                    }
                  />
                  <Route path={DEFAULT_APP_ENTRY_PATH} element={<p>home</p>} />
                </Routes>
              </MemoryRouter>
            </EntitlementContext.Provider>
          </AntdProviders>
        </AppProviders>,
      );
      const canRead = edition !== "community";
      const canWrite = canRead && role === "admin";
      expect(screen.queryByText("metric detail") !== null).toBe(canRead);
      expect(readPage.mock.calls.length > 0).toBe(canRead);
      expect(screen.queryByText("metric editor") !== null).toBe(canWrite);
      expect(writePage.mock.calls.length > 0).toBe(canWrite);
      expect(screen.queryByRole("button", { name: "Create metric" }) !== null).toBe(canWrite);
    },
  );

  it("keeps the existing professional upgrade entry and enterprise availability", async () => {
    const entry = {
      key: "object-authz",
      labelKey: "object-authz",
      capability: "perm_object_level",
    };
    vi.stubEnv("VITE_MOCK_EDITION", "professional");
    expect(filterNavByCapability([entry], await fetchEntitlement())[0].locked).toBe(true);
    vi.stubEnv("VITE_MOCK_EDITION", "enterprise");
    expect(filterNavByCapability([entry], await fetchEntitlement())[0].locked).not.toBe(true);
  });

  it.each(["admin", "viewer"])(
    "%s can browse the market, while installation and sync remain administrator-only",
    async (role) => {
      vi.stubEnv("VITE_MOCK_USER", role);
      const config = createRuntimeConfig();
      const { permissions, isSuperAdmin } = config.currentUser;
      const navigation = filterNavByPermission(consoleNavigation, permissions, isSuperAdmin);
      const market = navigation
        .find((item) => item.key === "execution-factory")
        ?.children?.find((item) => item.key === "all-execution-units");
      expect(market?.path).toBe("/execution-factory/catalog");

      const route = executionFactoryRoutes.find(
        (item) => item.path === "execution-factory/catalog",
      );
      if (!route) throw new Error("The market route must be registered");
      const onAction = vi.fn();
      render(
        <AppProviders runtimeConfig={config} updateLocale={vi.fn()}>
          <AntdProviders runtimeConfig={config}>
            <MemoryRouter initialEntries={["/execution-factory/catalog"]}>
              <Routes>
                <Route path={route.path} element={route.element} />
                <Route path={DEFAULT_APP_ENTRY_PATH} element={<p>home</p>} />
              </Routes>
              <ExecutionUnitCardMenu
                activeTab="toolbox"
                item={{ id: "market-toolbox", name: "Market toolbox", installedInDomain: false }}
                marketMode
                onAction={onAction}
              />
              <ExecutionUnitCardMenu
                activeTab="toolbox"
                item={{
                  id: "installed-toolbox",
                  name: "Installed toolbox",
                  installedInDomain: true,
                }}
                marketMode
                onAction={onAction}
              />
            </MemoryRouter>
          </AntdProviders>
        </AppProviders>,
      );
      expect(await screen.findByText("market catalog page")).toBeTruthy();
      const install = screen.queryByRole("button", {
        name: (name) => name.includes(i18n.t("executionFactory.marketIntroduce")),
      });
      const sync = screen.queryByRole("button", {
        name: (name) => name.includes(i18n.t("executionFactory.marketSync")),
      });
      if (role === "viewer") {
        expect(install).toBeNull();
        expect(sync).toBeNull();
        expect(onAction).not.toHaveBeenCalled();
      } else {
        if (!install || !sync)
          throw new Error("Administrator market actions must remain available");
        fireEvent.click(install);
        fireEvent.click(sync);
        expect(onAction).toHaveBeenNthCalledWith(
          1,
          "install",
          expect.objectContaining({ id: "market-toolbox" }),
        );
        expect(onAction).toHaveBeenNthCalledWith(
          2,
          "install",
          expect.objectContaining({ id: "installed-toolbox" }),
        );
      }
    },
  );
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@/app/locales/i18n";

import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import type { Entitlement } from "@/framework/entitlement/types";
import {
  extensionRoutes,
  extensionStandaloneRoutes,
  extensionWorkspaceActions,
  freezeExtensions,
  registerExtension,
  resetExtensionsForTesting,
} from "@/framework/extension/registry";

afterEach(() => {
  resetExtensionsForTesting();
});

function entitlement(overrides: Partial<Entitlement>): Entitlement {
  return {
    capabilities: [],
    edition: "community",
    extensions: [],
    features: [],
    licensed: false,
    limits: {},
    state: "unlicensed",
    ...overrides,
  };
}

function renderStandalone(path: string, snapshot: Entitlement | null) {
  const router = createMemoryRouter(extensionStandaloneRoutes(), { initialEntries: [path] });
  render(
    <EntitlementContext.Provider value={{ loading: false, refresh: async () => {}, snapshot }}>
      <RouterProvider router={router} />
    </EntitlementContext.Provider>,
  );
}

function registerDemo() {
  registerExtension({
    capability: "demo_capability",
    id: "demo",
    standaloneRoutes: [{ element: <p>demo page</p>, path: "/demo" }],
  });
}

describe("extension registry", () => {
  it("renders an extension page where the server reports its capability", () => {
    registerDemo();
    renderStandalone(
      "/demo",
      entitlement({ capabilities: ["demo_capability"], extensions: ["demo_capability"] }),
    );

    expect(screen.getByText("demo page")).toBeInTheDocument();
  });

  // The build carries the code; only the capability list decides whether it shows.
  it("does not mount the page when the licence does not cover it", () => {
    registerDemo();
    renderStandalone("/demo", entitlement({ extensions: ["demo_capability"] }));

    expect(screen.queryByText("demo page")).not.toBeInTheDocument();
  });

  it("does not mount the page before the capability list arrives", () => {
    registerDemo();
    renderStandalone("/demo", null);

    expect(screen.queryByText("demo page")).not.toBeInTheDocument();
  });

  // A catalogued capability the licence does not cover gets the upgrade page, not a bare
  // refusal: what it is, the edition it needs, and the way to the licence portal.
  it("offers the upgrade when the licence falls short of a catalogued capability", () => {
    registerExtension({
      capability: "graph_explorer",
      id: "demo",
      standaloneRoutes: [{ element: <p>demo page</p>, path: "/demo" }],
    });
    renderStandalone(
      "/demo",
      entitlement({ edition: "community", extensions: ["graph_explorer"], state: "valid" }),
    );

    expect(screen.queryByText("demo page")).not.toBeInTheDocument();
    expect(screen.getByText("图探索")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "升级到专业版" })).toHaveAttribute(
      "href",
      "https://license.openbkn.ai/",
    );
  });

  it("opens a catalogued capability once the licence covers it", () => {
    registerExtension({
      capability: "graph_explorer",
      id: "demo",
      standaloneRoutes: [{ element: <p>demo page</p>, path: "/demo" }],
    });
    renderStandalone(
      "/demo",
      entitlement({
        capabilities: ["graph_explorer"],
        edition: "professional",
        extensions: ["graph_explorer"],
        licensed: true,
        state: "valid",
      }),
    );

    expect(screen.getByText("demo page")).toBeInTheDocument();
  });

  it("keeps shell routes and standalone routes apart", () => {
    registerExtension({
      capability: "demo_capability",
      id: "demo",
      routes: [{ element: <p />, path: "demo-shell" }],
      standaloneRoutes: [{ element: <p />, path: "/demo-standalone" }],
    });

    expect(extensionRoutes().map((route) => route.path)).toEqual(["demo-shell"]);
    expect(extensionStandaloneRoutes().map((route) => route.path)).toEqual(["/demo-standalone"]);
  });

  it("rejects the same id twice", () => {
    registerDemo();

    expect(registerDemo).toThrow(/registered twice/);
  });

  // The router is built once at mount; a late route would be silently missing.
  it("rejects a registration after the app mounted", () => {
    freezeExtensions();

    expect(registerDemo).toThrow(/after the app mounted/);
  });

  // The gate wraps route.element, so a route rendered through lazy would bypass it.
  it("rejects a route with no element to gate", () => {
    expect(() =>
      registerExtension({
        capability: "demo_capability",
        id: "demo",
        standaloneRoutes: [{ lazy: () => Promise.resolve({ element: <p /> }), path: "/demo" }],
      }),
    ).toThrow(/without an element/);
  });

  // Two extensions may each name their button after themselves; the React key must not collide.
  it("lists workspace buttons across extensions under distinct keys", () => {
    const path = (networkId: string) => `/demo/${networkId}`;
    registerExtension({
      capability: "demo_capability",
      id: "first",
      workspaceActions: [{ id: "open", labelKey: "first.open", path }],
    });
    registerExtension({
      capability: "demo_capability",
      id: "second",
      workspaceActions: [{ id: "open", labelKey: "second.open", path }],
    });

    expect(extensionWorkspaceActions().map(({ key, labelKey }) => ({ key, labelKey }))).toEqual([
      { key: "first:open", labelKey: "first.open" },
      { key: "second:open", labelKey: "second.open" },
    ]);
  });

  it("adds copy without overriding what is already there", () => {
    i18n.addResourceBundle("en-US", "translation", { extensionDemo: { kept: "core" } }, true, true);

    registerExtension({
      capability: "demo_capability",
      id: "demo",
      locales: { "en-US": { extensionDemo: { added: "extension", kept: "extension" } } },
    });

    expect(i18n.getResource("en-US", "translation", "extensionDemo.kept")).toBe("core");
    expect(i18n.getResource("en-US", "translation", "extensionDemo.added")).toBe("extension");
  });
});

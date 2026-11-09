/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_APP_ENTRY_PATH } from "@/app/router/app-paths";
import { createAppRouter } from "@/app/router/create-router";
import { registerExtension, resetExtensionsForTesting } from "@/framework/extension/registry";

afterEach(() => {
  resetExtensionsForTesting();
});

describe("createAppRouter", () => {
  it("adds installed extensions beside the module routes", () => {
    registerExtension({
      capability: "demo_capability",
      id: "demo",
      routes: [{ element: <p />, path: "demo-shell" }],
      standaloneRoutes: [{ element: <p />, path: "/demo-standalone" }],
    });

    const router = createAppRouter();
    const shell = router.routes.find((route) => route.path === DEFAULT_APP_ENTRY_PATH);

    expect(router.routes.some((route) => route.path === "/demo-standalone")).toBe(true);
    expect(shell?.children?.some((route) => route.path === "demo-shell")).toBe(true);
    // The catch-all stays last so an extension route is not shadowed by the 404 page.
    expect(shell?.children?.at(-1)?.path).toBe("*");
  });

  it("routes a sidebar entry's workspace page beside the standalone routes", () => {
    registerExtension({
      capability: "demo_capability",
      id: "demo",
      workspaceNavItems: [
        {
          id: "list",
          labelKey: "list",
          page: { component: () => null, route: "/knowledge-network/workspace/:networkId/list" },
          path: (networkId) => `/knowledge-network/workspace/${networkId}/list`,
        },
      ],
    });

    const router = createAppRouter();

    expect(
      router.routes.some((route) => route.path === "/knowledge-network/workspace/:networkId/list"),
    ).toBe(true);
  });

  it("builds the community routes when nothing is installed", () => {
    const router = createAppRouter();

    expect(router.routes.some((route) => route.path === "/demo-standalone")).toBe(false);
  });
  it("provides a community knowledge base licence page without an installed extension", () => {
    const router = createAppRouter();
    const shell = router.routes.find((r) => r.path === DEFAULT_APP_ENTRY_PATH);
    expect(shell?.children?.some((r) => r.path === "knowledge-base/*")).toBe(true);
  });
  it("does not shadow the installed knowledge base routes with a community fallback", () => {
    registerExtension({
      id: "knowledge-base",
      capability: "knowledge_base",
      routes: [{ path: "knowledge-base", element: <p>Installed knowledge base</p> }],
    });
    const router = createAppRouter();
    const shell = router.routes.find((r) => r.path === DEFAULT_APP_ENTRY_PATH);
    expect(shell?.children?.some((r) => r.path === "knowledge-base")).toBe(true);
    expect(shell?.children?.some((r) => r.path === "knowledge-base/*")).toBe(false);
  });
});

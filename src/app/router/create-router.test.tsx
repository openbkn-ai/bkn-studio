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

  it("builds the community routes when nothing is installed", () => {
    const router = createAppRouter();

    expect(router.routes.some((route) => route.path === "/demo-standalone")).toBe(false);
  });
});

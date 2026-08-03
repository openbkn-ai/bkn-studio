/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { defaultModuleRoutePath, moduleRoutes } from "@/app/router/module-routes";
import { consoleNavigation } from "@/app/shell/console-navigation";
import { runtimeModuleManifests } from "@/framework/runtime/module-manifests";
import { homeModuleManifest } from "@/modules/home/module.manifest";
import { homeNavigation } from "@/modules/home/navigation";
import { homeRouteContribution } from "@/modules/home/routes";
import { knowledgeNetworkRouteContribution } from "@/modules/knowledge-network/routes";

describe("home module registration", () => {
  it("contributes the /home route", () => {
    expect(homeRouteContribution.moduleId).toBe("home");
    expect(homeRouteContribution.routes.map((route) => route.path)).toEqual(["home"]);
    expect(moduleRoutes.some((route) => route.path === "home")).toBe(true);
  });

  it("owns the default entry path so / lands on the workspace", () => {
    expect(homeRouteContribution.defaultEntryPath).toBe("/home");
    expect(knowledgeNetworkRouteContribution.defaultEntryPath).toBeUndefined();
    expect(defaultModuleRoutePath).toBe("/home");
  });

  it("is the first navigation item and keeps a non-root path", () => {
    const first = consoleNavigation[0];

    expect(first?.key).toBe("home");
    expect(first?.path).toBe("/home");
    expect(homeNavigation.parentKey).toBeUndefined();
  });

  it("registers a permission-free manifest", () => {
    expect(runtimeModuleManifests.map((manifest) => manifest.id)).toContain("home");
    expect(homeModuleManifest.permissions).toEqual([]);
  });
});

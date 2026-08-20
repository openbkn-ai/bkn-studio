/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { dataCatalogModuleManifest } from "@/modules/data-catalog/module.manifest";
import { dataCatalogNavigation } from "@/modules/data-catalog/navigation";
import { dataCatalogRoutes } from "@/modules/data-catalog/routes";
import { dataConnectModuleManifest } from "@/modules/data-connect/module.manifest";
import { dataConnectNavigation } from "@/modules/data-connect/navigation";
import { dataConnectRoutes } from "@/modules/data-connect/routes";

/**
 * The data console is deliberately un-gated. bkn-safe issues `catalog` and `resource` grants only
 * from the object-authorization page, which is an enterprise capability, so on community
 * deployments no administrator can hand these points out: a gate here hides working functionality
 * from everyone except the super administrator, and the user cannot ask for the missing grant
 * because there is nowhere to issue it. The backend still answers 403 for calls a caller may not
 * make; these tests keep the frontend from quietly re-introducing a gate in front of it.
 */

const MODULE_SOURCES = Object.entries(
  import.meta.glob(["../data-catalog/**/*.{ts,tsx}", "../data-connect/**/*.{ts,tsx}"], {
    eager: true,
    import: "default",
    query: "?raw",
  }),
).filter(([path]) => !path.includes(".test."));

function routePermissions(routes: { element?: unknown }[]): unknown[] {
  return routes
    .map((route) => route.element)
    .filter(
      (element): element is { props: { permissions?: unknown } } =>
        isValidElement<{ permissions?: unknown }>(element) && element.props.permissions !== undefined,
    )
    .map((element) => element.props.permissions);
}

describe("the data console does not gate on permission points", () => {
  it("declares no permission points in either manifest", () => {
    expect(dataCatalogModuleManifest.permissions).toEqual([]);
    expect(dataConnectModuleManifest.permissions).toEqual([]);
  });

  it("registers no route behind a permission guard", () => {
    expect(routePermissions(dataCatalogRoutes)).toEqual([]);
    expect(routePermissions(dataConnectRoutes)).toEqual([]);
  });

  it("shows every navigation entry regardless of grants", () => {
    for (const item of [...dataCatalogNavigation.items, ...dataConnectNavigation.items]) {
      expect(item.permission, item.key).toBeUndefined();
    }
  });

  /**
   * The rule is about which points may be asked for, not about the mechanism. Gating on an
   * administrative point such as admin-authz:grant is fine — role management issues it — while
   * `catalog:` and `resource:` points can only come from the object-authorization page, which is
   * the trap this branch exists to remove.
   */
  it("never asks for a catalog or resource permission point", () => {
    expect(MODULE_SOURCES.length).toBeGreaterThan(20);
    for (const [path, source] of MODULE_SOURCES) {
      expect(source, path).not.toMatch(/["'`](catalog|resource):[a-z_]+/);
    }
  });
});

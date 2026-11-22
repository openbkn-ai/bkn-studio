/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { deriveStudioPermissions, flattenSafeGrants } from "@/framework/auth/permission-map";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { dataCatalogModuleManifest } from "@/modules/data-catalog/module.manifest";
import { dataCatalogRoutes } from "@/modules/data-catalog/routes";

describe("data-catalog routes", () => {
  it("preserves the data-catalog console handle at the index route", () => {
    const rootRoute = dataCatalogRoutes.find((route) => route.path === "data-catalog");
    const indexRoute = rootRoute?.children?.find((route) => route.index);

    expect(rootRoute).toBeDefined();
    expect(indexRoute).toBeDefined();
    expect(indexRoute?.handle).toEqual(rootRoute?.handle);
  });

  it("does not register retired compatibility routes", () => {
    const paths = dataCatalogRoutes.map((route) => route.path);

    for (const retired of [
      "data-directory",
      "data-directory/catalog/:catalogId",
      "data-directory/resource/:resourceId",
      "index-builds",
    ]) {
      expect(paths).not.toContain(retired);
    }
  });

  it("registers separate creation and editing pages for views", () => {
    const paths = dataCatalogRoutes.map((route) => route.path);
    expect(paths).toContain("data-catalog/catalog/:catalogId/views/new");
    expect(paths).toContain("data-catalog/resource/:resourceId/edit");
  });

  it("registers separate API Resource detail, create, and edit routes", () => {
    const paths = dataCatalogRoutes.map((route) => route.path);
    expect(paths).toContain("data-catalog/api-resource/:resourceId");
    expect(paths).toContain("data-catalog/catalog/:catalogId/api/new");
    expect(paths).toContain("data-catalog/api-resource/:resourceId/edit");
  });

  it("allows a resource-only editor to enter the edit route but not the create route", () => {
    const permissions = deriveStudioPermissions(
      dataCatalogModuleManifest.permissions,
      flattenSafeGrants([
        { resource: { type: "resource", id: "orders" }, operations: ["view_detail", "modify"] },
      ]),
      false,
    );
    const canEnter = (path: string) => {
      const element = dataCatalogRoutes.find((route) => route.path === path)?.element;
      if (!isValidElement<{ permissions: string | string[] }>(element))
        throw new Error("Expected a guarded route");
      return hasPermissions({
        currentPermissions: permissions,
        requiredPermissions: element.props.permissions,
        mode: "any",
      });
    };
    expect(canEnter("data-catalog/api-resource/:resourceId/edit")).toBe(true);
    expect(canEnter("data-catalog/catalog/:catalogId/api/new")).toBe(false);
  });
});

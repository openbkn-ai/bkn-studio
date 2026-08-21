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
import { dataCatalogNavigation } from "@/modules/data-catalog/navigation";
import { dataCatalogRoutes } from "@/modules/data-catalog/routes";

type SafeGrant = { operations: string[]; resource: { id: string; type: string } };

type RouteGuardProps = { permissions?: string | string[] };

/**
 * Route guards are `<RequirePermission mode="any" permissions={...}>` wrappers, so the points a
 * page demands can be read straight off the element instead of being restated by the test.
 */
function guardPermissionsOf(path: string): string[] {
  const element = dataCatalogRoutes.find((route) => route.path === path)?.element;
  if (!isValidElement<RouteGuardProps>(element)) {
    throw new Error(`route ${path} is not registered`);
  }
  const required = element.props.permissions ?? [];
  return typeof required === "string" ? [required] : [...required];
}

function guardedRoutePaths(): string[] {
  return dataCatalogRoutes
    .filter(
      (route) => isValidElement<RouteGuardProps>(route.element) && route.element.props.permissions,
    )
    .map((route) => route.path ?? "");
}

/** Permissions the console would actually hold for the given bkn-safe grants. */
function permissionsOf(grants: SafeGrant[]): string[] {
  return deriveStudioPermissions(
    dataCatalogModuleManifest.permissions,
    flattenSafeGrants(grants),
    false,
  );
}

const canEnter = (permissions: string[], required: string[]) =>
  hasPermissions({ currentPermissions: permissions, mode: "any", requiredPermissions: required });

describe("data-catalog permission points", () => {
  /**
   * deriveStudioPermissions filters against the manifest, so a guard asking for a point no module
   * declares is unsatisfiable — the route 403s for everyone, including users whose API calls would
   * have succeeded. That is what the resource-verb convergence (openbkn-ai/bkn-foundry#986) would
   * have done to /index-builds had the gates been left on the table's own verbs.
   */
  it("every route guard asks only for points the manifest declares", () => {
    for (const path of guardedRoutePaths()) {
      for (const permission of guardPermissionsOf(path)) {
        expect(dataCatalogModuleManifest.permissions, `route ${path}`).toContain(permission);
      }
    }
  });

  it("navigation entries ask only for points the manifest declares", () => {
    for (const item of dataCatalogNavigation.items) {
      for (const permission of item.permission ?? []) {
        expect(dataCatalogModuleManifest.permissions, `nav ${item.key}`).toContain(permission);
      }
    }
  });

  it("declares no verb the table gave up", () => {
    for (const dead of [
      "resource:create",
      "resource:modify",
      "resource:delete",
      "resource:task_manage",
    ]) {
      expect(dataCatalogModuleManifest.permissions).not.toContain(dead);
    }
  });

  it("the index-build menu entry and its route guard stay in sync", () => {
    const navigationItem = dataCatalogNavigation.items.find((item) => item.path === "/index-builds");

    expect(navigationItem?.permission).toEqual(guardPermissionsOf("index-builds"));
    expect(navigationItem?.permissionMode).toBe("any");
  });

  it("a catalog task grant opens the index-build page", () => {
    const permissions = permissionsOf([
      { resource: { type: "catalog", id: "*" }, operations: ["view_detail", "task_manage"] },
      { resource: { type: "resource", id: "*" }, operations: ["view_detail", "query_data"] },
    ]);

    expect(canEnter(permissions, guardPermissionsOf("index-builds"))).toBe(true);
    expect(canEnter(permissions, guardPermissionsOf("data-directory"))).toBe(true);
  });

  it("a table-only grant browses the catalog but cannot manage build tasks", () => {
    const permissions = permissionsOf([
      { resource: { type: "resource", id: "*" }, operations: ["view_detail", "query_data"] },
    ]);

    expect(canEnter(permissions, guardPermissionsOf("data-directory"))).toBe(true);
    expect(canEnter(permissions, guardPermissionsOf("index-builds"))).toBe(false);
  });

  it("holds no data permission by default: an ungranted user sees neither page", () => {
    const permissions = permissionsOf([]);

    expect(permissions).toEqual([]);
    expect(canEnter(permissions, guardPermissionsOf("data-directory"))).toBe(false);
    expect(canEnter(permissions, guardPermissionsOf("index-builds"))).toBe(false);
  });
});

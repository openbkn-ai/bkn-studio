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
import { catalogDetailPermissions } from "@/modules/data-catalog/permissions";
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
   * have done to /task-management had the gates been left on the table's own verbs.
   */
  it("every route guard asks only for points the manifest declares", () => {
    for (const path of guardedRoutePaths()) {
      for (const permission of guardPermissionsOf(path)) {
        expect(dataCatalogModuleManifest.permissions, `route ${path}`).toContain(permission);
      }
    }
  });

  it("declares every permission required by the catalog detail view", () => {
    for (const permission of catalogDetailPermissions) {
      expect(dataCatalogModuleManifest.permissions, "catalog detail").toContain(permission);
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

  it("the task-management menu entry and list route are public entry points", () => {
    const navigationItem = dataCatalogNavigation.items.find((item) => item.path === "/task-management");

    expect(navigationItem?.permission).toBeUndefined();
    expect(navigationItem?.permissionMode).toBeUndefined();
    expect(guardPermissionsOf("task-management")).toEqual([]);
  });

  it("a catalog task grant opens the task-management page", () => {
    const permissions = permissionsOf([
      { resource: { type: "catalog", id: "*" }, operations: ["view_detail", "task_manage"] },
      { resource: { type: "resource", id: "*" }, operations: ["view_detail", "query_data"] },
    ]);

    expect(canEnter(permissions, guardPermissionsOf("task-management"))).toBe(true);
    expect(canEnter(permissions, guardPermissionsOf("data-catalog"))).toBe(true);
  });

  it("a table-only grant can enter the public catalog and build-task pages", () => {
    const permissions = permissionsOf([
      { resource: { type: "resource", id: "*" }, operations: ["view_detail", "query_data"] },
    ]);

    expect(canEnter(permissions, guardPermissionsOf("data-catalog"))).toBe(true);
    expect(canEnter(permissions, guardPermissionsOf("task-management"))).toBe(true);
  });

  it("an ungranted user can enter public list pages", () => {
    const permissions = permissionsOf([]);

    expect(permissions).toEqual([]);
    expect(canEnter(permissions, guardPermissionsOf("data-catalog"))).toBe(true);
    expect(canEnter(permissions, guardPermissionsOf("task-management"))).toBe(true);
  });
});

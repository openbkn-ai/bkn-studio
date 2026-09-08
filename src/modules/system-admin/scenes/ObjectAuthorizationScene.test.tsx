/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ObjectGrant } from "@/modules/system-admin/types/authz";

const listObjectGrantsPageMock = vi.hoisted(() => vi.fn());
const revokeObjectGrantMock = vi.hoisted(() => vi.fn());
const appServices = vi.hoisted(() => ({
  message: { error: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn() },
  runtimeConfig: { currentUser: { id: "u-owner", permissions: [] as string[] } },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => appServices,
}));

vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listObjectGrantsPage: listObjectGrantsPageMock,
  listObjectGroups: vi.fn(() => Promise.resolve({ groups: [], total: 0 })),
  revokeObjectGrant: revokeObjectGrantMock,
}));

vi.mock("@/modules/system-admin/services/authz-objects.service", () => ({
  resolveGrantNames: (grants: ObjectGrant[]) => Promise.resolve(grants),
}));

vi.mock("@/modules/system-admin/utils/audit-lookup-cache", () => ({
  getCachedDepartments: vi.fn(() => Promise.resolve([])),
  getCachedUserSync: vi.fn(() => undefined),
  hydrateUserLookup: vi.fn(() => Promise.resolve(undefined)),
  primeUserLookupCache: vi.fn(),
}));

// The drawer has loaders of its own and is covered by its own suite; the list page's action menu is
// what this file is about.
vi.mock("@/modules/system-admin/components/ObjectAuthorizeDrawer", () => ({
  ObjectAuthorizeDrawer: () => null,
}));

import { ObjectAuthorizationScene } from "./ObjectAuthorizationScene";

function grant(accessorId: string, operations: string[]): ObjectGrant {
  return {
    accessorId,
    objId: `catalog-${accessorId}`,
    objName: `conn_${accessorId}`,
    objType: "catalog",
    operations,
  };
}

/** Opens the action menu on the row at `index` and returns its revoke item. */
async function openRevokeItem(index: number) {
  const triggers = screen.getAllByLabelText("systemAdmin.objectGrants.columns.actions");
  fireEvent.click(triggers[index]);
  await act(async () => {});
  const label = screen.getByText("systemAdmin.objectGrants.revoke");
  const item = label.closest("li");
  if (!item) {
    throw new Error("revoke menu item not rendered");
  }
  return item;
}

describe("ObjectAuthorizationScene revoke action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appServices.runtimeConfig.currentUser.id = "u-owner";
    appServices.runtimeConfig.currentUser.permissions = [
      "admin-authz:view",
      "admin-authz:revoke",
    ];
    listObjectGrantsPageMock.mockResolvedValue({
      grants: [grant("u-owner", ["view_detail", "authorize"]), grant("u-mate", ["view_detail"])],
      total: 2,
      summary: { grants: 2, objects: 2, grantees: 2 },
    });
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

  // This menu reaches the same DELETE the drawer's remove control does. Without the guard a caller
  // holding no `admin-authz:grant` could drop their own `authorize` here and land outside the
  // object with nothing in the UI to undo it.
  it("refuses to revoke the caller's own authorize row", async () => {
    render(<ObjectAuthorizationScene />);
    await act(async () => {});

    expect((await openRevokeItem(0)).getAttribute("aria-disabled")).toBe("true");
  });

  it("leaves someone else's row revocable", async () => {
    render(<ObjectAuthorizationScene />);
    await act(async () => {});

    expect((await openRevokeItem(1)).getAttribute("aria-disabled")).not.toBe("true");
  });
});

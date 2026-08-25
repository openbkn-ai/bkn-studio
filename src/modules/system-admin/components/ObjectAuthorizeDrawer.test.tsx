/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ObjectGrant } from "@/modules/system-admin/types/authz";

const listObjectGrantsForObjectMock = vi.hoisted(() => vi.fn());
const listUsersPageMock = vi.hoisted(() => vi.fn());
// One stable object, as the real context provides: the drawer's loaders are memoized on `message`,
// so a fresh literal per render would re-fire the load effect forever.
const appServices = vi.hoisted(() => ({
  message: { error: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn() },
  runtimeConfig: { currentUser: { permissions: [] as string[] } },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => appServices,
}));

vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listObjectGrantsForObject: listObjectGrantsForObjectMock,
  revokeObjectGrantForObject: vi.fn(),
  upsertObjectGrantForObject: vi.fn(),
}));

vi.mock("@/modules/system-admin/services/admin.service", () => ({
  listUsersPage: listUsersPageMock,
}));

vi.mock("@/modules/system-admin/utils/audit-lookup-cache", () => ({
  getCachedDepartments: vi.fn(() => Promise.resolve([])),
  getCachedUserSync: vi.fn(() => undefined),
  hydrateUserLookup: vi.fn(() => Promise.resolve(undefined)),
  primeUserLookupCache: vi.fn(),
}));

import { ObjectAuthorizeDrawer } from "./ObjectAuthorizeDrawer";

const PUBLIC_ACCESSOR_ID = "00000000-0000-0000-0000-000000000000";

function grant(accessorId: string, operations: string[]): ObjectGrant {
  return {
    accessorId,
    objId: "catalog-1",
    objName: "nb_test_conn",
    objType: "catalog",
    operations,
  };
}

function renderDrawer() {
  return render(
    <ObjectAuthorizeDrawer
      objectAuthorized
      objId="catalog-1"
      objName="nb_test_conn"
      objType="catalog"
      onClose={vi.fn()}
      open
    />,
  );
}

/** The lock icon marks a row the caller may not write; each card renders one at most. */
function lockedCardCount() {
  return document.querySelectorAll('[aria-label="lock"]').length;
}

describe("ObjectAuthorizeDrawer rows a delegate may not write", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appServices.runtimeConfig.currentUser.permissions = [];
    listUsersPageMock.mockResolvedValue({ total: 0, users: [] });
    listObjectGrantsForObjectMock.mockResolvedValue({
      accounts: [],
      grants: [
        grant("u-owner", ["view_detail", "authorize"]),
        grant(PUBLIC_ACCESSOR_ID, ["view_detail"]),
        grant("u-mate", ["view_detail"]),
      ],
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

  // bkn-safe's protectAuthorizeHolder refuses a non-administrator write against an `authorize`
  // holder — the caller's own row included — and against the public-access row. Offering the
  // controls anyway means a click that can only 403.
  it("locks the authorize holder and the public row for an owner", async () => {
    renderDrawer();
    await act(async () => {});

    expect(lockedCardCount()).toBe(2);
    // The ordinary grant stays editable: that is what the owner opened the drawer for.
    expect(screen.getAllByText("systemAdmin.objectGrants.remove")).toHaveLength(1);
  });

  it("leaves every row writable for a platform administrator", async () => {
    appServices.runtimeConfig.currentUser.permissions = [
      "admin-authz:grant",
      "admin-authz:revoke",
    ];
    renderDrawer();
    await act(async () => {});

    expect(lockedCardCount()).toBe(0);
    expect(screen.getAllByText("systemAdmin.objectGrants.remove")).toHaveLength(3);
  });
});

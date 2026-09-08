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
  runtimeConfig: { currentUser: { id: "u-owner", permissions: [] as string[] } },
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

function renderDrawer({ objectAuthorized = true } = {}) {
  return render(
    <ObjectAuthorizeDrawer
      objectAuthorized={objectAuthorized}
      objId="catalog-1"
      objName="nb_test_conn"
      objType="catalog"
      onClose={vi.fn()}
      open
    />,
  );
}

/** The lock icon marks a row the caller may not erase; each card renders one at most. */
function lockedCardCount() {
  return document.querySelectorAll('[aria-label="lock"]').length;
}

/** The operation chip for `opKey` on the card of the grantee rendered under `granteeName`. */
function findChip(granteeName: string, opKey: string) {
  // authzWhoName -> authzWho -> authzCardHead -> authzCard
  const card = screen.getByText(granteeName).closest("div")?.parentElement;
  return [...(card?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes(opKey),
  );
}

function chipOn(granteeName: string, opKey: string) {
  const chip = findChip(granteeName, opKey);
  if (!chip) {
    throw new Error(`no ${opKey} chip on the ${granteeName} card`);
  }
  return chip;
}

describe("ObjectAuthorizeDrawer rows a delegate may not write", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appServices.runtimeConfig.currentUser.id = "u-owner";
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

  // The two admin-authz points are configured separately, and the platform authorization page does
  // not pass objectAuthorized. A role holding revoke alone is still an administrator to bkn-safe,
  // so the rows stay removable — reading administrator status off the grant point alone took the
  // remove control away from them.
  it("leaves every row removable for a revoke-only administrator", async () => {
    appServices.runtimeConfig.currentUser.id = "u-admin";
    appServices.runtimeConfig.currentUser.permissions = [
      "admin-authz:view",
      "admin-authz:revoke",
    ];
    renderDrawer({ objectAuthorized: false });
    await act(async () => {});

    expect(lockedCardCount()).toBe(0);
    expect(screen.getAllByText("systemAdmin.objectGrants.remove")).toHaveLength(3);
  });

  // Restoring `authorize` is a grant, and a revoke-only administrator holds no grant point: dropping
  // it from their own row would leave them outside the object with no control here to undo it. The
  // rows they can put back stay open.
  it("keeps a revoke-only administrator from dropping their own authorize", async () => {
    appServices.runtimeConfig.currentUser.permissions = [
      "admin-authz:view",
      "admin-authz:revoke",
    ];
    renderDrawer();
    await act(async () => {});

    expect(lockedCardCount()).toBe(1);
    // Their own row is the locked one; the public row and the ordinary grant stay removable.
    expect(screen.getAllByText("systemAdmin.objectGrants.remove")).toHaveLength(2);
    // Only the erasing direction is pinned. Adding an operation to their own row is a POST of the
    // union and leaves `authorize` standing, so the rest of the card stays live. (#518 already
    // keeps the `authorize` chip itself off this surface — offering it would be a grant.)
    expect(findChip("u-owner", "authorize")).toBeUndefined();
    expect(chipOn("u-owner", "modify").disabled).toBe(false);
  });

  // Unchecking the last operation on a row is a DELETE, so it runs on the revoke point — the one
  // route by which a chip, not the remove control, can erase an `authorize`-only row. The platform
  // authorization page passes no objectAuthorized, which is where that chip renders.
  it("pins an authorize-only row of the caller's own", async () => {
    appServices.runtimeConfig.currentUser.permissions = [
      "admin-authz:view",
      "admin-authz:revoke",
    ];
    listObjectGrantsForObjectMock.mockResolvedValue({
      accounts: [],
      grants: [grant("u-owner", ["authorize"]), grant("u-mate", ["authorize"])],
    });
    renderDrawer({ objectAuthorized: false });
    await act(async () => {});

    expect(lockedCardCount()).toBe(1);
    expect(chipOn("u-owner", "authorize").disabled).toBe(true);
    // Someone else's authorize-only row is still theirs to revoke, and that is what the point is
    // for — so this proves the lock reads the accessor, not the caller's missing grant point.
    expect(chipOn("u-mate", "authorize").disabled).toBe(false);
  });

  // The same caller holding the grant point can restore what they drop, so nothing is locked.
  it("leaves the caller's own authorize row open once they hold the grant point", async () => {
    appServices.runtimeConfig.currentUser.permissions = ["admin-authz:grant"];
    renderDrawer();
    await act(async () => {});

    expect(lockedCardCount()).toBe(0);
    expect(screen.getAllByText("systemAdmin.objectGrants.remove")).toHaveLength(3);
  });
});

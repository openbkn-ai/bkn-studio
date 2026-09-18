/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { GrantRecord, ObjectGrant } from "@/modules/system-admin/types/authz";
import {
  canManageGrantSource,
  grantCreatorUserId,
  isRoleGrantSubject,
  isUserDirectorySubject,
  PUBLIC_ACCESSOR_ID,
  isDelegateProtectedGrant,
  isSelfAuthorizeLockout,
} from "@/modules/system-admin/utils/object-grant-guards";

const source = (createdBy?: string): GrantRecord => ({
  accessorId: "u-mate",
  active: true,
  authoritySource: "owner_delegate",
  createdBy,
  effect: "allow",
  grantId: "grant-1",
  inherited: false,
  operation: "view_detail",
  policySource: "professional_rule",
});

function grant(accessorId: string, operations: string[]): ObjectGrant {
  return {
    accessorId,
    objId: "catalog-1",
    objName: "nb_test_conn",
    objType: "catalog",
    operations,
  };
}

describe("isDelegateProtectedGrant", () => {
  it("protects the public target without locking an unrelated authorize source", () => {
    expect(isDelegateProtectedGrant(grant("u-owner", ["view_detail", "authorize"]))).toBe(false);
    expect(isDelegateProtectedGrant(grant(PUBLIC_ACCESSOR_ID, ["view_detail"]))).toBe(true);
  });

  it("leaves an ordinary grant alone", () => {
    expect(isDelegateProtectedGrant(grant("u-mate", ["view_detail", "modify"]))).toBe(false);
  });
});

describe("isSelfAuthorizeLockout", () => {
  const own = grant("u-owner", ["view_detail", "authorize"]);

  it("holds for a caller who cannot grant `authorize` back", () => {
    expect(
      isSelfAuthorizeLockout({ currentUserId: "u-owner", grant: own, isAdminGrantor: false }),
    ).toBe(true);
  });

  it("clears once the caller holds the grant point", () => {
    expect(
      isSelfAuthorizeLockout({ currentUserId: "u-owner", grant: own, isAdminGrantor: true }),
    ).toBe(false);
  });

  it("is about the caller's own row, not every authorize holder", () => {
    expect(
      isSelfAuthorizeLockout({ currentUserId: "u-mate", grant: own, isAdminGrantor: false }),
    ).toBe(false);
  });

  it("ignores a row of theirs that carries no authorize", () => {
    expect(
      isSelfAuthorizeLockout({
        currentUserId: "u-owner",
        grant: grant("u-owner", ["view_detail"]),
        isAdminGrantor: false,
      }),
    ).toBe(false);
  });

  // An unauthenticated runtime carries a null id; matching it against an accessor would lock rows
  // at random.
  it("never fires without a known caller", () => {
    expect(isSelfAuthorizeLockout({ currentUserId: null, grant: own, isAdminGrantor: false })).toBe(
      false,
    );
  });
});

describe("canManageGrantSource", () => {
  it("allows a delegate to manage only its own concrete source", () => {
    expect(
      canManageGrantSource({
        currentUserId: "u-b",
        isPlatformAuthzAdmin: false,
        source: source("u-b"),
      }),
    ).toBe(true);
    expect(
      canManageGrantSource({
        currentUserId: "u-b",
        isPlatformAuthzAdmin: false,
        source: source("u-a"),
      }),
    ).toBe(false);
  });

  it("keeps authorize and non-delegated source kinds protected from a delegate", () => {
    expect(
      canManageGrantSource({
        currentUserId: "u-b",
        isPlatformAuthzAdmin: false,
        source: { ...source("u-b"), operation: "authorize" },
      }),
    ).toBe(false);
    expect(
      canManageGrantSource({
        currentUserId: "u-b",
        isPlatformAuthzAdmin: false,
        source: { ...source("u-b"), authoritySource: "admin_authz" },
      }),
    ).toBe(false);
    expect(
      canManageGrantSource({
        currentUserId: "u-b",
        isPlatformAuthzAdmin: false,
        source: { ...source("u-b"), effect: "deny" },
      }),
    ).toBe(false);
  });

  it("keeps unattributable historical sources read-only for delegates", () => {
    expect(
      canManageGrantSource({ currentUserId: "u-b", isPlatformAuthzAdmin: false, source: source() }),
    ).toBe(false);
  });

  it("allows a platform authorization administrator to manage every source", () => {
    expect(
      canManageGrantSource({
        currentUserId: "u-admin",
        isPlatformAuthzAdmin: true,
        source: source("u-a"),
      }),
    ).toBe(true);
  });
});

describe("grantCreatorUserId", () => {
  it("returns only concrete user IDs", () => {
    expect(grantCreatorUserId(source("u-b"))).toBe("u-b");
    expect(grantCreatorUserId(source("owner_delegate"))).toBeUndefined();
    expect(grantCreatorUserId(source("system:migration"))).toBeUndefined();
    expect(grantCreatorUserId(source())).toBeUndefined();
  });
});

describe("isRoleGrantSubject", () => {
  it("recognizes both the current response field and older role-permission rows", () => {
    const ordinary = grant("u-mate", ["view_detail"]);
    expect(isRoleGrantSubject({ ...ordinary, accessorType: "role" })).toBe(true);
    expect(
      isRoleGrantSubject({
        ...ordinary,
        grants: [{ ...source(), policySource: "role_permission" }],
      }),
    ).toBe(true);
    expect(isRoleGrantSubject(ordinary)).toBe(false);
  });
});

describe("isUserDirectorySubject", () => {
  it("excludes role and public subjects from user-directory lookup", () => {
    expect(
      isUserDirectorySubject({ ...grant("u-mate", ["view_detail"]), accessorType: "role" }),
    ).toBe(false);
    expect(isUserDirectorySubject(grant(PUBLIC_ACCESSOR_ID, ["view_detail"]))).toBe(false);
    expect(isUserDirectorySubject(grant("u-mate", ["view_detail"]))).toBe(true);
  });
});

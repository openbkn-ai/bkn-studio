/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { ObjectGrant } from "@/modules/system-admin/types/authz";
import {
  PUBLIC_ACCESSOR_ID,
  isDelegateProtectedGrant,
  isSelfAuthorizeLockout,
} from "@/modules/system-admin/utils/object-grant-guards";

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
  it("covers the rows bkn-safe refuses from a delegate", () => {
    expect(isDelegateProtectedGrant(grant("u-owner", ["view_detail", "authorize"]))).toBe(true);
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

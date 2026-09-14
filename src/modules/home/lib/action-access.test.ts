/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { canAccessHomeAction } from "@/modules/home/lib/action-access";

describe("canAccessHomeAction", () => {
  it("allows actions without a permission requirement", () => {
    expect(canAccessHomeAction([], {})).toBe(true);
  });

  it("allows configured navigation entries without a menu permission", () => {
    expect(
      canAccessHomeAction([], {
        path: "/knowledge-network",
        permissions: "knowledge-network:view",
      }),
    ).toBe(true);
  });

  it("keeps non-navigation actions permission-gated", () => {
    expect(
      canAccessHomeAction([], {
        path: "/data-connect/discover",
        permissions: "catalog:task_manage",
      }),
    ).toBe(false);
  });

  it("blocks a permission-gated action without a required permission", () => {
    expect(
      canAccessHomeAction(["knowledge-network:view"], {
        permissionMode: "any",
        permissions: ["admin-user:create", "admin-user:edit"],
      }),
    ).toBe(false);
  });

  it("allows an any-mode action when one permission matches", () => {
    expect(
      canAccessHomeAction(["admin-user:edit"], {
        permissionMode: "any",
        permissions: ["admin-user:create", "admin-user:edit"],
      }),
    ).toBe(true);
  });
});

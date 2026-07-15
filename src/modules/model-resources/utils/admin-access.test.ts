/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { hasModelResourcesAdminRole } from "@/modules/model-resources/utils/admin-access";

describe("hasModelResourcesAdminRole", () => {
  it("accepts admin and super_admin role keys", () => {
    expect(hasModelResourcesAdminRole(["admin"])).toBe(true);
    expect(hasModelResourcesAdminRole(["super_admin"])).toBe(true);
    expect(hasModelResourcesAdminRole(["normal_user", "super_admin"])).toBe(true);
  });

  it("accepts Chinese role display names from /me", () => {
    expect(hasModelResourcesAdminRole(["\u7cfb\u7edf\u7ba1\u7406\u5458"])).toBe(true);
    expect(hasModelResourcesAdminRole(["\u8d85\u7ea7\u7ba1\u7406\u5458"])).toBe(true);
  });

  it("rejects non-admin roles and empty input", () => {
    expect(hasModelResourcesAdminRole(["security"])).toBe(false);
    expect(hasModelResourcesAdminRole([])).toBe(false);
    expect(hasModelResourcesAdminRole(null)).toBe(false);
    expect(hasModelResourcesAdminRole(undefined)).toBe(false);
  });
});

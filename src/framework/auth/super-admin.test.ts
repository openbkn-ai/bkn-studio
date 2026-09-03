/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { isSuperAdmin } from "@/framework/auth/super-admin";

describe("isSuperAdmin", () => {
  it.each([["super_admin"], ["超级管理员"]])("recognizes the controlled role %s", (role) => {
    expect(isSuperAdmin(role)).toBe(true);
  });

  it("does not treat three-admin roles as super admin", () => {
    expect(isSuperAdmin(["admin", "security", "audit"])).toBe(false);
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { hasPermissions } from "@/framework/permission/has-permissions";

describe("hasPermissions", () => {
  it("returns true when all required permissions exist", () => {
    expect(
      hasPermissions({
        currentPermissions: ["knowledge-network:create", "knowledge-network:edit"],
        requiredPermissions: ["knowledge-network:create", "knowledge-network:edit"],
      }),
    ).toBe(true);
  });

  it("returns false when one required permission is missing", () => {
    expect(
      hasPermissions({
        currentPermissions: ["knowledge-network:create"],
        requiredPermissions: ["knowledge-network:create", "knowledge-network:edit"],
      }),
    ).toBe(false);
  });

  it("supports any mode", () => {
    expect(
      hasPermissions({
        currentPermissions: ["data-connect:test"],
        mode: "any",
        requiredPermissions: ["knowledge-network:create", "data-connect:test"],
      }),
    ).toBe(true);
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { AUTHZ_OBJECT_TYPES, isAuthzObjectType } from "./authz-catalog";

describe("object authorization types", () => {
  it("does not offer individual model authorization", () => {
    expect(AUTHZ_OBJECT_TYPES).not.toContain("small_model");
    expect(AUTHZ_OBJECT_TYPES).not.toContain("large_model");
    expect(isAuthzObjectType("small_model")).toBe(false);
    expect(isAuthzObjectType("large_model")).toBe(false);
  });
});

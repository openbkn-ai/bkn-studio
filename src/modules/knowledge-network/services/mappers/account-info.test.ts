/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { resolveAccountDisplayName } from "@/modules/knowledge-network/services/mappers/account-info";

describe("account-info", () => {
  it("prefers account name, then id, then fallback", () => {
    expect(resolveAccountDisplayName({ id: "user-1", name: "Admin" })).toBe("Admin");
    expect(resolveAccountDisplayName({ id: "user-1", name: "" })).toBe("user-1");
    expect(resolveAccountDisplayName("user-2")).toBe("user-2");
    expect(resolveAccountDisplayName(undefined)).toBe("--");
  });
});

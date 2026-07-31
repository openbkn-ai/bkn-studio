/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { accountSideNavigation } from "@/modules/account/navigation";

describe("accountSideNavigation", () => {
  it("exposes direct routes for each account workspace section", () => {
    expect(accountSideNavigation.map((item) => item.path)).toEqual([
      "/account/profile",
      "/account/security",
      "/account/api-keys",
    ]);
  });
});

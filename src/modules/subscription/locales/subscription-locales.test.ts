/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { subscriptionEnUS } from "./en-US";
import { subscriptionZhCN } from "./zh-CN";

describe("subscription permission terminology", () => {
  it("uses Column Masking in the object-rule capability matrix", () => {
    expect(subscriptionZhCN.subscription.capabilities.perm_object_level.bullets.b3).toBe("列掩码");
    expect(subscriptionEnUS.subscription.capabilities.perm_object_level.bullets.b3).toBe(
      "Column Masking",
    );
  });
});

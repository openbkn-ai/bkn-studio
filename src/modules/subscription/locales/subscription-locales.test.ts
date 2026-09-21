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
  it("lists row filtering and property access control under enterprise object rules", () => {
    expect(subscriptionZhCN.subscription.capabilities.perm_object_level.bullets).toEqual({
      b1: "行过滤",
      b2: "属性访问控制",
    });
    expect(subscriptionEnUS.subscription.capabilities.perm_object_level.bullets).toEqual({
      b1: "Row filtering",
      b2: "Property access control",
    });
  });
});

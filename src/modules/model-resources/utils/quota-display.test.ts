/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { formatForecastAmount } from "./quota-display";

describe("quota display helpers", () => {
  it("uses token quantity units when calculating forecast amount", () => {
    expect(formatForecastAmount(100, 0.01, 1, "thousand", "\uffe5")).toBe("\uffe51.00");
    expect(formatForecastAmount(2, 0.01, 3, "million", "\uffe5")).toBe("\uffe52.00");
  });
});

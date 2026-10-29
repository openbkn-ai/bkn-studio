/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { compactCount, compactTotal } from "./compact-count";

describe("compactCount", () => {
  it("writes thousands as k and millions as M, without a trailing .0", () => {
    expect(compactCount(999)).toBe("999");
    expect(compactCount(10_000)).toBe("10k");
    expect(compactCount(81_200)).toBe("81.2k");
    expect(compactCount(21_277)).toBe("21.3k");
    expect(compactCount(16_029)).toBe("16k");
    expect(compactCount(999_960)).toBe("1M");
    expect(compactCount(1_250_000)).toBe("1.3M");
  });
});

describe("compactTotal", () => {
  it("is exact when every count was read", () => {
    expect(compactTotal([10_000, 6_029], 12_000)).toBe("16k");
  });

  it("is open when a count failed, and never below what is loaded", () => {
    // A relation type's count failed: 16,029 known, 21,277 already loaded.
    expect(compactTotal([16_029, null], 21_277)).toBe("≥21.3k");
    expect(compactTotal([16_029, null], 100)).toBe("≥16k");
  });
});

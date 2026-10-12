/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { normalizeVegaTag, validateVegaTag, validateVegaTags } from "./vega-tags";

describe("Vega tag validation", () => {
  it("uses trimmed Unicode characters for the 40-character boundary", () => {
    expect(validateVegaTag(`  ${"😀".repeat(40)}  `)).toBeNull();
    expect(validateVegaTag("😀".repeat(41))).toBe("length");
    expect(normalizeVegaTag("  orders  ")).toBe("orders");
  });

  it("rejects empty and forbidden content while allowing five tags", () => {
    expect(validateVegaTag("   ")).toBe("empty");
    expect(validateVegaTag("bad/tag")).toBe("characters");
    expect(validateVegaTag("bad，tag")).toBeNull();
    expect(validateVegaTags(["a", "b", "c", "d", "e"])).toBeNull();
    expect(validateVegaTags(["a", "b", "c", "d", "e", "f"])).toBe("count");
  });
});

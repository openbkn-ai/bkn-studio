/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { formatCatalogTime } from "@/modules/data-connect/utils/format-catalog-time";

describe("formatCatalogTime", () => {
  it("uses the fixed catalog display format regardless of locale", () => {
    const timestamp = new Date(2026, 5, 3, 11, 42, 20).getTime();

    const english = formatCatalogTime(timestamp);
    const chinese = formatCatalogTime(timestamp);

    expect(english).toBe("2026-06-03 11:42:20");
    expect(chinese).toBe(english);
  });

  it("keeps the empty display value stable", () => {
    expect(formatCatalogTime(null)).toBe("-");
    expect(formatCatalogTime(0)).toBe("-");
  });
});

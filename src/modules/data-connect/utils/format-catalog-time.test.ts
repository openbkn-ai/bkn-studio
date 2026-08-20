/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { formatCatalogTime } from "@/modules/data-connect/utils/format-catalog-time";

describe("formatCatalogTime", () => {
  it("formats the same timestamp with the active locale", () => {
    const timestamp = Date.UTC(2026, 7, 19, 10, 20, 30);

    const english = formatCatalogTime(timestamp, "en-US");
    const chinese = formatCatalogTime(timestamp, "zh-CN");

    expect(english).not.toBe(chinese);
    expect(english).toContain("08");
    expect(chinese).toContain("2026");
  });

  it("keeps the empty display value stable", () => {
    expect(formatCatalogTime(null, "en-US")).toBe("-");
    expect(formatCatalogTime(0, "en-US")).toBe("-");
  });
});

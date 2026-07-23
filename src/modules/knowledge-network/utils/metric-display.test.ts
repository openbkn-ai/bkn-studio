/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  formatMetricUnitLabel,
  formatMetricUnitTypeLabel,
  resolveMetricBoundObjectTypeName,
} from "./metric-display";

describe("metric-display", () => {
  it("resolves bound object type name from object types", () => {
    expect(
      resolveMetricBoundObjectTypeName(
        { scopeRef: "ot-1", scopeType: "object_type" },
        [{ id: "ot-1", name: "订单" } as never],
      ),
    ).toBe("订单");
  });

  it("formats unit labels with fallback", () => {
    const t = (key: string, options?: { defaultValue?: string }) =>
      key.endsWith(".KB") ? "KB" : (options?.defaultValue ?? key);

    expect(formatMetricUnitLabel("KB", t)).toBe("KB");
    expect(formatMetricUnitTypeLabel("numUnit", (key) => (key.endsWith(".numUnit") ? "数值单位" : key))).toBe(
      "数值单位",
    );
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { resolveAccountDisplayName } from "@/modules/knowledge-network/services/mappers/account-info";
import { mapMetric } from "@/modules/knowledge-network/services/mappers/metric.mapper";

describe("account-info", () => {
  it("prefers account name, then id, then fallback", () => {
    expect(resolveAccountDisplayName({ id: "user-1", name: "Admin" })).toBe("Admin");
    expect(resolveAccountDisplayName({ id: "user-1", name: "" })).toBe("user-1");
    expect(resolveAccountDisplayName("user-2")).toBe("user-2");
    expect(resolveAccountDisplayName(undefined)).toBe("--");
  });
});

describe("metric.mapper updater", () => {
  it("falls back to creator when updater is empty", () => {
    const record = mapMetric({
      calculation_formula: {
        aggregation: { aggr: "count", property: "qty" },
      },
      creator: { id: "creator-1", name: "Creator" },
      id: "metric-1",
      name: "Metric",
      updater: { id: "updater-1", name: "" },
    });

    expect(record.updaterName).toBe("updater-1");
  });

  it("uses updater_name when updater object is missing", () => {
    const record = mapMetric({
      calculation_formula: {
        aggregation: { aggr: "count", property: "qty" },
      },
      id: "metric-1",
      name: "Metric",
      updater_name: "Supply Chain Admin",
    });

    expect(record.updaterName).toBe("Supply Chain Admin");
  });
});

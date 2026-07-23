/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  getAvailableAggrOptionsForPropertyType,
  isMetricNumericPropertyType,
  isMetricTimePropertyType,
  METRIC_ALL_AGGR_OPTIONS,
  METRIC_COUNT_ONLY_AGGR_OPTIONS,
  METRIC_TIME_AGGR_OPTIONS,
} from "./metric-aggregation";

describe("metric-aggregation", () => {
  it("does not treat string as numeric", () => {
    expect(isMetricNumericPropertyType("string")).toBe(false);
    expect(getAvailableAggrOptionsForPropertyType("string")).toEqual(
      METRIC_COUNT_ONLY_AGGR_OPTIONS,
    );
  });

  it("does not treat timestamp as numeric", () => {
    expect(isMetricNumericPropertyType("timestamp")).toBe(false);
    expect(isMetricTimePropertyType("timestamp")).toBe(true);
    expect(getAvailableAggrOptionsForPropertyType("timestamp")).toEqual(METRIC_TIME_AGGR_OPTIONS);
  });

  it("supports numeric BKN types with full aggregation set", () => {
    for (const type of ["integer", "unsigned integer", "float", "decimal"]) {
      expect(getAvailableAggrOptionsForPropertyType(type)).toEqual(METRIC_ALL_AGGR_OPTIONS);
    }
  });

  it("supports temporal types with max/min/count options", () => {
    for (const type of ["date", "datetime", "time"]) {
      expect(getAvailableAggrOptionsForPropertyType(type)).toEqual(METRIC_TIME_AGGR_OPTIONS);
    }
  });

  it("limits boolean and text types to count aggregations", () => {
    for (const type of ["boolean", "text", "json", "vector", "ip"]) {
      expect(getAvailableAggrOptionsForPropertyType(type)).toEqual(
        METRIC_COUNT_ONLY_AGGR_OPTIONS,
      );
    }
  });
});

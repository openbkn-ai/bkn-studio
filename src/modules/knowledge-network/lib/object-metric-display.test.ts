/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  objectMetricAggregationDisplayName,
  objectMetricPropertyDisplayLabels,
  objectMetricPropertyDisplayName,
} from "./object-metric-display";

const objectType = {
  id: "order",
  dataProperties: [
    { name: "status", displayName: "订单状态" },
    { name: "raw_field", displayName: "" },
  ],
  logicProperties: [{ name: "paid_amount", displayName: "实付金额" }],
};

describe("object metric property display", () => {
  it("uses one business label mapping for aggregation names across metric views", () => {
    expect(objectMetricAggregationDisplayName("count_rows")).toBe("计数");
    expect(objectMetricAggregationDisplayName("count")).toBe("非空计数");
    expect(objectMetricAggregationDisplayName("avg")).toBe("平均值");
  });

  it("uses business names for owner properties, including logical properties", () => {
    expect(
      objectMetricPropertyDisplayName(
        { object_type_id: "order", property_name: "status" },
        objectType,
      ),
    ).toBe("订单状态");
    expect(
      objectMetricPropertyDisplayName(
        { object_type_id: "order", property_name: "paid_amount" },
        objectType,
      ),
    ).toBe("实付金额");
    expect(objectMetricPropertyDisplayLabels(objectType)).toEqual({
      status: "订单状态",
      raw_field: "raw_field",
      paid_amount: "实付金额",
    });
  });

  it("keeps technical names when metadata is missing or refers to another object type", () => {
    expect(
      objectMetricPropertyDisplayName(
        { object_type_id: "coupon", property_name: "status" },
        objectType,
      ),
    ).toBe("status");
    expect(
      objectMetricPropertyDisplayName(
        { object_type_id: "order", property_name: "unknown_field" },
        objectType,
      ),
    ).toBe("unknown_field");
  });

  it("does not apply an owner label to a related object's dimension with the same property name", () => {
    expect(
      objectMetricPropertyDisplayLabels(objectType, [
        { object_type_id: "coupon", property_name: "status" },
      ]),
    ).toEqual({ raw_field: "raw_field", paid_amount: "实付金额" });
    expect(
      objectMetricPropertyDisplayLabels(objectType, [
        { object_type_id: "order", property_name: "status" },
      ]).status,
    ).toBe("订单状态");
  });
});

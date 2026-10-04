/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { objectMetricQueryCapabilities } from "./object-metric-query-capabilities";

describe("objectMetricQueryCapabilities", () => {
  it("preserves query and time properties for instance-level metrics", () => {
    expect(objectMetricQueryCapabilities("order", ["order_status"], ["payment_time"])).toEqual({
      analysis_dimensions: [{ object_type_id: "order", property_name: "order_status" }],
      time_dimensions: [{ object_type_id: "order", property_name: "payment_time" }],
    });
  });

  it("preserves the selected dimension order and owner object", () => {
    expect(
      objectMetricQueryCapabilities(
        "sales_order",
        ["region", "channel", "status"],
        ["payment_time", "complete_time"],
      ),
    ).toEqual({
      analysis_dimensions: [
        { object_type_id: "sales_order", property_name: "region" },
        { object_type_id: "sales_order", property_name: "channel" },
        { object_type_id: "sales_order", property_name: "status" },
      ],
      time_dimensions: [
        { object_type_id: "sales_order", property_name: "payment_time" },
        { object_type_id: "sales_order", property_name: "complete_time" },
      ],
    });
  });

  it("emits explicit empty capability arrays", () => {
    expect(objectMetricQueryCapabilities("order")).toEqual({
      analysis_dimensions: [],
      time_dimensions: [],
    });
  });
});

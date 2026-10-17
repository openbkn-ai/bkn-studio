/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { objectMetricBusinessConditionLabel } from "./object-metric-condition-label";

const currentFilter = {
  comparison_operator: "eq" as const,
  left: {
    property_ref: { object_type_id: "order", property_name: "status" },
    source: "property" as const,
  },
  node_type: "predicate" as const,
  right: [{ source: "literal" as const, value: "completed", value_type: "string" }],
};

const relatedFilter = {
  comparison_operator: "eq" as const,
  left: {
    property_ref: { object_type_id: "channel", property_name: "channel_type" },
    source: "property" as const,
  },
  node_type: "predicate" as const,
  right: [{ source: "literal" as const, value: "offline", value_type: "string" }],
};

describe("objectMetricBusinessConditionLabel", () => {
  it("shows a related-instance condition instead of reporting it as unrestricted", () => {
    expect(
      objectMetricBusinessConditionLabel({
        relation_path: {
          alias: "channel",
          cardinality_policy: "distinct_root",
          purpose: "qualify_root",
          related_filters: relatedFilter,
          steps: [],
        },
      }),
    ).toBe("关联实例：channel_type 等于 “offline”");
  });

  it("distinguishes current and related conditions when both are configured", () => {
    expect(
      objectMetricBusinessConditionLabel({
        filters: currentFilter,
        relation_path: {
          alias: "channel",
          cardinality_policy: "distinct_root",
          purpose: "qualify_root",
          related_filters: relatedFilter,
          steps: [],
        },
      }),
    ).toBe("当前实例：status 等于 “completed”；关联实例：channel_type 等于 “offline”");
  });

  it("uses available business property names without changing stored conditions", () => {
    const qualifiers = { filters: currentFilter };
    expect(
      objectMetricBusinessConditionLabel(qualifiers, (reference) =>
        reference.property_name === "status" ? "订单状态" : reference.property_name,
      ),
    ).toBe("当前实例：订单状态 等于 “completed”");
    expect(objectMetricBusinessConditionLabel(qualifiers)).toBe(
      "当前实例：status 等于 “completed”",
    );
  });

  it("reports an unrestricted definition only when neither condition exists", () => {
    expect(objectMetricBusinessConditionLabel({})).toBe("未限定");
  });
});

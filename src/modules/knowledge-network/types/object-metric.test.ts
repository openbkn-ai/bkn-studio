/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  inferObjectMetricOutputShapeV1,
  type ObjectMetricDefinitionV1,
} from "@/modules/knowledge-network/types/object-metric";

function definition(
  groupByDimensions: ObjectMetricDefinitionV1["result_semantics"]["statistical_grain"]["group_by_dimensions"] = [],
  timeGranularity?: ObjectMetricDefinitionV1["result_semantics"]["statistical_grain"]["time_granularity"],
): Pick<ObjectMetricDefinitionV1, "result_semantics"> {
  return {
    result_semantics: {
      statistical_grain: {
        group_by_dimensions: groupByDimensions,
        time_granularity: timeGranularity,
      },
      value: { physical_type: "int64", semantic_type: "count" },
      no_data_policy: "zero",
      partial_data_policy: "reject",
    },
  };
}

describe("inferObjectMetricOutputShapeV1", () => {
  it("derives a summary without fixed grain", () => {
    expect(inferObjectMetricOutputShapeV1(definition())).toBe("summary");
  });

  it("derives grouped output from fixed group-by dimensions", () => {
    expect(
      inferObjectMetricOutputShapeV1(
        definition([{ object_type_id: "order", property_name: "region" }]),
      ),
    ).toBe("grouped");
  });

  it("gives time series precedence when a time granularity exists", () => {
    expect(
      inferObjectMetricOutputShapeV1(
        definition([{ object_type_id: "order", property_name: "region" }], "day"),
      ),
    ).toBe("time_series");
  });
});

/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { normalizeMetricDataResponse } from "@/modules/knowledge-network/services/metric.service";

describe("normalizeMetricDataResponse", () => {
  it("expands multi-series trend rows with prefixed dimension columns", () => {
    const result = normalizeMetricDataResponse(
      {
        datas: [
          {
            labels: { warehouse_id: "WH001", item_code: "PART-1" },
            time_strs: ["2024-01-01"],
            values: [120],
          },
          {
            labels: { warehouse_id: "WH002", item_code: "PART-2" },
            time_strs: ["2024-01-01"],
            values: [98],
          },
        ],
      },
      "trend",
    );

    expect(result.columns.map((column) => column.key)).toEqual([
      "dim_warehouse_id",
      "dim_item_code",
      "timestamp",
      "value",
    ]);
    expect(result.rows[0]).toMatchObject({
      dim_item_code: "PART-1",
      dim_warehouse_id: "WH001",
      value: 120,
    });
    expect(result.rows[1]).toMatchObject({
      dim_item_code: "PART-2",
      dim_warehouse_id: "WH002",
      value: 98,
    });
    expect(result.visualHint).toBe("trend-bars");
  });

  it("keeps reserved metric fields when a dimension property collides with value", () => {
    const result = normalizeMetricDataResponse(
      {
        datas: [
          {
            labels: { value: "WH001", warehouse_id: "WH001" },
            values: [42],
          },
        ],
      },
      "instant",
    );

    expect(result.rows[0]).toMatchObject({
      dim_value: "WH001",
      dim_warehouse_id: "WH001",
      value: 42,
    });
  });
});

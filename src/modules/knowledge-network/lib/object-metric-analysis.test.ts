/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { recommendObjectMetricAnalysisView } from "./object-metric-analysis";

describe("recommendObjectMetricAnalysisView", () => {
  it("uses a metric card for a scalar result", () => {
    expect(recommendObjectMetricAnalysisView([{ status: "ok", value: 1284 }])).toBe("summary");
  });

  it("uses a bar chart for one-dimensional result rows", () => {
    expect(
      recommendObjectMetricAnalysisView([
        { dimensions: { region: "华东" }, status: "ok", value: 12 },
        { dimensions: { region: "华南" }, status: "ok", value: 8 },
      ]),
    ).toBe("bar");
  });

  it("prefers a line chart whenever result rows have a time key", () => {
    expect(
      recommendObjectMetricAnalysisView([
        { status: "ok", time: 1_725_000_000_000, value: 12 },
        { status: "ok", time: 1_725_086_400_000, value: 8 },
      ]),
    ).toBe("line");
  });

  it("defaults to a table when a time result would require too many series", () => {
    expect(
      recommendObjectMetricAnalysisView(
        Array.from({ length: 7 }, (_, index) => ({
          dimensions: { region: `region-${index}` },
          status: "ok" as const,
          time: 1_725_000_000_000,
          value: index + 1,
        })),
      ),
    ).toBe("table");
  });

  it("uses a heatmap for a two-dimensional non-time result", () => {
    expect(
      recommendObjectMetricAnalysisView([
        { dimensions: { channel: "App", region: "华东" }, status: "ok", value: 12 },
        { dimensions: { channel: "Web", region: "华南" }, status: "ok", value: 8 },
      ]),
    ).toBe("heatmap");
  });

  it("uses a table for a one-column matrix of order identities", () => {
    expect(
      recommendObjectMetricAnalysisView([
        { dimensions: { status: "执行中", order_id: "U00-000170" }, status: "ok", value: 1 },
        { dimensions: { status: "执行中", order_id: "590-000075" }, status: "ok", value: 2 },
      ]),
    ).toBe("table");
  });

  it("counts full dimension references when legacy dimensions are absent", () => {
    expect(
      recommendObjectMetricAnalysisView([
        {
          dimension_cells: [
            { ref: { object_type_id: "order", property_name: "status" }, value: "已确认" },
            { ref: { object_type_id: "order", property_name: "region" }, value: "华东" },
          ],
          status: "ok",
          value: 12,
        },
      ]),
    ).toBe("table");
  });
});

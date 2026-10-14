/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import type { EChartsOption } from "echarts";
import { describe, expect, it, vi } from "vitest";

import { ThemeContext } from "@/app/theme/theme-context";
import type { ObjectMetricDataV1 } from "@/modules/knowledge-network/types/object-metric";

import { ObjectMetricAnalysisPanel } from "./ObjectMetricAnalysisPanel";

const mocks = vi.hoisted(() => ({ options: [] as EChartsOption[] }));

vi.mock("@/modules/model-resources/components/statistics/ChartLine", () => ({
  ChartLine: ({ option }: { option: EChartsOption }) => {
    mocks.options.push(option);
    return <div data-testid="metric-chart" />;
  },
}));

const result: ObjectMetricDataV1 = {
  entries: [
    { dimensions: { region: "East", channel: "Web" }, status: "ok", value: 12 },
    { dimensions: { region: "West", channel: "App" }, status: "ok", value: 8 },
  ],
  model: {
    metric_id: "orders",
    name: "Orders",
    output_shape: "grouped",
    owner_object_type_id: "order",
    value: { physical_type: "int64", semantic_type: "count" },
    version: 1,
  },
  overall_ms: 10,
  status: "ok",
};

function heatmapColors(): string[] | undefined {
  const visualMap = mocks.options.at(-1)?.visualMap as
    { inRange?: { color?: string[] } } | undefined;
  return visualMap?.inRange?.color;
}

describe("ObjectMetricAnalysisPanel", () => {
  it("uses a visible heatmap palette when switching between light and dark themes", () => {
    const { rerender } = render(
      <ThemeContext.Provider value="light">
        <ObjectMetricAnalysisPanel result={result} />
      </ThemeContext.Provider>,
    );

    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();
    expect(heatmapColors()?.[0]).toBe("#172554");

    rerender(
      <ThemeContext.Provider value="dark">
        <ObjectMetricAnalysisPanel result={result} />
      </ThemeContext.Provider>,
    );

    expect(heatmapColors()?.[0]).toBe("#3b82f6");
  });
});

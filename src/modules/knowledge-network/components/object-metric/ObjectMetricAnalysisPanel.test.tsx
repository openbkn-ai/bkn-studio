/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
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
  it("shows business result shape without a redundant manual-selection badge", () => {
    render(<ObjectMetricAnalysisPanel result={result} />);

    expect(screen.getByText("分组结果")).toBeInTheDocument();
    fireEvent.click(screen.getByText("饼图"));
    expect(screen.queryByText("手动选择")).not.toBeInTheDocument();
    expect(screen.queryByText("grouped")).not.toBeInTheDocument();
  });

  it("keeps a single summary value on a metric card or table instead of a pie chart", () => {
    const summaryResult: ObjectMetricDataV1 = {
      ...result,
      entries: [{ status: "ok", value: 42 }],
      model: { ...result.model, output_shape: "summary" },
    };
    const { rerender } = render(<ObjectMetricAnalysisPanel result={result} />);
    fireEvent.click(screen.getByText("饼图"));
    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();

    rerender(<ObjectMetricAnalysisPanel result={summaryResult} />);
    expect(screen.getByText("汇总值")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("指标卡")).toBeInTheDocument();
    expect(screen.getByText("表格")).toBeInTheDocument();
    expect(screen.queryByText("饼图")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metric-chart")).not.toBeInTheDocument();
  });

  it("uses business property labels for chart axes without changing dimension values", () => {
    render(
      <ObjectMetricAnalysisPanel
        propertyLabels={{ region: "地区", channel: "渠道" }}
        result={result}
      />,
    );

    const option = mocks.options.at(-1);
    expect(option?.xAxis).toMatchObject({ name: "地区", data: ["East", "West"] });
    expect(option?.yAxis).toMatchObject({ name: "渠道", data: ["Web", "App"] });
  });

  it("uses owner identity labels for category charts even when dimension labels omit the same key", () => {
    const objectValueResult: ObjectMetricDataV1 = {
      ...result,
      entries: [
        { instance_identity: { order_no: "A" }, status: "ok", value: 12 },
        { instance_identity: { order_no: "B" }, status: "ok", value: 8 },
      ],
      model: { ...result.model, output_shape: "object_value" },
    };
    render(
      <ObjectMetricAnalysisPanel
        identityLabels={{ order_no: "订单号" }}
        propertyLabels={{}}
        result={objectValueResult}
      />,
    );

    fireEvent.click(screen.getByText("柱状"));
    expect(mocks.options.at(-1)?.xAxis).toMatchObject({
      data: ["订单号: A", "订单号: B"],
    });

    fireEvent.click(screen.getByText("饼图"));
    expect(mocks.options.at(-1)?.series).toMatchObject([
      { data: [{ name: "订单号: A" }, { name: "订单号: B" }] },
    ]);
  });

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

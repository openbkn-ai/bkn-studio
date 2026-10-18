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

const mocks = vi.hoisted(() => ({
  options: [] as EChartsOption[],
  onClick: undefined as
    | undefined
    | ((event: { data?: unknown; dataIndex: number; name?: string; seriesName?: string }) => void),
}));

vi.mock("@/modules/model-resources/components/statistics/ChartLine", () => ({
  ChartLine: ({
    option,
    onClick,
  }: {
    option: EChartsOption;
    onClick?: (event: {
      data?: unknown;
      dataIndex: number;
      name?: string;
      seriesName?: string;
    }) => void;
  }) => {
    mocks.options.push(option);
    mocks.onClick = onClick;
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
  it("selects the exact result bucket from a bar point", () => {
    const onSelectEntry = vi.fn();
    render(<ObjectMetricAnalysisPanel result={result} onSelectEntry={onSelectEntry} />);
    fireEvent.click(screen.getByText("柱状"));
    mocks.onClick?.({ dataIndex: 1 });
    expect(onSelectEntry).toHaveBeenCalledWith(result.entries[1]);
  });
  it("selects a unique stacked-bar bucket without guessing when cells are combined", () => {
    const onSelectEntry = vi.fn();
    render(<ObjectMetricAnalysisPanel result={result} onSelectEntry={onSelectEntry} />);
    fireEvent.click(screen.getByText("堆叠柱"));
    mocks.onClick?.({ dataIndex: 0, name: "East", seriesName: "Web" });
    expect(onSelectEntry).toHaveBeenCalledWith(result.entries[0]);
  });
  it("selects only a uniquely mapped heatmap cell", () => {
    const onSelectEntry = vi.fn();
    const { rerender } = render(
      <ObjectMetricAnalysisPanel result={result} onSelectEntry={onSelectEntry} />,
    );
    mocks.onClick?.({ data: [0, 0, 12], dataIndex: 0 });
    expect(onSelectEntry).toHaveBeenCalledWith(result.entries[0]);

    onSelectEntry.mockClear();
    rerender(
      <ObjectMetricAnalysisPanel
        result={{ ...result, entries: [result.entries[0], result.entries[0]] }}
        onSelectEntry={onSelectEntry}
      />,
    );
    mocks.onClick?.({ data: [0, 0, 24], dataIndex: 0 });
    expect(onSelectEntry).not.toHaveBeenCalled();
  });

  it("uses exact timestamps to select cross-year trend points", () => {
    const onSelectEntry = vi.fn();
    const trendEntries = [
      { status: "ok" as const, time: Date.parse("2025-01-01T00:00:00Z"), value: 1 },
      { status: "ok" as const, time: Date.parse("2026-01-01T00:00:00Z"), value: 2 },
    ];
    render(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: trendEntries,
          model: { ...result.model, output_shape: "time_series" },
        }}
        onSelectEntry={onSelectEntry}
      />,
    );
    mocks.onClick?.({ dataIndex: 1, name: "01/01 00:00", seriesName: "指标值" });
    expect(onSelectEntry).toHaveBeenCalledWith(trendEntries[1]);
  });

  it("shows exact string values on summary cards and warns about approximate charts", () => {
    const preciseResult = {
      ...result,
      entries: [{ status: "ok" as const, value: "9007199254740993" }],
      model: { ...result.model, output_shape: "summary" as const },
    };
    const { rerender } = render(<ObjectMetricAnalysisPanel result={preciseResult} />);
    expect(screen.getByText("9007199254740993")).toBeInTheDocument();
    expect(screen.getByText("图形按近似数值绘制；精确值请查看下方结果表格。")).toBeInTheDocument();

    rerender(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [{ dimensions: { region: "East" }, status: "ok", value: "9007199254740993" }],
        }}
      />,
    );
    expect(screen.getByText("图形按近似数值绘制；精确值请查看下方结果表格。")).toBeInTheDocument();
  });
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

  it("keeps a single group chartable when only the full dimension reference is present", () => {
    render(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [
            {
              dimension_cells: [
                { ref: { object_type_id: "order", property_name: "region" }, value: "East" },
              ],
              status: "ok",
              value: 12,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("饼图")).toBeInTheDocument();
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

  it("aggregates duplicate stacked-bar cells without changing their totals", () => {
    const groupedResult: ObjectMetricDataV1 = {
      ...result,
      entries: [
        { dimensions: { region: "East", channel: "Web" }, status: "ok", value: 12 },
        { dimensions: { region: "East", channel: "Web" }, status: "ok", value: 3 },
        { dimensions: { region: "East", channel: "App" }, status: "ok", value: 5 },
        { dimensions: { region: "West", channel: "Web" }, status: "ok", value: 8 },
      ],
    };
    render(<ObjectMetricAnalysisPanel result={groupedResult} />);

    fireEvent.click(screen.getByText("堆叠柱"));
    expect(mocks.options.at(-1)?.xAxis).toMatchObject({ data: ["East", "West"] });
    expect(mocks.options.at(-1)?.series).toMatchObject([
      { data: [15, 8], name: "Web" },
      { data: [5, 0], name: "App" },
    ]);
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

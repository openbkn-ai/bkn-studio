/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
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

function chooseChart(label: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "图形类型" }));
  fireEvent.click(screen.getByText(label));
}

describe("ObjectMetricAnalysisPanel", () => {
  it("keeps selected-bucket actions inside the analysis panel above the chart", () => {
    render(
      <ObjectMetricAnalysisPanel
        result={result}
        selectionControls={<button type="button">按此值筛选</button>}
      />,
    );
    const panel = screen.getByRole("region", { name: "图表与数据" });
    const action = within(panel).getByRole("button", { name: "按此值筛选" });
    const chart = within(panel).getByTestId("metric-chart");
    expect(action.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("selects the exact result bucket from a bar point", () => {
    const onSelectEntry = vi.fn();
    render(<ObjectMetricAnalysisPanel result={result} onSelectEntry={onSelectEntry} />);
    chooseChart("柱状");
    mocks.onClick?.({ dataIndex: 1 });
    expect(onSelectEntry).toHaveBeenCalledWith(result.entries[1]);
  });
  it("selects a unique stacked-bar bucket without guessing when cells are combined", () => {
    const onSelectEntry = vi.fn();
    render(<ObjectMetricAnalysisPanel result={result} onSelectEntry={onSelectEntry} />);
    chooseChart("堆叠柱");
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
    fireEvent.click(screen.getByText("图表"));
    chooseChart("热力图");
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
    expect(screen.getByText("图形按近似数值绘制；精确值请切换到数据表查看。")).toBeInTheDocument();

    rerender(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [{ dimensions: { region: "East" }, status: "ok", value: "9007199254740993" }],
        }}
      />,
    );
    expect(screen.getByText("图形按近似数值绘制；精确值请切换到数据表查看。")).toBeInTheDocument();
  });

  it("uses the valid source entry for a summary when an earlier entry has no data", () => {
    render(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [
            { status: "no_data", value: null },
            { status: "ok", value: "9007199254740993" },
          ],
          model: { ...result.model, output_shape: "summary" },
        }}
      />,
    );
    fireEvent.click(screen.getByText("图表"));
    expect(screen.getByText("9007199254740993")).toBeInTheDocument();
  });

  it("selects a summary bucket from its metric card", () => {
    const onSelectEntry = vi.fn();
    const entry = { bucket_key: "all-orders", status: "ok" as const, value: 42 };
    render(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [entry],
          model: { ...result.model, output_shape: "summary" },
        }}
        onSelectEntry={onSelectEntry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择指标结果查看分析操作" }));
    expect(onSelectEntry).toHaveBeenCalledWith(entry);
  });

  it("uses the business unit name on a summary card", () => {
    render(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [{ status: "ok", value: 42 }],
          model: {
            ...result.model,
            output_shape: "summary",
            value: {
              ...result.model.value,
              unit: {
                code: "transaction",
                quantity_kind: "count",
                scale_factor: 1,
                system: "registered",
              },
            },
          },
        }}
      />,
    );

    expect(screen.getByText("交易笔")).toHaveAttribute("title", "transaction");
    expect(screen.queryByText("transaction")).not.toBeInTheDocument();
  });

  it("defaults to a chart for small numeric groups and keeps the exact table available", () => {
    const resultTable = <div data-testid="result-table">Exact result rows</div>;
    render(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [
            { dimensions: { order_id: "A" }, status: "ok", value: 1 },
            { dimensions: { order_id: "B" }, status: "ok", value: 2 },
          ],
        }}
        resultTable={resultTable}
      />,
    );

    expect(screen.getByText("自动推荐：柱状")).toBeInTheDocument();
    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();
    fireEvent.click(screen.getByText("表格"));
    expect(screen.getByTestId("result-table")).toBeInTheDocument();
    fireEvent.click(screen.getByText("图表"));
    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();
  });

  it("shows the localized automatic chart type after switching a table-recommended result to chart", () => {
    const { rerender } = render(<ObjectMetricAnalysisPanel result={result} />);
    fireEvent.click(screen.getByText("表格"));
    fireEvent.click(screen.getByText("图表"));
    rerender(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: Array.from({ length: 21 }, (_, index) => ({
            dimensions: { product_code: `product-${index}` },
            status: "ok",
            value: index + 1,
          })),
        }}
      />,
    );

    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "图形类型" }).closest(".ant-select"),
    ).toHaveTextContent("自动");
    expect(screen.queryByText("auto")).not.toBeInTheDocument();
  });

  it("defaults to a table for more than 20 categories and keeps every bucket in the optional chart", () => {
    const denseEntries = Array.from({ length: 21 }, (_, index) => ({
      dimensions: { product_code: `product-${index}` },
      status: "ok" as const,
      value: index + 1,
    }));
    const onSelectEntry = vi.fn();
    render(
      <ObjectMetricAnalysisPanel
        result={{ ...result, entries: denseEntries }}
        resultTable={<div data-testid="result-table">Exact result rows</div>}
        onSelectEntry={onSelectEntry}
      />,
    );

    expect(screen.getByText("自动推荐：表格")).toBeInTheDocument();
    expect(screen.getByTestId("result-table")).toBeInTheDocument();
    expect(screen.queryByTestId("metric-chart")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("图表"));
    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();
    expect(mocks.options.at(-1)?.xAxis).toMatchObject({
      axisLabel: { interval: "auto" },
      data: denseEntries.map((entry) => entry.dimensions.product_code),
    });
    expect(mocks.options.at(-1)?.dataZoom).toMatchObject([
      { endValue: 19, filterMode: "none", type: "inside" },
      { endValue: 19, filterMode: "none", type: "slider" },
    ]);
    expect(mocks.options.at(-1)?.series).toMatchObject([
      { data: denseEntries.map((entry) => entry.value) },
    ]);
    mocks.onClick?.({ dataIndex: 20 });
    expect(onSelectEntry).toHaveBeenCalledWith(denseEntries[20]);
  });

  it("keeps many time series in a table by default and uses a time axis for manual charts", () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({
      dimensions: { region: `region-${index}` },
      status: "ok" as const,
      time: Date.parse("2026-01-01T00:00:00Z"),
      value: index + 1,
    }));
    render(
      <ObjectMetricAnalysisPanel
        result={{ ...result, entries, model: { ...result.model, output_shape: "time_series" } }}
        resultTable={<div data-testid="result-table">Exact result rows</div>}
      />,
    );

    expect(screen.getByText("自动推荐：表格")).toBeInTheDocument();
    expect(screen.getByTestId("result-table")).toBeInTheDocument();
    fireEvent.click(screen.getByText("图表"));
    expect(mocks.options.at(-1)?.xAxis).toMatchObject({
      data: [expect.any(String)],
      type: "category",
    });
    expect(mocks.options.at(-1)?.series).toMatchObject(
      Array.from({ length: 7 }, () => ({ type: "line" })),
    );
  });

  it("keeps an explicitly chosen chart across result changes and falls back for nonnumeric data", () => {
    const denseEntries = Array.from({ length: 21 }, (_, index) => ({
      dimensions: { product_code: `product-${index}` },
      status: "ok" as const,
      value: index + 1,
    }));
    const denseResult = { ...result, entries: denseEntries };
    const resultTable = <div data-testid="result-table">Exact result rows</div>;
    const { rerender } = render(
      <ObjectMetricAnalysisPanel result={denseResult} resultTable={resultTable} />,
    );
    expect(screen.getByTestId("result-table")).toBeInTheDocument();
    expect(screen.getByText("自动推荐：表格")).toBeInTheDocument();
    fireEvent.click(screen.getByText("图表"));
    chooseChart("饼图");
    rerender(
      <ObjectMetricAnalysisPanel
        result={{ ...denseResult, entries: denseEntries.map((entry) => ({ ...entry, value: 40 })) }}
        resultTable={resultTable}
      />,
    );
    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("result-table")).not.toBeInTheDocument();
    expect(mocks.options.at(-1)?.series).toMatchObject([{ type: "pie" }]);

    rerender(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [{ dimensions: { product_code: "product-0" }, status: "ok", value: "unknown" }],
        }}
        resultTable={resultTable}
      />,
    );
    expect(screen.getByTestId("result-table")).toBeInTheDocument();
    expect(screen.getByText("当前结果不支持所选图形，已调整为可用展示方式。")).toBeInTheDocument();

    rerender(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [
            { dimensions: { product_code: "product-0" }, status: "ok", value: 40 },
            { dimensions: { product_code: "product-1" }, status: "no_data", value: null },
          ],
        }}
        resultTable={resultTable}
      />,
    );
    expect(screen.getByTestId("result-table")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "图表" })).toBeDisabled();
  });

  it("keeps an explicitly chosen table when the next result recommends a chart", () => {
    const resultTable = <div data-testid="result-table">Exact result rows</div>;
    const { rerender } = render(
      <ObjectMetricAnalysisPanel result={result} resultTable={resultTable} />,
    );
    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();

    fireEvent.click(screen.getByText("表格"));
    rerender(
      <ObjectMetricAnalysisPanel
        result={{ ...result, entries: result.entries.map((entry) => ({ ...entry, value: 30 })) }}
        resultTable={resultTable}
      />,
    );
    expect(screen.getByTestId("result-table")).toBeInTheDocument();
    expect(screen.queryByTestId("metric-chart")).not.toBeInTheDocument();
  });

  it("keeps non-numeric and unavailable rows in the table instead of an empty chart", () => {
    render(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [
            { dimensions: { region: "East" }, status: "ok", value: "正常" },
            { dimensions: { region: "West" }, status: "no_data", value: null },
          ],
        }}
        resultTable={<div data-testid="result-table">Exact result rows</div>}
      />,
    );

    expect(screen.getByTestId("result-table")).toBeInTheDocument();
    expect(screen.queryByTestId("metric-chart")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "图表" })).toBeDisabled();
  });
  it("shows business result shape without a redundant manual-selection badge", () => {
    render(<ObjectMetricAnalysisPanel result={result} />);

    expect(screen.getByText("分组结果")).toBeInTheDocument();
    chooseChart("饼图");
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
    chooseChart("饼图");
    expect(screen.getByTestId("metric-chart")).toBeInTheDocument();

    rerender(<ObjectMetricAnalysisPanel result={summaryResult} />);
    expect(screen.getByText("汇总值")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("自动推荐：指标卡")).toBeInTheDocument();
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
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "图形类型" }));
    expect(screen.getByText("饼图")).toBeInTheDocument();
  });

  it("keeps same-named dimensions from different relation aliases distinct in charts", () => {
    render(
      <ObjectMetricAnalysisPanel
        result={{
          ...result,
          entries: [
            {
              dimension_cells: [
                {
                  ref: {
                    object_type_id: "person",
                    relation_path_alias: "buyer",
                    property_name: "region",
                  },
                  value: "East",
                },
                {
                  ref: {
                    object_type_id: "person",
                    relation_path_alias: "seller",
                    property_name: "region",
                  },
                  value: "West",
                },
              ],
              dimensions: { "person.region": "West" },
              status: "ok",
              value: 1,
            },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByText("图表"));
    expect(mocks.options.at(-1)?.xAxis).toMatchObject({
      data: ["region (buyer): East · region (seller): West"],
    });
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

    chooseChart("堆叠柱");
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

    chooseChart("柱状");
    expect(mocks.options.at(-1)?.xAxis).toMatchObject({
      data: ["订单号: A", "订单号: B"],
    });

    chooseChart("饼图");
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
    expect(mocks.options.at(-1)?.visualMap).toMatchObject({ min: 8, max: 12 });

    rerender(
      <ThemeContext.Provider value="dark">
        <ObjectMetricAnalysisPanel result={result} />
      </ThemeContext.Provider>,
    );

    expect(heatmapColors()?.[0]).toBe("#3b82f6");
  });
});

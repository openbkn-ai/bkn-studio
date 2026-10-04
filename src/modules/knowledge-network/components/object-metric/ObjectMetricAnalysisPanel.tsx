/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { EChartsOption } from "echarts";
import { Empty, Segmented, Space, Tag, Tooltip } from "antd";
import { useMemo, useState } from "react";

import { ChartLine } from "@/modules/model-resources/components/statistics/ChartLine";
import { recommendObjectMetricAnalysisView } from "@/modules/knowledge-network/lib/object-metric-analysis";
import type {
  ObjectMetricDataEntryV1,
  ObjectMetricDataV1,
} from "@/modules/knowledge-network/types/object-metric";

import styles from "./ObjectMetricAnalysisPanel.module.css";

type ObjectMetricAnalysisView =
  | "auto"
  | "summary"
  | "bar"
  | "stacked_bar"
  | "line"
  | "area"
  | "pie"
  | "heatmap"
  | "combo"
  | "table";

type NumericEntry = ObjectMetricDataEntryV1 & { value: number };

const viewOptions: Array<{ label: string; value: ObjectMetricAnalysisView }> = [
  { label: "自动", value: "auto" },
  { label: "指标卡", value: "summary" },
  { label: "柱状", value: "bar" },
  { label: "堆叠柱", value: "stacked_bar" },
  { label: "折线", value: "line" },
  { label: "面积", value: "area" },
  { label: "饼图", value: "pie" },
  { label: "热力图", value: "heatmap" },
  { label: "柱线组合", value: "combo" },
  { label: "表格", value: "table" },
];

const palette = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#f97316", "#ec4899"];

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const result = Number(value);
    return Number.isFinite(result) ? result : undefined;
  }
  return undefined;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function dimensionEntries(entry: ObjectMetricDataEntryV1): Array<[string, unknown]> {
  return Object.entries(entry.dimensions ?? {});
}

function categoryLabel(entry: ObjectMetricDataEntryV1): string {
  const dimensions = dimensionEntries(entry);
  if (dimensions.length === 1) return String(dimensions[0]?.[1]);
  if (dimensions.length)
    return dimensions.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
  if (entry.instance_identity)
    return Object.entries(entry.instance_identity)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ");
  return "汇总";
}

function seriesLabel(entry: ObjectMetricDataEntryV1): string {
  const dimensions = dimensionEntries(entry);
  return dimensions.length ? dimensions.map(([, value]) => String(value)).join(" · ") : "指标值";
}

function hasTime(entries: NumericEntry[]) {
  return entries.some((entry) => entry.time !== undefined);
}

function buildCategoryOption(entries: NumericEntry[]): EChartsOption {
  const categories = entries.map(categoryLabel);
  return {
    color: palette,
    grid: { containLabel: true, left: 14, right: 20, bottom: 44, top: 22 },
    tooltip: { trigger: "axis" },
    xAxis: {
      axisLabel: { interval: 0, rotate: categories.length > 5 ? 22 : 0 },
      data: categories,
      type: "category",
    },
    yAxis: { scale: true, type: "value" },
    series: [
      {
        barMaxWidth: 42,
        data: entries.map((entry) => entry.value),
        name: "指标值",
        type: "bar",
      },
    ],
  };
}

function buildStackedBarOption(entries: NumericEntry[]): EChartsOption | undefined {
  if (hasTime(entries)) {
    const sorted = [...entries].sort((left, right) => (left.time ?? 0) - (right.time ?? 0));
    const times = Array.from(new Set(sorted.map((entry) => entry.time ?? 0)));
    const names = Array.from(new Set(sorted.map(seriesLabel)));
    return {
      color: palette,
      grid: { containLabel: true, left: 14, right: 20, bottom: 48, top: 22 },
      legend: { bottom: 0, type: "scroll" },
      tooltip: { trigger: "axis" },
      xAxis: { data: times.map(formatTime), type: "category" },
      yAxis: { scale: true, type: "value" },
      series: names.map((name) => {
        const values = new Map(
          sorted
            .filter((entry) => seriesLabel(entry) === name)
            .map((entry) => [entry.time ?? 0, entry.value]),
        );
        return {
          barMaxWidth: 42,
          data: times.map((time) => values.get(time) ?? 0),
          name,
          stack: "total",
          type: "bar" as const,
        };
      }),
    };
  }

  const first = entries.find((entry) => dimensionEntries(entry).length >= 2);
  if (!first) return undefined;
  const dimensionKeys = dimensionEntries(first)
    .slice(0, 2)
    .map(([key]) => key);
  if (dimensionKeys.length < 2) return undefined;

  const [categoryKey, seriesKey] = dimensionKeys;
  const categories = Array.from(
    new Set(entries.map((entry) => String(entry.dimensions?.[categoryKey] ?? "—"))),
  );
  const names = Array.from(
    new Set(entries.map((entry) => String(entry.dimensions?.[seriesKey] ?? "—"))),
  );
  return {
    color: palette,
    grid: { containLabel: true, left: 14, right: 20, bottom: 48, top: 22 },
    legend: { bottom: 0, type: "scroll" },
    tooltip: { trigger: "axis" },
    xAxis: { data: categories, name: categoryKey, type: "category" },
    yAxis: { scale: true, type: "value" },
    series: names.map((name) => ({
      barMaxWidth: 42,
      data: categories.map((category) =>
        entries
          .filter(
            (entry) =>
              String(entry.dimensions?.[categoryKey] ?? "—") === category &&
              String(entry.dimensions?.[seriesKey] ?? "—") === name,
          )
          .reduce((total, entry) => total + entry.value, 0),
      ),
      name,
      stack: "total",
      type: "bar" as const,
    })),
  };
}

function buildPieOption(entries: NumericEntry[]): EChartsOption {
  return {
    color: palette,
    legend: { bottom: 0, type: "scroll" },
    tooltip: { formatter: "{b}<br/>{c}（{d}%）", trigger: "item" },
    series: [
      {
        data: entries.map((entry) => ({ name: categoryLabel(entry), value: entry.value })),
        label: { formatter: "{b}\n{d}%" },
        radius: ["38%", "70%"],
        type: "pie",
      },
    ],
  };
}

function buildTimeSeriesOption(entries: NumericEntry[], area: boolean): EChartsOption {
  const sorted = [...entries].sort((left, right) => (left.time ?? 0) - (right.time ?? 0));
  const times = Array.from(new Set(sorted.map((entry) => entry.time ?? 0)));
  const labels = times.map(formatTime);
  const names = Array.from(new Set(sorted.map(seriesLabel)));

  return {
    color: palette,
    grid: { containLabel: true, left: 14, right: 20, bottom: names.length > 1 ? 48 : 30, top: 22 },
    legend: names.length > 1 ? { bottom: 0, type: "scroll" } : undefined,
    tooltip: { trigger: "axis" },
    xAxis: { boundaryGap: false, data: labels, type: "category" },
    yAxis: { scale: true, type: "value" },
    series: names.map((name) => {
      const values = new Map(
        sorted
          .filter((entry) => seriesLabel(entry) === name)
          .map((entry) => [entry.time ?? 0, entry.value]),
      );
      return {
        areaStyle: area ? { opacity: 0.18 } : undefined,
        connectNulls: false,
        data: times.map((time) => values.get(time) ?? null),
        name,
        showSymbol: times.length < 28,
        smooth: true,
        type: "line" as const,
      };
    }),
  };
}

function buildHeatmapOption(entries: NumericEntry[]): EChartsOption | undefined {
  const first = entries.find((entry) => dimensionEntries(entry).length >= 2);
  if (!first) return undefined;
  const dimensionKeys = dimensionEntries(first)
    .slice(0, 2)
    .map(([key]) => key);
  if (dimensionKeys.length < 2) return undefined;

  const [xKey, yKey] = dimensionKeys;
  const xValues = Array.from(
    new Set(entries.map((entry) => String(entry.dimensions?.[xKey] ?? "—"))),
  );
  const yValues = Array.from(
    new Set(entries.map((entry) => String(entry.dimensions?.[yKey] ?? "—"))),
  );
  const values = new Map<string, number>();
  entries.forEach((entry) => {
    const x = String(entry.dimensions?.[xKey] ?? "—");
    const y = String(entry.dimensions?.[yKey] ?? "—");
    values.set(`${x}\u0000${y}`, (values.get(`${x}\u0000${y}`) ?? 0) + entry.value);
  });
  const data = Array.from(values.entries()).map(([key, value]) => {
    const [x, y] = key.split("\u0000");
    return [xValues.indexOf(x), yValues.indexOf(y), value];
  });
  const valuesForRange = data.map((item) => Number(item[2]));
  const min = Math.min(...valuesForRange, 0);
  const max = Math.max(...valuesForRange, 1);

  return {
    grid: { containLabel: true, left: 20, right: 72, bottom: 26, top: 18 },
    tooltip: { position: "top" },
    visualMap: {
      calculable: true,
      inRange: { color: ["#172554", "#0ea5e9", "#fbbf24"] },
      max,
      min,
      orient: "vertical",
      right: 8,
      top: "center",
    },
    xAxis: { data: xValues, name: xKey, splitArea: { show: true }, type: "category" },
    yAxis: { data: yValues, name: yKey, splitArea: { show: true }, type: "category" },
    series: [
      {
        data,
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.35)" } },
        label: {
          show: true,
          formatter: ({ value }) => formatNumber(Number((value as unknown[])[2])),
        },
        type: "heatmap",
      },
    ],
  };
}

function buildComboOption(entries: NumericEntry[]): EChartsOption {
  const sorted = [...entries].sort((left, right) => (left.time ?? 0) - (right.time ?? 0));
  const totals = new Map<number, number>();
  sorted.forEach((entry) => {
    const time = entry.time ?? 0;
    totals.set(time, (totals.get(time) ?? 0) + entry.value);
  });
  const times = Array.from(totals.keys());
  let cumulative = 0;
  const totalValues = times.map((time) => totals.get(time) ?? 0);
  const cumulativeValues = totalValues.map((value) => {
    cumulative += value;
    return cumulative;
  });

  return {
    color: [palette[0], palette[2]],
    grid: { containLabel: true, left: 14, right: 20, bottom: 48, top: 22 },
    legend: { bottom: 0 },
    tooltip: { trigger: "axis" },
    xAxis: { data: times.map(formatTime), type: "category" },
    yAxis: [
      { scale: true, type: "value" },
      { scale: true, type: "value" },
    ],
    series: [
      { barMaxWidth: 38, data: totalValues, name: "指标值", type: "bar", yAxisIndex: 0 },
      {
        data: cumulativeValues,
        name: "累计指标值（当前结果计算）",
        showSymbol: false,
        smooth: true,
        type: "line",
        yAxisIndex: 1,
      },
    ],
  };
}

type ObjectMetricAnalysisPanelProps = {
  result: ObjectMetricDataV1;
};

export function ObjectMetricAnalysisPanel({ result }: ObjectMetricAnalysisPanelProps) {
  const [selectedView, setSelectedView] = useState<ObjectMetricAnalysisView>("auto");
  const entries = useMemo<NumericEntry[]>(
    () =>
      result.entries.flatMap((entry) => {
        const value = toNumber(entry.value);
        return value === undefined || entry.status !== "ok" ? [] : [{ ...entry, value }];
      }),
    [result.entries],
  );
  const resolvedView =
    selectedView === "auto" ? recommendObjectMetricAnalysisView(entries) : selectedView;
  const chartOption = useMemo<EChartsOption | undefined>(() => {
    if (!entries.length || resolvedView === "summary" || resolvedView === "table") return undefined;
    if (resolvedView === "bar") return buildCategoryOption(entries);
    if (resolvedView === "stacked_bar") return buildStackedBarOption(entries);
    if (resolvedView === "pie")
      return entries.every((entry) => entry.value >= 0) ? buildPieOption(entries) : undefined;
    if (resolvedView === "line")
      return hasTime(entries) ? buildTimeSeriesOption(entries, false) : undefined;
    if (resolvedView === "area")
      return hasTime(entries) ? buildTimeSeriesOption(entries, true) : undefined;
    if (resolvedView === "heatmap") return buildHeatmapOption(entries);
    if (resolvedView === "combo") return hasTime(entries) ? buildComboOption(entries) : undefined;
    return undefined;
  }, [entries, resolvedView]);
  const manualView = selectedView !== "auto";
  const summaryValue = entries.length === 1 ? entries[0]?.value : undefined;

  let emptyDescription: string | undefined;
  if (!entries.length) emptyDescription = "当前结果没有可视化的数值型指标值。";
  else if (resolvedView === "line" || resolvedView === "area" || resolvedView === "combo") {
    emptyDescription = "该视图需要按时间返回的指标结果。";
  } else if (resolvedView === "heatmap") {
    emptyDescription = "热力图需要至少两个分组维度。";
  } else if (resolvedView === "stacked_bar") {
    emptyDescription = "堆叠柱图需要按时间返回，或至少两个分组维度。";
  } else if (resolvedView === "pie" && entries.some((entry) => entry.value < 0)) {
    emptyDescription = "饼图不能表达包含负数的指标结果，请改用柱状图或折线图。";
  }

  return (
    <section className={styles.panel} aria-label="运行分析">
      <div className={styles.header}>
        <div>
          <h3>运行分析</h3>
          <p>图表仅改变呈现方式，不改变已发布指标的计算口径。</p>
        </div>
        <Space size={6} wrap>
          <Tag color="cyan">{result.model.output_shape}</Tag>
          <Tooltip title="自动模式会根据结果中的时间和维度推荐最合适的图表。">
            <Tag>
              {selectedView === "auto"
                ? `推荐：${viewOptions.find((item) => item.value === resolvedView)?.label}`
                : "手动选择"}
            </Tag>
          </Tooltip>
        </Space>
      </div>
      <Segmented<ObjectMetricAnalysisView>
        className={styles.viewSelector}
        onChange={(value) => setSelectedView(value)}
        options={viewOptions}
        value={selectedView}
      />
      {resolvedView === "summary" && summaryValue !== undefined ? (
        <div className={styles.summary}>
          <span>指标值</span>
          <strong>{formatNumber(summaryValue)}</strong>
          {result.model.value.unit?.display_symbol || result.model.value.unit?.code ? (
            <em>{result.model.value.unit.display_symbol ?? result.model.value.unit.code}</em>
          ) : null}
        </div>
      ) : chartOption ? (
        <div className={styles.chart}>
          <ChartLine option={chartOption} />
        </div>
      ) : resolvedView === "table" ? (
        <div className={styles.tableHint}>完整明细见下方“试算结果”。</div>
      ) : (
        <Empty
          className={styles.empty}
          description={
            emptyDescription ??
            (manualView ? "当前结果不适合此图表。" : "当前结果没有可分析的数据。")
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </section>
  );
}

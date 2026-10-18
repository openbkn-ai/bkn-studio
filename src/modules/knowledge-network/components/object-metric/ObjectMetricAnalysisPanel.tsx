/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { EChartsOption } from "echarts";
import { Empty, Segmented, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";

import { useResolvedTheme } from "@/app/theme/theme-context";
import { ChartLine } from "@/modules/model-resources/components/statistics/ChartLine";
import { recommendObjectMetricAnalysisView } from "@/modules/knowledge-network/lib/object-metric-analysis";
import type {
  ObjectMetricDataEntryV1,
  ObjectMetricDataV1,
} from "@/modules/knowledge-network/types/object-metric";

import styles from "./ObjectMetricAnalysisPanel.module.css";
import {
  objectMetricLocale,
  objectMetricText,
} from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

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
  {
    get label() {
      return objectMetricText("m7eb336e42cb5");
    },
    value: "auto",
  },
  {
    get label() {
      return objectMetricText("m3cbd54715b01");
    },
    value: "summary",
  },
  {
    get label() {
      return objectMetricText("m1e40c6b3e237");
    },
    value: "bar",
  },
  {
    get label() {
      return objectMetricText("mf5acc2cddb4a");
    },
    value: "stacked_bar",
  },
  {
    get label() {
      return objectMetricText("mf5b8cf7d59b7");
    },
    value: "line",
  },
  {
    get label() {
      return objectMetricText("m5cf70b0cf922");
    },
    value: "area",
  },
  {
    get label() {
      return objectMetricText("m86f348d65745");
    },
    value: "pie",
  },
  {
    get label() {
      return objectMetricText("mb438f5427c90");
    },
    value: "heatmap",
  },
  {
    get label() {
      return objectMetricText("m96862e2555c6");
    },
    value: "combo",
  },
  {
    get label() {
      return objectMetricText("m22d9e7c54b88");
    },
    value: "table",
  },
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
  return new Intl.NumberFormat(objectMetricLocale(), { maximumFractionDigits: 4 }).format(value);
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat(objectMetricLocale(), {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function dimensionEntries(entry: ObjectMetricDataEntryV1): Array<[string, unknown]> {
  if (entry.dimension_cells?.length)
    return entry.dimension_cells.map(({ ref, value }) => [
      JSON.stringify([ref.object_type_id, ref.relation_path_alias ?? "", ref.property_name]),
      value,
    ]);
  return Object.entries(entry.dimensions ?? {});
}

function dimensionValue(entry: ObjectMetricDataEntryV1, key: string): unknown {
  if (entry.dimension_cells?.length) {
    return entry.dimension_cells.find(
      ({ ref }) =>
        JSON.stringify([ref.object_type_id, ref.relation_path_alias ?? "", ref.property_name]) ===
        key,
    )?.value;
  }
  return entry.dimensions?.[key];
}

function dimensionDisplayName(key: string, propertyLabels: Record<string, string>): string {
  try {
    const [, alias, property] = JSON.parse(key) as [string, string, string];
    const name = propertyLabels[property] || property;
    return alias ? `${name} (${alias})` : name;
  } catch {
    return propertyLabels[key] || key;
  }
}

function dimensionValueLabel(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value) ?? "—";
}

function categoryLabel(
  entry: ObjectMetricDataEntryV1,
  propertyLabels: Record<string, string>,
  identityLabels: Record<string, string>,
): string {
  const dimensions = dimensionEntries(entry);
  if (dimensions.length === 1) return String(dimensions[0]?.[1]);
  if (dimensions.length)
    return dimensions
      .map(([key, value]) => `${dimensionDisplayName(key, propertyLabels)}: ${String(value)}`)
      .join(" · ");
  if (entry.instance_identity)
    return Object.entries(entry.instance_identity)
      .map(([key, value]) => `${identityLabels[key] || key}: ${String(value)}`)
      .join(" · ");
  return objectMetricText("mbd0a40247497");
}

function seriesLabel(entry: ObjectMetricDataEntryV1): string {
  const dimensions = dimensionEntries(entry);
  return dimensions.length
    ? dimensions.map(([, value]) => String(value)).join(" · ")
    : objectMetricText("m6018e00aca78");
}

function hasTime(entries: NumericEntry[]) {
  return entries.some((entry) => entry.time !== undefined);
}

function buildCategoryOption(
  entries: NumericEntry[],
  propertyLabels: Record<string, string>,
  identityLabels: Record<string, string>,
): EChartsOption {
  const categories = entries.map((entry) => categoryLabel(entry, propertyLabels, identityLabels));
  return {
    color: palette,
    grid: { containLabel: true, left: 14, right: 20, bottom: 44, top: 22 },
    tooltip: { trigger: "axis" },
    xAxis: {
      axisLabel: { interval: 0, rotate: categories.length > 5 ? 22 : 0 },
      data: categories,
      type: "category",
    },
    yAxis: { type: "value" },
    series: [
      {
        barMaxWidth: 42,
        data: entries.map((entry) => entry.value),
        name: objectMetricText("m6018e00aca78"),
        type: "bar",
      },
    ],
  };
}

function buildStackedBarOption(
  entries: NumericEntry[],
  propertyLabels: Record<string, string>,
): EChartsOption | undefined {
  if (hasTime(entries)) {
    const sorted = [...entries].sort((left, right) => (left.time ?? 0) - (right.time ?? 0));
    const times = Array.from(new Set(sorted.map((entry) => entry.time ?? 0)));
    const seriesValues = new Map<string, Map<number, number>>();
    sorted.forEach((entry) => {
      const name = seriesLabel(entry);
      const values = seriesValues.get(name) ?? new Map<number, number>();
      values.set(entry.time ?? 0, entry.value);
      seriesValues.set(name, values);
    });
    return {
      color: palette,
      grid: { containLabel: true, left: 14, right: 20, bottom: 48, top: 22 },
      legend: { bottom: 0, type: "scroll" },
      tooltip: { trigger: "axis" },
      xAxis: { data: times.map(formatTime), type: "category" },
      yAxis: { type: "value" },
      series: Array.from(seriesValues, ([name, values]) => {
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
    new Set(entries.map((entry) => dimensionValueLabel(dimensionValue(entry, categoryKey)))),
  );
  const names = Array.from(
    new Set(entries.map((entry) => dimensionValueLabel(dimensionValue(entry, seriesKey)))),
  );
  const categorySeriesValues = new Map<string, Map<string, number>>();
  entries.forEach((entry) => {
    const category = dimensionValueLabel(dimensionValue(entry, categoryKey));
    const name = dimensionValueLabel(dimensionValue(entry, seriesKey));
    const values = categorySeriesValues.get(name) ?? new Map<string, number>();
    values.set(category, (values.get(category) ?? 0) + entry.value);
    categorySeriesValues.set(name, values);
  });
  return {
    color: palette,
    grid: { containLabel: true, left: 14, right: 20, bottom: 48, top: 22 },
    legend: { bottom: 0, type: "scroll" },
    tooltip: { trigger: "axis" },
    xAxis: {
      data: categories,
      name: dimensionDisplayName(categoryKey, propertyLabels),
      type: "category",
    },
    yAxis: { type: "value" },
    series: names.map((name) => ({
      barMaxWidth: 42,
      data: categories.map((category) => categorySeriesValues.get(name)?.get(category) ?? 0),
      name,
      stack: "total",
      type: "bar" as const,
    })),
  };
}

function buildPieOption(
  entries: NumericEntry[],
  propertyLabels: Record<string, string>,
  identityLabels: Record<string, string>,
): EChartsOption {
  return {
    color: palette,
    legend: { bottom: 0, type: "scroll" },
    tooltip: { formatter: "{b}<br/>{c}（{d}%）", trigger: "item" },
    series: [
      {
        data: entries.map((entry) => ({
          name: categoryLabel(entry, propertyLabels, identityLabels),
          value: entry.value,
        })),
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

function buildHeatmapOption(
  entries: NumericEntry[],
  resolvedTheme: "light" | "dark",
  propertyLabels: Record<string, string>,
): EChartsOption | undefined {
  const first = entries.find((entry) => dimensionEntries(entry).length >= 2);
  if (!first) return undefined;
  const dimensionKeys = dimensionEntries(first)
    .slice(0, 2)
    .map(([key]) => key);
  if (dimensionKeys.length < 2) return undefined;

  const [xKey, yKey] = dimensionKeys;
  const xValues = Array.from(
    new Set(entries.map((entry) => dimensionValueLabel(dimensionValue(entry, xKey)))),
  );
  const yValues = Array.from(
    new Set(entries.map((entry) => dimensionValueLabel(dimensionValue(entry, yKey)))),
  );
  const values = new Map<string, number>();
  entries.forEach((entry) => {
    const x = dimensionValueLabel(dimensionValue(entry, xKey));
    const y = dimensionValueLabel(dimensionValue(entry, yKey));
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
      inRange: {
        color:
          resolvedTheme === "dark"
            ? ["#3b82f6", "#38bdf8", "#fbbf24"]
            : ["#172554", "#0ea5e9", "#fbbf24"],
      },
      max,
      min,
      orient: "vertical",
      right: 8,
      top: "center",
    },
    xAxis: {
      data: xValues,
      name: dimensionDisplayName(xKey, propertyLabels),
      splitArea: { show: true },
      type: "category",
    },
    yAxis: {
      data: yValues,
      name: dimensionDisplayName(yKey, propertyLabels),
      splitArea: { show: true },
      type: "category",
    },
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
      {
        barMaxWidth: 38,
        data: totalValues,
        name: objectMetricText("m6018e00aca78"),
        type: "bar",
        yAxisIndex: 0,
      },
      {
        data: cumulativeValues,
        name: objectMetricText("m604502c3c32a"),
        showSymbol: false,
        smooth: true,
        type: "line",
        yAxisIndex: 1,
      },
    ],
  };
}

type ObjectMetricAnalysisPanelProps = {
  identityLabels?: Record<string, string>;
  propertyLabels?: Record<string, string>;
  result: ObjectMetricDataV1;
  onSelectEntry?: (entry: ObjectMetricDataEntryV1) => void;
};

const emptyPropertyLabels: Record<string, string> = {};

export function ObjectMetricAnalysisPanel({
  identityLabels = emptyPropertyLabels,
  propertyLabels = emptyPropertyLabels,
  result,
  onSelectEntry,
}: ObjectMetricAnalysisPanelProps) {
  useTranslation();
  const resolvedTheme = useResolvedTheme();
  const [selectedView, setSelectedView] = useState<ObjectMetricAnalysisView>("auto");
  const entries = useMemo<NumericEntry[]>(
    () =>
      result.entries.flatMap((entry) => {
        const value = toNumber(entry.value);
        return value === undefined || entry.status !== "ok" ? [] : [{ ...entry, value }];
      }),
    [result.entries],
  );
  const isSingleValue =
    result.entries.length === 1 &&
    entries.length === 1 &&
    entries[0]?.time === undefined &&
    dimensionEntries(entries[0]).length === 0;
  const availableViews = isSingleValue
    ? viewOptions.filter((option) => ["auto", "summary", "table"].includes(option.value))
    : viewOptions;
  const activeView = availableViews.some((option) => option.value === selectedView)
    ? selectedView
    : "auto";
  const resolvedView =
    activeView === "auto" ? recommendObjectMetricAnalysisView(entries) : activeView;

  useEffect(() => setSelectedView("auto"), [result]);
  const chartOption = useMemo<EChartsOption | undefined>(() => {
    if (!entries.length || resolvedView === "summary" || resolvedView === "table") return undefined;
    if (resolvedView === "bar") return buildCategoryOption(entries, propertyLabels, identityLabels);
    if (resolvedView === "stacked_bar") return buildStackedBarOption(entries, propertyLabels);
    if (resolvedView === "pie")
      return entries.every((entry) => entry.value >= 0)
        ? buildPieOption(entries, propertyLabels, identityLabels)
        : undefined;
    if (resolvedView === "line")
      return hasTime(entries) ? buildTimeSeriesOption(entries, false) : undefined;
    if (resolvedView === "area")
      return hasTime(entries) ? buildTimeSeriesOption(entries, true) : undefined;
    if (resolvedView === "heatmap")
      return buildHeatmapOption(entries, resolvedTheme, propertyLabels);
    if (resolvedView === "combo") return hasTime(entries) ? buildComboOption(entries) : undefined;
    return undefined;
  }, [entries, identityLabels, propertyLabels, resolvedTheme, resolvedView]);
  const manualView = activeView !== "auto";
  const summaryValue = entries.length === 1 ? entries[0]?.value : undefined;
  const hasPrecisionSensitiveValues = result.entries.some(
    (entry) => typeof entry.value === "string" && toNumber(entry.value) !== undefined,
  );
  const selectChartPoint = (event: {
    data?: unknown;
    dataIndex?: number;
    name?: string;
    seriesName?: string;
  }) => {
    if (!onSelectEntry || event.dataIndex === undefined) return;
    if (resolvedView === "bar" || resolvedView === "pie") {
      const entry = entries[event.dataIndex];
      if (entry) onSelectEntry(entry);
      return;
    }
    if (resolvedView === "heatmap") {
      const first = entries.find((entry) => dimensionEntries(entry).length >= 2);
      const cell = Array.isArray(event.data) ? event.data : undefined;
      if (!first || !cell || cell.length < 2) return;
      const keys = dimensionEntries(first)
        .slice(0, 2)
        .map(([key]) => key);
      const xValues = Array.from(
        new Set(entries.map((entry) => dimensionValueLabel(dimensionValue(entry, keys[0])))),
      );
      const yValues = Array.from(
        new Set(entries.map((entry) => dimensionValueLabel(dimensionValue(entry, keys[1])))),
      );
      const x = xValues[Number(cell[0])];
      const y = yValues[Number(cell[1])];
      const candidates = entries.filter(
        (entry) =>
          dimensionValueLabel(dimensionValue(entry, keys[0])) === x &&
          dimensionValueLabel(dimensionValue(entry, keys[1])) === y,
      );
      if (candidates.length === 1) onSelectEntry(candidates[0]);
      return;
    }
    if (resolvedView === "stacked_bar" && !hasTime(entries)) {
      const first = entries.find((entry) => dimensionEntries(entry).length >= 2);
      if (!first) return;
      const keys = dimensionEntries(first)
        .slice(0, 2)
        .map(([key]) => key);
      const candidates = entries.filter(
        (entry) =>
          dimensionValueLabel(dimensionValue(entry, keys[0])) === event.name &&
          dimensionValueLabel(dimensionValue(entry, keys[1])) === event.seriesName,
      );
      if (candidates.length === 1) onSelectEntry(candidates[0]);
      return;
    }
    const times = Array.from(
      new Set(
        [...entries]
          .sort((left, right) => (left.time ?? 0) - (right.time ?? 0))
          .map((entry) => entry.time ?? 0),
      ),
    );
    const selectedTime = times[event.dataIndex];
    const candidates = entries.filter((entry) => {
      if (entry.time !== undefined)
        return (
          entry.time === selectedTime &&
          (resolvedView === "combo" || seriesLabel(entry) === event.seriesName)
        );
      return (
        categoryLabel(entry, propertyLabels, identityLabels) === event.name &&
        seriesLabel(entry) === event.seriesName
      );
    });
    if (candidates.length === 1) onSelectEntry(candidates[0]);
  };

  let emptyDescription: string | undefined;
  if (!entries.length) emptyDescription = objectMetricText("m5ce071e63067");
  else if (resolvedView === "line" || resolvedView === "area" || resolvedView === "combo") {
    emptyDescription = objectMetricText("mc7f799243550");
  } else if (resolvedView === "heatmap") {
    emptyDescription = objectMetricText("m222510b14c45");
  } else if (resolvedView === "stacked_bar") {
    emptyDescription = objectMetricText("mbe13c12cd1d4");
  } else if (resolvedView === "pie" && entries.some((entry) => entry.value < 0)) {
    emptyDescription = objectMetricText("m9fb886c212ce");
  }

  return (
    <section className={styles.panel} aria-label={objectMetricText("ma1dba3459e6d")}>
      <div className={styles.header}>
        <div>
          <h3>{objectMetricText("ma1dba3459e6d")}</h3>
          <p>{objectMetricText("m3fbb6c3fc51f")}</p>
        </div>
        <Tag color="cyan">
          {objectMetricText(
            (
              {
                object_value: "mabe9d02781fc",
                summary: "m887c0bab2e93",
                grouped: "m63a570e277c4",
                time_series: "m523d11919689",
              } as const
            )[result.model.output_shape],
          )}
        </Tag>
      </div>
      <Segmented<ObjectMetricAnalysisView>
        className={styles.viewSelector}
        onChange={(value) => setSelectedView(value)}
        options={availableViews}
        value={activeView}
      />
      {hasPrecisionSensitiveValues && resolvedView !== "table" ? (
        <p className={styles.precisionNotice}>{objectMetricText("analysisApproximateChart")}</p>
      ) : null}
      {resolvedView === "summary" && summaryValue !== undefined ? (
        <div className={styles.summary}>
          <span>{objectMetricText("m6018e00aca78")}</span>
          <strong>
            {typeof result.entries[0]?.value === "string"
              ? result.entries[0].value
              : formatNumber(summaryValue)}
          </strong>
          {result.model.value.unit?.display_symbol || result.model.value.unit?.code ? (
            <em>{result.model.value.unit.display_symbol ?? result.model.value.unit.code}</em>
          ) : null}
        </div>
      ) : chartOption ? (
        <div className={styles.chart}>
          <ChartLine option={chartOption} onClick={selectChartPoint} />
        </div>
      ) : resolvedView === "table" ? (
        <div className={styles.tableHint}>{objectMetricText("mf87336ab991b")}</div>
      ) : (
        <Empty
          className={styles.empty}
          description={
            emptyDescription ??
            (manualView ? objectMetricText("m6709a4b4db1c") : objectMetricText("m9703199b649c"))
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </section>
  );
}

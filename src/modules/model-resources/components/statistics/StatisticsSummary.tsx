/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Select } from "antd";
import type { EChartsOption } from "echarts";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ModelStatisticsOverview } from "@/modules/model-resources/types/statistics";
import { formatTokens, type TokenUnit } from "@/modules/model-resources/utils/format-tokens";

import { ChartLine } from "./ChartLine";
import styles from "./statistics.module.css";

type StatisticsSummaryProps = {
  overview: ModelStatisticsOverview;
};

function KpiCard({
  label,
  unit,
  value,
}: {
  label: string;
  unit?: string;
  value: string | number;
}) {
  return (
    <div className={styles.kpiCard}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>
        {value}
        {unit ? <span className={styles.kpiUnit}>{unit}</span> : null}
      </p>
    </div>
  );
}

export function StatisticsSummary({ overview }: StatisticsSummaryProps) {
  const { t } = useTranslation();
  const [unit, setUnit] = useState<TokenUnit>("K");
  const { summary, trends } = overview;

  const chartOption = useMemo<EChartsOption>(() => {
    const xAxisData = trends.map((item) => item.date);

    return {
      tooltip: { trigger: "axis" },
      grid: { top: 12, left: 14, right: 34, bottom: 48, containLabel: true },
      legend: {
        bottom: 0,
        itemGap: 20,
        data: [
          { name: t("modelResources.statistics.charts.inputTokens"), icon: "rect" },
          { name: t("modelResources.statistics.charts.outputTokens"), icon: "rect" },
        ],
      },
      xAxis: { type: "category", boundaryGap: false, data: xAxisData },
      yAxis: [{ type: "value" }],
      series: [
        {
          name: t("modelResources.statistics.charts.inputTokens"),
          type: "line",
          showSymbol: false,
          data: trends.map((item) => formatTokens(item.inputTokens, unit)),
        },
        {
          name: t("modelResources.statistics.charts.outputTokens"),
          type: "line",
          showSymbol: false,
          data: trends.map((item) => formatTokens(item.outputTokens, unit)),
        },
      ],
    };
  }, [t, trends, unit]);

  return (
    <div>
      <div className={styles.kpiGrid}>
        <KpiCard
          label={t("modelResources.statistics.metrics.usageCount")}
          unit={t("modelResources.statistics.metrics.times")}
          value={summary.totalUsage ?? 0}
        />
        <KpiCard
          label={t("modelResources.statistics.metrics.errorRate")}
          unit="%"
          value={Number((summary.errorRate ?? 0) * 100).toFixed(4)}
        />
        <KpiCard
          label={t("modelResources.statistics.metrics.avgResponseTime")}
          unit="s"
          value={Number(summary.avgResponseTime ?? 0).toFixed(2)}
        />
        <KpiCard
          label={t("modelResources.statistics.metrics.tokenConsumption")}
          unit={t("modelResources.statistics.units.thousandTokens")}
          value={formatTokens(summary.totalTokens, "K")}
        />
      </div>

      <div className={styles.panel} style={{ marginTop: 16 }}>
        <div className={styles.panelHeader}>
          <div className={styles.tokenSummaryRow}>
            <div>
              <p className={styles.tokenMetricLabel}>
                {t("modelResources.statistics.metrics.tokenConsumption")}
              </p>
              <p className={styles.tokenMetricValue}>
                {formatTokens(summary.totalTokens, unit) || "--"}
              </p>
            </div>
            <div>
              <p className={styles.tokenMetricLabel}>
                {t("modelResources.statistics.charts.inputTokens")}
              </p>
              <p className={styles.tokenMetricValue}>
                {formatTokens(summary.inputTokens, unit) || "--"}
              </p>
            </div>
            <div>
              <p className={styles.tokenMetricLabel}>
                {t("modelResources.statistics.charts.outputTokens")}
              </p>
              <p className={styles.tokenMetricValue}>
                {formatTokens(summary.outputTokens, unit) || "--"}
              </p>
            </div>
            <div>
              <p className={styles.tokenMetricLabel}>{t("modelResources.statistics.filters.unit")}</p>
              <Select
                onChange={(nextUnit: TokenUnit) => setUnit(nextUnit)}
                options={[
                  { value: "K", label: t("modelResources.statistics.units.thousandTokens") },
                  { value: "M", label: t("modelResources.statistics.units.millionTokens") },
                ]}
                style={{ width: 150 }}
                value={unit}
              />
            </div>
          </div>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.chartBox}>
            <ChartLine option={chartOption} />
          </div>
        </div>
      </div>
    </div>
  );
}

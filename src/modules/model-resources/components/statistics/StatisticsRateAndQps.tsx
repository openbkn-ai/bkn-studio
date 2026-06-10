import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ModelStatisticsOverview } from "@/modules/model-resources/types/statistics";
import {
  createStatisticsHourAxisLabelInterval,
  formatStatisticsAxisTime,
  formatStatisticsTooltipTime,
} from "@/modules/model-resources/utils/statistics-chart";

import { ChartLine } from "./ChartLine";
import styles from "./statistics.module.css";

type StatisticsRateAndQpsProps = {
  overview: ModelStatisticsOverview;
};

export function StatisticsRateAndQps({ overview }: StatisticsRateAndQpsProps) {
  const { t } = useTranslation();
  const { qpsData, trends } = overview;

  const rateOption = useMemo<EChartsOption>(() => {
    const xAxisData = trends.map((item) => item.date);

    return {
      tooltip: { trigger: "axis" },
      grid: { top: 10, left: 14, right: 34, bottom: 4, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: xAxisData },
      yAxis: [{ type: "value", scale: true }],
      series: [
        {
          name: t("modelResources.statistics.charts.tokenRate"),
          type: "line",
          showSymbol: false,
          data: trends.map((item) => item.avgRate),
        },
      ],
    };
  }, [t, trends]);

  const qpsOption = useMemo<EChartsOption>(() => {
    const xAxisData = qpsData.map((item) => item.date);
    const seriesData = qpsData.map((item) => item.avgQps);
    const hourLabelInterval = createStatisticsHourAxisLabelInterval(xAxisData);

    return {
      tooltip: {
        trigger: "axis",
        formatter(params) {
          const entries = Array.isArray(params) ? params : [params];
          const first = entries[0];

          if (!first) {
            return "";
          }

          const time = String(first.axisValue ?? "");
          const value = first.data;

          return `${formatStatisticsTooltipTime(time)}<br/>${t("modelResources.statistics.charts.qps")}: ${value}`;
        },
      },
      grid: { top: 10, left: 36, right: 34, bottom: 4, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xAxisData,
        axisLabel: {
          formatter: (value) => formatStatisticsAxisTime(String(value)),
          interval: hourLabelInterval,
        },
        axisTick: {
          alignWithLabel: true,
          interval: hourLabelInterval,
        },
        splitLine: {
          show: true,
          interval: hourLabelInterval,
          lineStyle: {
            color: "rgba(15, 30, 54, 0.08)",
          },
        },
      },
      yAxis: [{ type: "value", scale: true }],
      series: [
        {
          name: t("modelResources.statistics.charts.qps"),
          type: "line",
          showSymbol: false,
          data: seriesData,
        },
      ],
    };
  }, [qpsData, t]);

  return (
    <div className={styles.dualChartGrid}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t("modelResources.statistics.charts.tokenRate")}</h3>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.chartBox}>
            <ChartLine option={rateOption} />
          </div>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t("modelResources.statistics.charts.qps")}</h3>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.chartBox}>
            <ChartLine option={qpsOption} />
          </div>
        </div>
      </div>
    </div>
  );
}

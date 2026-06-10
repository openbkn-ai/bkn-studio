import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ModelStatisticsOverview } from "@/modules/model-resources/types/statistics";

import { ChartLine } from "./ChartLine";
import styles from "./statistics.module.css";

type StatisticsTimeConsumingProps = {
  overview: ModelStatisticsOverview;
};

export function StatisticsTimeConsuming({ overview }: StatisticsTimeConsumingProps) {
  const { t } = useTranslation();
  const { trends } = overview;

  const chartOption = useMemo<EChartsOption>(() => {
    const xAxisData = trends.map((item) => item.date);

    return {
      tooltip: { trigger: "axis" },
      grid: { top: 12, left: 14, right: 34, bottom: 48, containLabel: true },
      legend: {
        bottom: 0,
        itemGap: 20,
        data: [
          { name: t("modelResources.statistics.metrics.callTime"), icon: "rect" },
          { name: t("modelResources.statistics.metrics.firstTokenTime"), icon: "rect" },
        ],
      },
      xAxis: { type: "category", boundaryGap: false, data: xAxisData },
      yAxis: [{ type: "value" }],
      series: [
        {
          name: t("modelResources.statistics.metrics.callTime"),
          type: "line",
          showSymbol: false,
          data: trends.map((item) => Number(item.avgTotalTime.toFixed(4))),
        },
        {
          name: t("modelResources.statistics.metrics.firstTokenTime"),
          type: "line",
          showSymbol: false,
          data: trends.map((item) => Number(item.avgFirstTime.toFixed(4))),
        },
      ],
    };
  }, [t, trends]);

  return (
    <div className={styles.panel} style={{ marginTop: 24 }}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{t("modelResources.statistics.charts.timeAndFirstToken")}</h3>
        <p className={styles.panelSubtitle}>{t("modelResources.statistics.units.secondsHint")}</p>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.chartBox}>
          <ChartLine option={chartOption} />
        </div>
      </div>
    </div>
  );
}

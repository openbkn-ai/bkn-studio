import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import { useEffect, useRef } from "react";

type ChartLineProps = {
  option: EChartsOption;
};

export function ChartLine({ option }: ChartLineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (!chartRef.current) {
      chartRef.current = echarts.init(container);
    }

    chartRef.current.setOption(option, true);

    const handleResize = () => {
      chartRef.current?.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [option]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

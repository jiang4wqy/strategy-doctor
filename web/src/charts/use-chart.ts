import { useEffect, useRef } from 'react';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { init } from './echarts.ts';

export function useChart(option: EChartsCoreOption) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | undefined>(undefined);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const chart = init(element);
    chartRef.current = chart;
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(() => chart.resize());
    resizeObserver?.observe(element);

    return () => {
      resizeObserver?.disconnect();
      chart.dispose();
      chartRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return elementRef;
}

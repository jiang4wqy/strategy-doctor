import { useMemo } from 'react';
import type { DiagnosisView } from '../api/types.ts';
import { useChart } from './use-chart.ts';

export interface ExecutionQualityChartProps {
  items: DiagnosisView['charts']['executionQuality'];
}

export function ExecutionQualityChart({ items }: ExecutionQualityChartProps) {
  const option = useMemo(() => ({
    animation: false,
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => `${(value * 100).toFixed(2)}%`,
    },
    legend: {
      data: ['Fee drag', 'Slippage drag', 'Turnover'],
      textStyle: { color: '#a9b8c9' },
    },
    grid: { left: 54, right: 24, top: 46, bottom: 44 },
    xAxis: {
      type: 'category',
      data: items.map(item => item.dimension),
      axisLabel: { color: '#788a9d' },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#788a9d',
        formatter: (value: number) => `${(value * 100).toFixed(0)}%`,
      },
      splitLine: { lineStyle: { color: '#1d3042' } },
    },
    series: [
      {
        name: 'Fee drag',
        type: 'bar',
        stack: 'cost',
        data: items.map(item => item.feeCostPct),
        itemStyle: { color: '#d9a441' },
      },
      {
        name: 'Slippage drag',
        type: 'bar',
        stack: 'cost',
        data: items.map(item => item.slippageCostPct),
        itemStyle: { color: '#ef7d68' },
      },
      {
        name: 'Turnover',
        type: 'line',
        showSymbol: true,
        data: items.map(item => item.turnoverPct),
        lineStyle: { color: '#66d4d0', width: 2 },
      },
    ],
  }), [items]);
  const chartRef = useChart(option);

  return (
    <section className="chart-panel">
      <p className="eyebrow">Execution model</p>
      <h3>Cost and turnover</h3>
      <div
        ref={chartRef}
        className="chart-canvas"
        role="img"
        aria-label="Execution cost and turnover"
      />
    </section>
  );
}

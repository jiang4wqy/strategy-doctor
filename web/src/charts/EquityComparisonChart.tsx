import { useMemo, useState } from 'react';
import type { DiagnosisView } from '../api/types.ts';
import { useChart } from './use-chart.ts';

export interface EquityComparisonChartProps {
  charts: DiagnosisView['charts'];
}

export function EquityComparisonChart({
  charts,
}: EquityComparisonChartProps) {
  const [dimension, setDimension] = useState(
    charts.defaultHeldOutDimension,
  );
  const comparison = charts.heldOutComparison.find(
    item => item.dimension === dimension,
  ) ?? charts.heldOutComparison[0];
  const isOverlapping = comparison?.original.every((value, index) => {
    const candidate = comparison?.patched[index];
    return candidate !== undefined && value === candidate;
  }) ?? false;
  const option = useMemo(() => ({
    animation: false,
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['Original', 'Patched'],
      textStyle: { color: '#a9b8c9' },
    },
    grid: { left: 44, right: 18, top: 42, bottom: 30 },
    xAxis: {
      type: 'category',
      data: comparison?.original.map((_value, index) => index) ?? [],
      axisLabel: { color: '#788a9d' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#788a9d' },
      splitLine: { lineStyle: { color: '#1d3042' } },
    },
    series: [
      {
        name: 'Original',
        type: 'line',
        showSymbol: false,
        data: comparison?.original ?? [],
        lineStyle: {
          color: '#ef7d68',
          width: 2.4,
          type: isOverlapping ? 'dashed' : 'solid',
        },
        emphasis: { focus: 'series' },
      },
      {
        name: 'Patched',
        type: 'line',
        showSymbol: false,
        data: comparison?.patched ?? [],
        lineStyle: {
          color: '#66d4d0',
          width: 2.8,
          shadowBlur: 4,
          shadowColor: 'rgba(102, 212, 208, 0.45)',
        },
        emphasis: { focus: 'series' },
      },
    ],
  }), [comparison]);
  const chartRef = useChart(option);

  return (
    <section className="chart-panel">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Held-out validation</p>
          <h3>Equity comparison</h3>
        </div>
        <label>
          Held-out dimension
          <select
            value={dimension}
            onChange={event => setDimension(
              event.target.value as typeof dimension,
            )}
          >
            {charts.heldOutComparison.map(item => (
              <option value={item.dimension} key={item.dimension}>
                {item.dimension}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        ref={chartRef}
        className="chart-canvas"
        role="img"
        aria-label="Held-out equity comparison"
      />
    </section>
  );
}

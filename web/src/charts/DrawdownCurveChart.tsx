import { useMemo, useState } from 'react';
import type { DiagnosisView } from '../api/types.ts';
import { useChart } from './use-chart.ts';

export interface DrawdownCurveChartProps {
  charts: DiagnosisView['charts'];
}

export function DrawdownCurveChart({ charts }: DrawdownCurveChartProps) {
  const [dimension, setDimension] = useState(
    charts.treatmentDrawdown[0]?.dimension ?? charts.defaultHeldOutDimension,
  );
  const selected = charts.treatmentDrawdown.find(
    item => item.dimension === dimension,
  ) ?? charts.treatmentDrawdown[0];
  const option = useMemo(() => ({
    animation: false,
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => `${(value * 100).toFixed(2)}%`,
    },
    grid: { left: 48, right: 18, top: 32, bottom: 30 },
    xAxis: {
      type: 'category',
      data: selected?.drawdown.map((_value, index) => index) ?? [],
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
    series: [{
      name: 'Drawdown',
      type: 'line',
      showSymbol: false,
      areaStyle: { color: 'rgba(239, 125, 104, 0.16)' },
      lineStyle: { color: '#ef7d68', width: 2 },
      data: selected?.drawdown ?? [],
    }],
  }), [selected]);
  const chartRef = useChart(option);

  return (
    <section className="chart-panel">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Path risk</p>
          <h3>Drawdown curve</h3>
        </div>
        <label>
          Stress dimension
          <select
            value={dimension}
            onChange={event => setDimension(event.target.value as typeof dimension)}
          >
            {charts.treatmentDrawdown.map(item => (
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
        aria-label="Treatment drawdown curve"
      />
    </section>
  );
}

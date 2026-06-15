import { useMemo } from 'react';
import type { DiagnosisView } from '../api/types.ts';
import { useChart } from './use-chart.ts';

export interface ParameterChangeChartProps {
  changes: DiagnosisView['charts']['parameterChanges'];
}

export function ParameterChangeChart({
  changes,
}: ParameterChangeChartProps) {
  const option = useMemo(() => ({
    animation: false,
    tooltip: { trigger: 'axis' },
    legend: { data: ['Before', 'After'], textStyle: { color: '#a9b8c9' } },
    grid: { left: 48, right: 18, top: 44, bottom: 62 },
    xAxis: {
      type: 'category',
      data: changes.map(change => change.label),
      axisLabel: { color: '#a9b8c9', rotate: 18 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#788a9d' },
      splitLine: { lineStyle: { color: '#1d3042' } },
    },
    series: [
      {
        name: 'Before',
        type: 'bar',
        data: changes.map(change => change.before),
        itemStyle: { color: '#ef7d68' },
      },
      {
        name: 'After',
        type: 'bar',
        data: changes.map(change => change.after),
        itemStyle: { color: '#66d4d0' },
      },
    ],
  }), [changes]);
  const chartRef = useChart(option);

  return (
    <section className="chart-panel">
      <p className="eyebrow">Targeted repair</p>
      <h3>Parameter changes</h3>
      <div
        ref={chartRef}
        className="chart-canvas"
        role="img"
        aria-label="Parameter changes"
      />
    </section>
  );
}

import { useMemo } from 'react';
import type { DiagnosisView } from '../api/types.ts';
import { useChart } from './use-chart.ts';

export interface ScenarioTimelineChartProps {
  items: DiagnosisView['charts']['scenarioTimeline'];
}

export function ScenarioTimelineChart({
  items,
}: ScenarioTimelineChartProps) {
  const option = useMemo(() => ({
    animation: false,
    tooltip: { trigger: 'axis' },
    grid: { left: 118, right: 20, top: 20, bottom: 24 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#788a9d' },
      splitLine: { lineStyle: { color: '#1d3042' } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: items.map(item => item.scenarioName),
      axisLabel: { color: '#a9b8c9' },
    },
    series: [{
      type: 'bar',
      data: items.map(item => item.damageScore),
      itemStyle: { color: '#d9a441' },
    }],
  }), [items]);
  const chartRef = useChart(option);

  return (
    <section className="chart-panel">
      <p className="eyebrow">Server-ranked damage</p>
      <h3>Scenario timeline</h3>
      <p className="chart-description">
        Bars are ordered by damage score, so the largest bars explain the
        failure modes that blocked deployment.
      </p>
      <div
        ref={chartRef}
        className="chart-canvas"
        role="img"
        aria-label="Scenario damage timeline"
      />
    </section>
  );
}

import { useMemo } from 'react';
import type { DiagnosisView } from '../api/types.ts';
import { useChart } from './use-chart.ts';

export interface RiskRadarChartProps {
  risks: DiagnosisView['charts']['riskRadar'];
}

export function RiskRadarChart({ risks }: RiskRadarChartProps) {
  const option = useMemo(() => ({
    animation: false,
    tooltip: {},
    radar: {
      indicator: risks.map(risk => ({
        name: risk.dimension,
        max: 100,
      })),
      splitLine: { lineStyle: { color: '#294054' } },
      splitArea: { areaStyle: { color: ['#0d1b29', '#102233'] } },
      axisName: { color: '#a9b8c9' },
    },
    series: [{
      name: 'Risk',
      type: 'radar',
      data: [{
        value: risks.map(risk => risk.value),
        areaStyle: { color: 'rgba(239, 125, 104, 0.22)' },
        lineStyle: { color: '#ef7d68', width: 2 },
      }],
    }],
  }), [risks]);
  const chartRef = useChart(option);

  return (
    <section className="chart-panel">
      <p className="eyebrow">Treatment set</p>
      <h3>Five-dimension risk</h3>
      <div
        ref={chartRef}
        className="chart-canvas"
        role="img"
        aria-label="Five-dimension risk radar"
      />
    </section>
  );
}

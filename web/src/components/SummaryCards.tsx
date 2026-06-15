import type { DiagnosisView } from '../api/types.ts';

export interface SummaryCardsProps {
  summary: DiagnosisView['summary'];
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    ['Risk score', String(summary.riskScore)],
    ['Worst drawdown', `${(summary.worstDrawdownPct * 100).toFixed(1)}%`],
    ['Total trades', String(summary.totalTrades)],
    [
      'Robustness gain',
      `${summary.robustnessGain >= 0 ? '+' : ''}${summary.robustnessGain}`,
    ],
    [
      'Return delta',
      `${summary.returnDelta >= 0 ? '+' : ''}${(
        summary.returnDelta * 100
      ).toFixed(1)}%`,
    ],
  ];
  return (
    <section className="summary-grid" aria-label="Diagnosis summary">
      {cards.map(([label, value]) => (
        <article className="summary-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

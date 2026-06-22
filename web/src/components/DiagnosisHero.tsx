import type { DiagnosisView } from '../api/types.ts';

export interface DiagnosisHeroProps {
  view: DiagnosisView;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${percent(value)}`;
}

export function DiagnosisHero({ view }: DiagnosisHeroProps) {
  const liquidationCount = view.scorecard.evaluations.filter(
    evaluation => evaluation.metrics.liquidated,
  ).length;

  return (
    <section
      className={`diagnosis-hero diagnosis-hero-${view.deployment.status}`}
      aria-label="Judge-ready diagnosis summary"
    >
      <div className="diagnosis-hero-lead">
        <p className="eyebrow">Judge-ready verdict</p>
        <h2>{view.deployment.headline}</h2>
        <p>
          Deployment status <strong>{view.deployment.status}</strong> with a
          readiness score of <strong>{view.deployment.score}/100</strong>.
        </p>
      </div>
      <dl className="diagnosis-hero-metrics">
        <div>
          <dt>Risk score</dt>
          <dd>{view.summary.riskScore}</dd>
        </div>
        <div>
          <dt>Worst drawdown</dt>
          <dd>{percent(view.summary.worstDrawdownPct)}</dd>
        </div>
        <div>
          <dt>Liquidations</dt>
          <dd>{liquidationCount}</dd>
        </div>
        <div>
          <dt>Held-out robustness</dt>
          <dd>{view.summary.robustnessGain >= 0 ? '+' : ''}{view.summary.robustnessGain}</dd>
        </div>
        <div>
          <dt>Return trade-off</dt>
          <dd>{signedPercent(view.summary.returnDelta)}</dd>
        </div>
      </dl>
    </section>
  );
}

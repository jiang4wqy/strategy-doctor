import type {
  DeathCause,
  Scorecard,
  Strategy,
  StyleName,
} from '../contracts.ts';

const STYLE_LABELS: Record<StyleName, string> = {
  conservative: 'Conservative',
  aggressive: 'Aggressive',
  trend: 'Trend',
};

const CAUSE_LABELS: Record<DeathCause, string> = {
  liquidation: 'Liquidation',
  'drawdown-breach': 'Drawdown breach',
  'stop-loss-bleed': 'Stop-loss bleed',
  survived: 'Survived',
};

const percent = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

const signedPercent = (value: number): string =>
  `${value >= 0 ? '+' : ''}${percent(value)}`;

export function renderScorecard(
  scorecard: Scorecard,
  strategy: Strategy,
): string {
  const lines: string[] = [
    `# Strategy Doctor Report: ${strategy.name}`,
    '',
    `> Scenario set: \`${scorecard.scenarioSetId}\`. Treatment and held-out validation use separate seeds.`,
    '',
    '## Five-Dimensional Stress Coverage',
    '| Dimension | Skill | Observed At | Severity | Shock | PnL | Max Drawdown | Trades | Damage | Outcome |',
    '|---|---|---|---:|---|---:|---:|---:|---:|---|',
  ];

  for (const evaluation of scorecard.evaluations) {
    lines.push(
      `| ${evaluation.dimension} | ${evaluation.sourceSkill} | ${evaluation.sourceObservedAt ?? '-'} | ${evaluation.severity} | ${evaluation.shock.kind} | ${percent(evaluation.metrics.pnlPct)} | ${percent(evaluation.metrics.maxDrawdownPct)} | ${evaluation.metrics.numTrades} | ${evaluation.damageScore.toFixed(1)} | ${CAUSE_LABELS[evaluation.cause]} |`,
    );
  }

  lines.push(
    '',
    '## Three Style Scores',
    '| Style | Risk Score | Passed | Worst Drawdown | Mean Return |',
    '|---|---:|---|---:|---:|',
  );

  for (const score of Object.values(scorecard.perStyle)) {
    lines.push(
      `| ${STYLE_LABELS[score.style]} | ${score.riskScore} | ${score.survived ? 'Yes' : 'No'} | ${percent(score.worstDrawdownPct)} | ${percent(score.meanPnlPct)} |`,
    );
  }

  lines.push('', '## Failure List');
  if (scorecard.deaths.length === 0) {
    lines.push('No fatal outcomes were found in the treatment scenarios.');
  } else {
    for (const death of scorecard.deaths) {
      lines.push(
        `- **${death.scenarioName}** (${death.dimension}): ${CAUSE_LABELS[death.cause]}; return ${percent(death.metrics.pnlPct)}, max drawdown ${percent(death.metrics.maxDrawdownPct)}, ${death.metrics.numTrades} trades.`,
        `  - ${death.narrative}`,
      );
    }
  }

  if (scorecard.prescription) {
    lines.push(
      '',
      '## Prescription',
      `- Parameter changes: \`${JSON.stringify(scorecard.prescription.changes)}\``,
      `- Rationale: ${scorecard.prescription.rationale}`,
    );
  }

  if (scorecard.tradeoff) {
    lines.push(
      '',
      '## Held-Out Retest (Honest Trade-Off)',
      `- Risk score change: ${scorecard.tradeoff.robustnessGain >= 0 ? '+' : ''}${scorecard.tradeoff.robustnessGain}`,
      `- Mean return change: ${signedPercent(scorecard.tradeoff.returnCost)}`,
    );
  }

  lines.push(
    '',
    '> This report does not promise that a patch is automatically better. Prescription quality is judged on held-out scenarios that were not used during the repair search; remaining failures should stay visible as risk.',
  );

  return lines.join('\n');
}

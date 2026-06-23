import type {
  DeathCause,
  Scorecard,
  Strategy,
  StyleName,
} from '../contracts.ts';

const STYLE_LABELS: Record<StyleName, string> = {
  conservative: 'Conservative',
  aggressive: 'Aggressive',
  trend: 'Trend-following',
};

const CAUSE_LABELS: Record<DeathCause, string> = {
  liquidation: 'forced liquidation',
  'drawdown-breach': 'drawdown breach',
  'stop-loss-bleed': 'stop-loss bleed',
  survived: 'survived',
};

const percent = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

const signedPercent = (value: number): string =>
  `${value >= 0 ? '+' : ''}${percent(value)}`;

function signedNumber(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`;
}

export function renderScorecard(
  scorecard: Scorecard,
  strategy: Strategy,
): string {
  const lines: string[] = [
    `# Strategy Doctor diagnosis: ${strategy.name}`,
    '',
    `> Scenario set: \`${scorecard.scenarioSetId}\`. Treatment and held-out validation use different root seeds.`,
    '',
    '## Five-dimension stress coverage',
    '| Dimension | Skill | Observed at | Severity | Shock | PnL | Max drawdown | Trades | Damage | Result |',
    '|---|---|---|---:|---|---:|---:|---:|---:|---|',
  ];

  for (const evaluation of scorecard.evaluations) {
    lines.push(
      `| ${evaluation.dimension} | ${evaluation.sourceSkill} | ${evaluation.sourceObservedAt ?? '-'} | ${evaluation.severity} | ${evaluation.shock.kind} | ${percent(evaluation.metrics.pnlPct)} | ${percent(evaluation.metrics.maxDrawdownPct)} | ${evaluation.metrics.numTrades} | ${evaluation.damageScore.toFixed(1)} | ${CAUSE_LABELS[evaluation.cause]} |`,
    );
  }

  lines.push(
    '',
    '## Three-profile risk scores',
    '| Profile | Risk score | Survived | Worst drawdown | Mean PnL |',
    '|---|---:|---|---:|---:|',
  );

  for (const score of Object.values(scorecard.perStyle)) {
    lines.push(
      `| ${STYLE_LABELS[score.style]} | ${score.riskScore} | ${score.survived ? 'yes' : 'no'} | ${percent(score.worstDrawdownPct)} | ${percent(score.meanPnlPct)} |`,
    );
  }

  lines.push('', '## Failure ledger');
  if (scorecard.deaths.length === 0) {
    lines.push('No fatal treatment scenarios were found.');
  } else {
    for (const death of scorecard.deaths) {
      lines.push(
        `- **${death.scenarioName}** (${death.dimension}): ${CAUSE_LABELS[death.cause]}; PnL ${percent(death.metrics.pnlPct)}, max drawdown ${percent(death.metrics.maxDrawdownPct)}, trades ${death.metrics.numTrades}.`,
        `  - ${death.narrative}`,
      );
    }
  }

  lines.push(
    '',
    '## Execution quality',
    '| Dimension | Trades | Turnover | Fee drag | Slippage drag |',
    '|---|---:|---:|---:|---:|',
  );

  for (const evaluation of scorecard.evaluations) {
    lines.push(
      `| ${evaluation.dimension} | ${evaluation.metrics.numTrades} | ${percent(evaluation.metrics.turnoverPct ?? 0)} | ${percent(evaluation.metrics.feeCostPct ?? 0)} | ${percent(evaluation.metrics.slippageCostPct ?? 0)} |`,
    );
  }

  lines.push(
    '',
    '## Prescription',
    `- Parameter changes: \`${JSON.stringify(scorecard.prescription.changes)}\``,
    `- Rationale: ${scorecard.prescription.rationale}`,
  );

  if (scorecard.prescription.consensus) {
    lines.push(
      `- Consensus: ${(scorecard.prescription.consensus.agreementRate * 100).toFixed(1)}% agreement across ${scorecard.prescription.consensus.requestedStyles.join(', ')} profiles.`,
    );
  }

  if (scorecard.prescription.patchedStrategy) {
    lines.push(
      '',
      '## Strategy reviewer',
      'The API/Web diagnosis view includes a strategy-review section. Configure `DOCTOR_REVIEW_ENABLED=1`, `DASHSCOPE_API_KEY`, and optionally `DOCTOR_REVIEW_MODEL` to call a Qwen-compatible reviewer; otherwise the local rule reviewer is used.',
    );
  }

  lines.push(
    '',
    '## Held-out validation',
    `- Robustness score change: ${signedNumber(scorecard.tradeoff.robustnessGain)}`,
    `- Average return change: ${signedPercent(scorecard.tradeoff.returnCost)}`,
    '',
    '> Strategy Doctor is a diagnostic and risk-control tool. It does not promise future returns, and every prescription must be judged by the independent held-out result above.',
  );

  return lines.join('\n');
}

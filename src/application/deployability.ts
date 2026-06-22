import type {
  Scorecard,
  StyleName,
} from '../contracts.ts';
import type {
  DeploymentGate,
  DeploymentReadiness,
} from '../platform/contracts.ts';

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function assessDeploymentReadiness(
  scorecard: Scorecard,
  style: StyleName,
): DeploymentReadiness {
  const selected = scorecard.perStyle[style];
  const liquidations = scorecard.evaluations.filter(
    evaluation => evaluation.metrics.liquidated,
  ).length;
  const survivalRate = scorecard.evaluations.filter(
    evaluation => evaluation.cause === 'survived',
  ).length / scorecard.evaluations.length;
  const maxDrawdown = selected.worstDrawdownPct;
  const robustnessGain = scorecard.tradeoff.robustnessGain;
  const returnDelta = scorecard.tradeoff.returnCost;

  const gates: DeploymentGate[] = [
    {
      key: 'liquidation-free',
      label: 'No liquidation in treatment',
      passed: liquidations === 0,
      value: `${liquidations} liquidation${liquidations === 1 ? '' : 's'}`,
    },
    {
      key: 'drawdown-budget',
      label: 'Worst drawdown under 35%',
      passed: maxDrawdown <= 0.35,
      value: percent(maxDrawdown),
    },
    {
      key: 'survival-rate',
      label: 'At least 80% scenarios survived',
      passed: survivalRate >= 0.8,
      value: percent(survivalRate),
    },
    {
      key: 'held-out-robustness',
      label: 'Held-out robustness improved',
      passed: robustnessGain >= 0,
      value: `${robustnessGain >= 0 ? '+' : ''}${robustnessGain}`,
    },
    {
      key: 'return-tradeoff',
      label: 'Held-out return cost within 15%',
      passed: returnDelta >= -0.15,
      value: `${returnDelta >= 0 ? '+' : ''}${percent(returnDelta)}`,
    },
  ];

  const gateScore = gates.filter(gate => gate.passed).length / gates.length;
  const score = clampScore(
    selected.riskScore * 0.45
    + survivalRate * 25
    + gateScore * 20
    + (robustnessGain >= 0 ? 10 : 0),
  );
  const blockers = gates
    .filter(gate => !gate.passed)
    .map(gate => `${gate.label}: ${gate.value}`);
  const hasHardBlocker = liquidations > 0 || maxDrawdown > 0.5;
  const status = score >= 75 && !hasHardBlocker
    ? 'ready'
    : score >= 50 && liquidations === 0
      ? 'watch'
      : 'blocked';
  const headline = status === 'ready'
    ? 'Ready for Playbook sandbox publication'
    : status === 'watch'
      ? 'Publish only after manual review'
      : 'Do not publish before risk repair';

  return {
    score,
    status,
    headline,
    gates,
    blockers,
  };
}

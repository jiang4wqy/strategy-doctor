import type { Metrics, StyleScore } from '../contracts.ts';
import type { StyleProfile } from './styles.ts';

export function scoreStyle(
  results: Metrics[],
  profile: StyleProfile,
): StyleScore {
  const liquidationRate = results.filter(result => result.liquidated).length
    / results.length;
  const nonLiquidated = results.filter(result => !result.liquidated);
  const scoringDrawdown = nonLiquidated.length > 0
    ? Math.max(...nonLiquidated.map(result => result.maxDrawdownPct))
    : 1;
  const worstDrawdownPct = Math.max(
    ...results.map(result => result.maxDrawdownPct),
  );
  const meanPnlPct = results.reduce(
    (sum, result) => sum + result.pnlPct,
    0,
  ) / results.length;

  const drawdownScore = Math.max(
    0,
    1 - scoringDrawdown / profile.maxDrawdown,
  );
  const pnlScore = Math.min(1, Math.max(0, 0.5 + meanPnlPct));
  const liquidationPenalty = liquidationRate > profile.liquidationTolerance
    ? 0.3
    : 1;
  const survived = scoringDrawdown <= profile.maxDrawdown
    && liquidationRate <= profile.liquidationTolerance;
  const rawRiskScore = Math.round(
    100
    * (
      profile.ddWeight * drawdownScore
      + profile.pnlWeight * pnlScore
    )
    * liquidationPenalty,
  );

  return {
    style: profile.style,
    riskScore: survived ? rawRiskScore : Math.min(rawRiskScore, 59),
    survived,
    worstDrawdownPct,
    meanPnlPct,
  };
}

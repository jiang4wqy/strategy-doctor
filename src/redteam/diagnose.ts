import type { DeathCause, Metrics } from '../contracts.ts';

export function classifyDeath(
  metrics: Metrics,
  drawdownThreshold = 0.5,
): DeathCause {
  if (metrics.liquidated) {
    return 'liquidation';
  }
  if (metrics.maxDrawdownPct >= drawdownThreshold) {
    return 'drawdown-breach';
  }
  if (metrics.pnlPct <= -0.15 && metrics.numTrades >= 8) {
    return 'stop-loss-bleed';
  }
  return 'survived';
}

import type {
  PaperSignalRequest,
  PaperSignalView,
} from '../platform/contracts.ts';
import {
  getStrategyAdapter,
  type AnyStrategyAdapter,
} from '../strategy/registry.ts';
import { parseStrategy } from '../strategy/parse.ts';
import { runStrategyOnPrices } from '../backtest/engine.ts';
import { generatePath } from '../backtest/path.ts';
import type { PositionDirection } from '../contracts.ts';

function defaultPrices(): number[] {
  return generatePath({
    kind: 'grind',
    magnitude: 0.08,
    durationBars: 120,
    volMult: 1.1,
    seed: 20260623,
  }, 160, 100);
}

function positionLabel(position: PositionDirection): PaperSignalView['simulatedPosition'] {
  if (position > 0) {
    return 'long';
  }
  if (position < 0) {
    return 'short';
  }
  return 'flat';
}

export function trackPaperSignal(
  request: PaperSignalRequest,
  observedAt = new Date().toISOString(),
): PaperSignalView {
  const strategy = parseStrategy(request.strategy);
  const prices = request.prices && request.prices.length >= 2
    ? request.prices
    : defaultPrices();
  const adapter = getStrategyAdapter(strategy.archetype) as AnyStrategyAdapter;
  const metrics = runStrategyOnPrices(strategy, prices, adapter);
  const latestDecision = adapter.decide(strategy.params as never, {
    prices,
    index: prices.length - 1,
    position: 0,
    entryPrice: 0,
  });
  const simulatedPosition: PositionDirection = latestDecision === 'long'
    ? 1
    : latestDecision === 'short'
      ? -1
      : 0;

  return {
    strategyId: strategy.id,
    symbol: strategy.universe[0],
    timeframe: strategy.timeframe,
    latestSignal: latestDecision,
    simulatedPosition: positionLabel(simulatedPosition),
    paperEquity: metrics.equityCurve.at(-1) ?? 1,
    totalTrades: metrics.numTrades,
    turnoverPct: metrics.turnoverPct ?? 0,
    feeCostPct: metrics.feeCostPct ?? 0,
    slippageCostPct: metrics.slippageCostPct ?? 0,
    lastUpdatedAt: observedAt,
    notes: [
      'Paper signal tracking is read-only and does not place orders.',
      'Use this lane to observe live decision drift before deployment.',
    ],
  };
}

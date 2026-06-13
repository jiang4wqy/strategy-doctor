import type {
  BacktestAdapter,
  MaCrossParams,
  Metrics,
  Scenario,
  Strategy,
} from '../contracts.ts';
import { generatePath } from './path.ts';

function simpleMovingAverage(
  prices: number[],
  period: number,
  index: number,
): number | null {
  if (index + 1 < period) {
    return null;
  }

  let sum = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor++) {
    sum += prices[cursor];
  }
  return sum / period;
}

export function runOnPrices(params: MaCrossParams, prices: number[]): Metrics {
  if (
    prices.length < 2
    || prices.some(price => !Number.isFinite(price) || price <= 0)
  ) {
    throw new Error('prices must contain at least two finite positive values');
  }

  const { fastMA, slowMA, leverage, stopLossPct, positionPct } = params;
  let equity = 1;
  const equityCurve = [equity];
  let direction = 0;
  let entryPrice = 0;
  let blockedDirection = 0;
  let liquidated = false;
  let numTrades = 0;
  let peakEquity = equity;
  let maxDrawdownPct = 0;
  const liquidationLine = 0.9 / leverage;

  for (let index = 1; index < prices.length; index++) {
    if (direction !== 0 && !liquidated) {
      const barReturn = direction * (prices[index] / prices[index - 1] - 1);
      const equityChange = Math.max(-positionPct, barReturn * leverage * positionPct);
      equity = Math.max(0.001, equity * (1 + equityChange));

      const excursion = direction * (prices[index] / entryPrice - 1);
      if (excursion <= -liquidationLine) {
        liquidated = true;
        blockedDirection = direction;
        direction = 0;
      } else if (excursion <= -stopLossPct) {
        blockedDirection = direction;
        direction = 0;
      }
    }

    if (equity <= 0.05) {
      liquidated = true;
      direction = 0;
    }

    const fastAverage = simpleMovingAverage(prices, fastMA, index);
    const slowAverage = simpleMovingAverage(prices, slowMA, index);
    const signal = fastAverage !== null && slowAverage !== null
      ? Math.sign(fastAverage - slowAverage)
      : 0;

    if (
      !liquidated
      && signal !== 0
      && signal !== direction
      && signal !== blockedDirection
    ) {
      direction = signal;
      entryPrice = prices[index];
      numTrades++;
      blockedDirection = 0;
    }

    peakEquity = Math.max(peakEquity, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, (peakEquity - equity) / peakEquity);
    equityCurve.push(equity);
  }

  return {
    pnlPct: equity - 1,
    maxDrawdownPct,
    liquidated,
    numTrades,
    equityCurve,
  };
}

export class MockBacktester implements BacktestAdapter {
  async run(strategy: Strategy, scenario: Scenario): Promise<Metrics> {
    if (strategy.archetype !== 'ma-cross') {
      throw new Error(`unsupported strategy archetype: ${strategy.archetype}`);
    }
    return runOnPrices(strategy.params, generatePath(scenario.shock));
  }
}

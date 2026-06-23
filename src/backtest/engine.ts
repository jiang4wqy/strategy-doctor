import type {
  Metrics,
  PositionDirection,
  Strategy,
  StrategyDecision,
} from '../contracts.ts';
import type { AnyStrategyAdapter } from '../strategy/registry.ts';

export function runStrategyOnPrices(
  strategy: Strategy,
  prices: readonly number[],
  adapter: AnyStrategyAdapter,
): Metrics {
  if (
    prices.length < 2
    || prices.some(price => !Number.isFinite(price) || price <= 0)
  ) {
    throw new Error('prices must contain at least two finite positive values');
  }
  if (adapter.archetype !== strategy.archetype) {
    throw new Error(
      `strategy adapter archetype mismatch: ${strategy.archetype} vs ${adapter.archetype}`,
    );
  }

  const { leverage, stopLossPct, positionPct } = strategy.params;
  const feeRatePct = strategy.execution?.feeRatePct ?? 0;
  const slippagePct = strategy.execution?.slippagePct ?? 0;
  let equity = 1;
  const equityCurve = [equity];
  const drawdownCurve = [0];
  let direction: PositionDirection = 0;
  let entryPrice = 0;
  let blockedDirection: PositionDirection = 0;
  let liquidated = false;
  let numTrades = 0;
  let peakEquity = equity;
  let maxDrawdownPct = 0;
  let turnoverPct = 0;
  let feeCostPct = 0;
  let slippageCostPct = 0;
  const liquidationLine = 0.9 / leverage;

  function applyExecutionCost(turnoverMultiplier: number): void {
    if (turnoverMultiplier <= 0) {
      return;
    }
    const turnover = positionPct * leverage * turnoverMultiplier;
    turnoverPct += turnover;
    feeCostPct += turnover * feeRatePct;
    slippageCostPct += turnover * slippagePct;
    const cost = turnover * (feeRatePct + slippagePct);
    equity = Math.max(0.001, equity * (1 - cost));
  }

  for (let index = 1; index < prices.length; index++) {
    if (direction !== 0 && !liquidated) {
      const barReturn = direction * (prices[index] / prices[index - 1] - 1);
      const equityChange = Math.max(
        -positionPct,
        barReturn * leverage * positionPct,
      );
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

    const decision: StrategyDecision = adapter.decide(
      strategy.params as never,
      {
        prices,
        index,
        position: direction,
        entryPrice,
      },
    );

    if (!liquidated) {
      if (decision === 'flat') {
        if (direction !== 0) {
          applyExecutionCost(1);
        }
        direction = 0;
        entryPrice = 0;
        blockedDirection = 0;
      } else if (decision === 'long' || decision === 'short') {
        const nextDirection: PositionDirection =
          decision === 'long' ? 1 : -1;
        if (
          nextDirection !== direction
          && nextDirection !== blockedDirection
        ) {
          applyExecutionCost(direction === 0 ? 1 : 2);
          direction = nextDirection;
          entryPrice = prices[index];
          numTrades++;
          blockedDirection = 0;
        }
      }
    }

    peakEquity = Math.max(peakEquity, equity);
    maxDrawdownPct = Math.max(
      maxDrawdownPct,
      (peakEquity - equity) / peakEquity,
    );
    equityCurve.push(equity);
    drawdownCurve.push((peakEquity - equity) / peakEquity);
  }

  const metrics: Metrics = {
    pnlPct: equity - 1,
    maxDrawdownPct,
    liquidated,
    numTrades,
    equityCurve,
  };
  return strategy.execution
    ? {
      ...metrics,
      drawdownCurve,
      turnoverPct,
      feeCostPct,
      slippageCostPct,
    }
    : metrics;
}

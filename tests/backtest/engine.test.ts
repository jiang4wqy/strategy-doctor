import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  MaCrossParams,
  MaCrossStrategy,
  RsiBollingerStrategy,
  StrategyAdapter,
  StrategyDecision,
} from '../../src/contracts.ts';
import { runStrategyOnPrices } from '../../src/backtest/engine.ts';
import { runOnPrices } from '../../src/backtest/mock.ts';
import { maCrossAdapter } from '../../src/strategy/adapters/ma-cross.ts';

const params: MaCrossParams = {
  fastMA: 3,
  slowMA: 10,
  leverage: 2,
  stopLossPct: 0.05,
  positionPct: 1,
};

const strategy: MaCrossStrategy = {
  id: 'ma',
  name: 'moving average',
  archetype: 'ma-cross',
  params,
  universe: ['BTCUSDT'],
  timeframe: '1h',
};

const adapterWithDecisions = (
  decide: (
    index: number,
    position: -1 | 0 | 1,
  ) => StrategyDecision,
): StrategyAdapter<'ma-cross'> => ({
  ...maCrossAdapter,
  decide(_params, context) {
    return decide(context.index, context.position);
  },
});

test('shared engine rejects invalid prices and adapter mismatches', () => {
  for (const prices of [
    [],
    [100],
    [100, 0],
    [100, -1],
    [100, Number.NaN],
    [100, Number.POSITIVE_INFINITY],
  ]) {
    assert.throws(
      () => runStrategyOnPrices(strategy, prices, maCrossAdapter),
      /prices/i,
    );
  }

  const rsiStrategy: RsiBollingerStrategy = {
    id: 'rsi',
    name: 'mean reversion',
    archetype: 'rsi-bollinger-mean-reversion',
    params: {
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      bollingerPeriod: 20,
      bollingerStdDev: 2,
      leverage: 2,
      stopLossPct: 0.05,
      positionPct: 0.5,
    },
    universe: ['BTCUSDT'],
    timeframe: '1h',
  };
  assert.throws(
    () => runStrategyOnPrices(rsiStrategy, [100, 101], maCrossAdapter),
    /adapter|archetype/i,
  );
});

test('shared engine preserves moving-average compatibility', () => {
  const upTrend = Array.from(
    { length: 80 },
    (_, index) => 100 * 1.01 ** index,
  );
  const rising = upTrend.slice(0, 14);
  const peak = rising[rising.length - 1];
  const gapCrash = [...rising, peak * 0.85, peak * 0.83, peak * 0.81];

  assert.deepEqual(
    runStrategyOnPrices(strategy, upTrend, maCrossAdapter),
    runOnPrices(params, upTrend),
  );
  assert.deepEqual(
    runStrategyOnPrices(strategy, gapCrash, maCrossAdapter),
    runOnPrices(params, gapCrash),
  );
});

test('flat closes an open position without counting a new trade', () => {
  const adapter = adapterWithDecisions((index) => {
    if (index === 1) return 'long';
    if (index === 2) return 'flat';
    return 'hold';
  });

  const metrics = runStrategyOnPrices(
    strategy,
    [100, 100, 100, 100],
    adapter,
  );

  assert.equal(metrics.numTrades, 1);
  assert.equal(metrics.pnlPct, 0);
});

test('a stopped direction remains blocked through hold', () => {
  const adapter = adapterWithDecisions((index) => (
    index === 2 ? 'hold' : 'long'
  ));

  const metrics = runStrategyOnPrices(
    strategy,
    [100, 100, 90, 91, 92],
    adapter,
  );

  assert.equal(metrics.numTrades, 1);
  assert.equal(metrics.liquidated, false);
});

test('flat clears a stopped-direction block and permits re-entry', () => {
  const adapter = adapterWithDecisions((index) => {
    if (index === 1 || index === 3) return 'long';
    if (index === 2) return 'flat';
    return 'hold';
  });

  const metrics = runStrategyOnPrices(
    strategy,
    [100, 100, 90, 91],
    adapter,
  );

  assert.equal(metrics.numTrades, 2);
});

test('the opposite direction may enter while a stopped direction is blocked', () => {
  const adapter = adapterWithDecisions((index) => (
    index === 1 ? 'long' : 'short'
  ));

  const metrics = runStrategyOnPrices(
    strategy,
    [100, 100, 90, 91],
    adapter,
  );

  assert.equal(metrics.numTrades, 2);
});

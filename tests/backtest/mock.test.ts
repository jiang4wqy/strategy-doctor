import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester, runOnPrices } from '../../src/backtest/mock.ts';
import type {
  MaCrossParams,
  Scenario,
  Strategy,
} from '../../src/contracts.ts';

const upTrend = (length: number, start = 100) =>
  Array.from({ length }, (_, index) => start * 1.01 ** index);

const gapCrash = () => {
  const rising = upTrend(14);
  const peak = rising[rising.length - 1];
  return [...rising, peak * 0.85, peak * 0.83, peak * 0.81];
};

const baseParams: MaCrossParams = {
  fastMA: 3,
  slowMA: 10,
  leverage: 10,
  stopLossPct: 0.5,
  positionPct: 1,
};

test('10x leverage is liquidated by a 15% gap against the position', () => {
  const metrics = runOnPrices(baseParams, gapCrash());
  assert.equal(metrics.liquidated, true);
});

test('3x leverage with a 5% stop survives the same gap', () => {
  const metrics = runOnPrices({
    ...baseParams,
    leverage: 3,
    stopLossPct: 0.05,
  }, gapCrash());

  assert.equal(metrics.liquidated, false);
  assert.ok(metrics.numTrades >= 1);
  assert.ok(metrics.maxDrawdownPct < 0.7);
});

test('a long trend produces a profit for the moving-average strategy', () => {
  const metrics = runOnPrices({ ...baseParams, leverage: 2 }, upTrend(80));
  assert.ok(metrics.pnlPct > 0);
});

test('runOnPrices is deterministic', () => {
  assert.deepEqual(
    runOnPrices(baseParams, gapCrash()),
    runOnPrices(baseParams, gapCrash()),
  );
});

test('runOnPrices rejects invalid price series', () => {
  for (const prices of [
    [],
    [100],
    [100, 0],
    [100, -1],
    [100, Number.NaN],
    [100, Number.POSITIVE_INFINITY],
  ]) {
    assert.throws(() => runOnPrices(baseParams, prices), /prices/i);
  }
});

test('MockBacktester implements the BacktestAdapter behavior', async () => {
  const strategy: Strategy = {
    id: 'strategy',
    name: 'strategy',
    archetype: 'ma-cross',
    params: baseParams,
    universe: ['BTCUSDT'],
    timeframe: '1h',
  };
  const scenario: Scenario = {
    id: 'scenario',
    name: 'scenario',
    dimension: 'sentiment',
    sourceSkill: 'sentiment-analyst',
    narrative: 'test squeeze',
    severity: 5,
    shock: {
      kind: 'squeeze',
      magnitude: 0.4,
      durationBars: 48,
      volMult: 2,
      seed: 7,
    },
  };

  const metrics = await new MockBacktester().run(strategy, scenario);

  assert.equal(typeof metrics.pnlPct, 'number');
  assert.equal(typeof metrics.maxDrawdownPct, 'number');
  assert.equal(typeof metrics.liquidated, 'boolean');
  assert.ok(Array.isArray(metrics.equityCurve));
});

test('mock backtests delegate execution through the shared engine', () => {
  const source = readFileSync(
    new URL('../../src/backtest/mock.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /runStrategyOnPrices/);
  assert.doesNotMatch(source, /strategy\.archetype !== 'ma-cross'/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/backtest/path.ts';
import type { AtrTrendBreakoutParams } from '../../src/contracts.ts';
import {
  atrTrendBreakoutAdapter,
} from '../../src/strategy/adapters/atr-trend-breakout.ts';

const params: AtrTrendBreakoutParams = {
  atrPeriod: 14,
  breakoutLookback: 20,
  atrStopMultiple: 2.5,
  trendMaPeriod: 50,
  leverage: 5,
  stopLossPct: 0.12,
  positionPct: 0.6,
};

test('ATR trend breakout adapter validates parameter invariants', () => {
  assert.deepEqual(atrTrendBreakoutAdapter.parseParams(params), params);

  for (const patch of [
    { atrPeriod: 1 },
    { atrPeriod: 14.5 },
    { breakoutLookback: 4 },
    { breakoutLookback: 20.5 },
    { atrStopMultiple: 0 },
    { atrStopMultiple: 10.1 },
    { trendMaPeriod: 1 },
    { trendMaPeriod: 50.5 },
    { leverage: 0 },
    { stopLossPct: 0 },
    { positionPct: 1.1 },
  ]) {
    assert.throws(
      () => atrTrendBreakoutAdapter.parseParams({ ...params, ...patch }),
      /invalid strategy/i,
    );
  }
});

test('ATR trend breakout enters confirmed long and short breakouts', () => {
  const risingBase = Array.from({ length: 50 }, (_, index) => 100 + index * 0.1);
  assert.equal(atrTrendBreakoutAdapter.decide(params, {
    prices: [...risingBase, 110],
    index: 50,
    position: 0,
    entryPrice: 0,
  }), 'long');

  const fallingBase = Array.from({ length: 50 }, (_, index) => 110 - index * 0.1);
  assert.equal(atrTrendBreakoutAdapter.decide(params, {
    prices: [...fallingBase, 100],
    index: 50,
    position: 0,
    entryPrice: 0,
  }), 'short');
});

test('ATR trend breakout blocks breakouts against the trend filter', () => {
  const highHistory = Array.from({ length: 30 }, () => 200);
  const recentRange = Array.from({ length: 20 }, (_, index) => 90 + index * 0.4);
  assert.equal(atrTrendBreakoutAdapter.decide(params, {
    prices: [...highHistory, ...recentRange, 98.2],
    index: 50,
    position: 0,
    entryPrice: 0,
  }), 'hold');
});

test('ATR trend breakout uses ATR-sized invalidation exits', () => {
  const fastParams: AtrTrendBreakoutParams = {
    ...params,
    atrPeriod: 2,
    breakoutLookback: 5,
    atrStopMultiple: 1,
    trendMaPeriod: 5,
  };

  assert.equal(atrTrendBreakoutAdapter.decide(fastParams, {
    prices: [100, 101, 102, 103, 104, 105, 100],
    index: 6,
    position: 1,
    entryPrice: 105,
  }), 'flat');
});

test('ATR trend breakout exposes scoped prescription policy', () => {
  assert.deepEqual(
    atrTrendBreakoutAdapter.targetedFields(
      new Set(['liquidation', 'drawdown-breach', 'stop-loss-bleed']),
    ),
    [
      'leverage',
      'stopLossPct',
      'positionPct',
      'atrStopMultiple',
      'breakoutLookback',
    ],
  );

  const patch = atrTrendBreakoutAdapter.targetedPatch(params, [
    'liquidation',
    'drawdown-breach',
    'stop-loss-bleed',
  ]);

  assert.deepEqual(patch.patch, {
    leverage: 3,
    stopLossPct: 0.12,
    positionPct: 0.42,
    atrStopMultiple: 3.46,
    breakoutLookback: 25,
  });
  assert.equal(patch.rationale.length, 3);
  assert.equal(atrTrendBreakoutAdapter.paramLabel('atrStopMultiple'), 'ATR stop multiple');
});

test('ATR trend breakout jitter is deterministic and valid', () => {
  const fields: readonly (keyof AtrTrendBreakoutParams)[] = [
    'atrPeriod',
    'breakoutLookback',
    'atrStopMultiple',
    'trendMaPeriod',
    'leverage',
    'stopLossPct',
    'positionPct',
  ];
  const first = atrTrendBreakoutAdapter.jitterParams(
    params,
    mulberry32(11),
    fields,
  );
  const second = atrTrendBreakoutAdapter.jitterParams(
    params,
    mulberry32(11),
    fields,
  );

  assert.deepEqual(first, second);
  assert.doesNotThrow(() => atrTrendBreakoutAdapter.parseParams(first));
});

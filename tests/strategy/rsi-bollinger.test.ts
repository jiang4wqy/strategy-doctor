import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/backtest/path.ts';
import type { RsiBollingerParams } from '../../src/contracts.ts';
import { maCrossAdapter } from '../../src/strategy/adapters/ma-cross.ts';
import { rsiBollingerAdapter } from '../../src/strategy/adapters/rsi-bollinger.ts';
import { createStrategyRegistry } from '../../src/strategy/registry.ts';

const decisionParams: RsiBollingerParams = {
  rsiPeriod: 2,
  rsiOversold: 40,
  rsiOverbought: 60,
  bollingerPeriod: 3,
  bollingerStdDev: 1,
  trendFilterPeriod: 4,
  trendFilterThreshold: 0.2,
  leverage: 3,
  stopLossPct: 0.08,
  positionPct: 0.5,
};

const policyParams: RsiBollingerParams = {
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
  trendFilterPeriod: 50,
  trendFilterThreshold: 0.03,
  leverage: 10,
  stopLossPct: 0.5,
  positionPct: 1,
};

test('RSI Bollinger adapter validates all parameter bounds', () => {
  assert.deepEqual(
    rsiBollingerAdapter.parseParams(decisionParams),
    decisionParams,
  );

  for (const patch of [
    { rsiPeriod: 1 },
    { rsiPeriod: 2.5 },
    { rsiOversold: 0 },
    { rsiOversold: 50 },
    { rsiOverbought: 50 },
    { rsiOverbought: 100 },
    { bollingerPeriod: 1 },
    { bollingerPeriod: 2.5 },
    { bollingerStdDev: 0 },
    { bollingerStdDev: 5.1 },
    { trendFilterPeriod: 3 },
    { trendFilterPeriod: 4.5 },
    { trendFilterThreshold: 0 },
    { trendFilterThreshold: 0.51 },
    { leverage: 0 },
    { stopLossPct: 0 },
    { stopLossPct: 1 },
    { positionPct: 0 },
    { positionPct: 1.1 },
  ]) {
    assert.throws(
      () => rsiBollingerAdapter.parseParams({
        ...decisionParams,
        ...patch,
      }),
      /invalid strategy/i,
    );
  }
});

test('RSI Bollinger adapter enters mean-reversion positions', () => {
  assert.equal(rsiBollingerAdapter.decide(decisionParams, {
    prices: [10, 10, 10, 9],
    index: 3,
    position: 0,
    entryPrice: 0,
  }), 'long');
  assert.equal(rsiBollingerAdapter.decide(decisionParams, {
    prices: [10, 10, 10, 11],
    index: 3,
    position: 0,
    entryPrice: 0,
  }), 'short');
});

test('trend filter blocks wrong-way entries during strong trends', () => {
  const filtered = {
    ...decisionParams,
    trendFilterThreshold: 0.03,
  };

  assert.equal(rsiBollingerAdapter.decide(filtered, {
    prices: [10, 10, 10, 9],
    index: 3,
    position: 0,
    entryPrice: 0,
  }), 'hold');
  assert.equal(rsiBollingerAdapter.decide(filtered, {
    prices: [10, 10, 10, 11],
    index: 3,
    position: 0,
    entryPrice: 0,
  }), 'hold');
});

test('existing positions exit at the middle band or RSI 50', () => {
  assert.equal(rsiBollingerAdapter.decide(decisionParams, {
    prices: [10, 9, 10, 10],
    index: 3,
    position: 1,
    entryPrice: 9,
  }), 'flat');
  assert.equal(rsiBollingerAdapter.decide(decisionParams, {
    prices: [10, 11, 10, 10],
    index: 3,
    position: -1,
    entryPrice: 11,
  }), 'flat');
});

test('trend filter does not force an existing position to exit', () => {
  const filtered = {
    ...decisionParams,
    trendFilterThreshold: 0.03,
  };

  assert.equal(rsiBollingerAdapter.decide(filtered, {
    prices: [10, 10, 10, 9],
    index: 3,
    position: 1,
    entryPrice: 9.5,
  }), 'hold');
  assert.equal(rsiBollingerAdapter.decide(filtered, {
    prices: [10, 10, 10, 11],
    index: 3,
    position: -1,
    entryPrice: 10.5,
  }), 'hold');
});

test('RSI Bollinger adapter holds until all indicators are ready', () => {
  assert.equal(rsiBollingerAdapter.decide(decisionParams, {
    prices: [10, 9, 8],
    index: 2,
    position: 0,
    entryPrice: 0,
  }), 'hold');
});

test('RSI Bollinger adapter exposes failure-specific patches', () => {
  assert.deepEqual(
    rsiBollingerAdapter.targetedPatch(
      policyParams,
      ['liquidation'],
    ).patch,
    {
      leverage: 5,
      stopLossPct: 0.08,
    },
  );
  assert.deepEqual(
    rsiBollingerAdapter.targetedPatch(
      policyParams,
      ['drawdown-breach'],
    ).patch,
    { positionPct: 0.7 },
  );
  assert.deepEqual(
    rsiBollingerAdapter.targetedPatch(
      policyParams,
      ['stop-loss-bleed'],
    ).patch,
    {
      bollingerStdDev: 2.3,
      rsiOversold: 27,
      rsiOverbought: 73,
      trendFilterThreshold: 0.0255,
    },
  );
});

test('RSI Bollinger adapter exposes stable targets and labels', () => {
  assert.deepEqual(
    rsiBollingerAdapter.targetedFields(
      new Set(['liquidation', 'drawdown-breach', 'stop-loss-bleed']),
    ),
    [
      'leverage',
      'stopLossPct',
      'positionPct',
      'bollingerStdDev',
      'rsiOversold',
      'rsiOverbought',
      'trendFilterThreshold',
    ],
  );
  assert.equal(rsiBollingerAdapter.paramLabel('rsiPeriod'), 'RSI period');
  assert.equal(
    rsiBollingerAdapter.paramLabel('trendFilterThreshold'),
    'Trend-deviation threshold',
  );
});

test('RSI Bollinger jitter is deterministic, scoped, and valid', () => {
  const fields: readonly (keyof RsiBollingerParams)[] = [
    'rsiPeriod',
    'rsiOversold',
    'rsiOverbought',
    'bollingerPeriod',
    'bollingerStdDev',
    'trendFilterPeriod',
    'trendFilterThreshold',
    'leverage',
    'stopLossPct',
    'positionPct',
  ];
  const first = rsiBollingerAdapter.jitterParams(
    policyParams,
    mulberry32(9),
    fields,
  );
  const second = rsiBollingerAdapter.jitterParams(
    policyParams,
    mulberry32(9),
    fields,
  );

  assert.deepEqual(first, second);
  assert.doesNotThrow(() => rsiBollingerAdapter.parseParams(first));

  const riskOnly = rsiBollingerAdapter.jitterParams(
    policyParams,
    mulberry32(7),
    ['leverage', 'stopLossPct'],
  );
  assert.equal(riskOnly.rsiPeriod, policyParams.rsiPeriod);
  assert.equal(riskOnly.bollingerPeriod, policyParams.bollingerPeriod);
  assert.equal(
    riskOnly.trendFilterPeriod,
    policyParams.trendFilterPeriod,
  );
});

test('local registry composes both strategy adapters', () => {
  const registry = createStrategyRegistry([
    maCrossAdapter,
    rsiBollingerAdapter,
  ]);
  const strategy = registry.parse('rsi-bollinger-mean-reversion', {
    id: 'mean-reversion',
    name: 'RSI Bollinger mean reversion',
    universe: ['BTCUSDT'],
    timeframe: '1h',
  }, policyParams);

  assert.equal(strategy.archetype, 'rsi-bollinger-mean-reversion');
  assert.deepEqual(strategy.params, policyParams);
});

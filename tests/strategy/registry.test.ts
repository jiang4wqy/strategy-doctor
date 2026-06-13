import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/backtest/path.ts';
import type {
  MaCrossParams,
  StrategyArchetype,
} from '../../src/contracts.ts';
import { maCrossAdapter } from '../../src/strategy/adapters/ma-cross.ts';
import {
  createStrategyRegistry,
  getStrategyAdapter,
} from '../../src/strategy/registry.ts';

const params: MaCrossParams = {
  fastMA: 2,
  slowMA: 3,
  leverage: 10,
  stopLossPct: 0.5,
  positionPct: 1,
};

test('registry returns the registered moving-average adapter', () => {
  assert.equal(getStrategyAdapter('ma-cross').archetype, 'ma-cross');
});

test('registry rejects a known but unregistered archetype', () => {
  assert.throws(
    () => getStrategyAdapter('rsi-bollinger-mean-reversion'),
    /unsupported strategy archetype/i,
  );
});

test('registry rejects duplicate adapter registration', () => {
  assert.throws(
    () => createStrategyRegistry([maCrossAdapter, maCrossAdapter]),
    /duplicate strategy archetype/i,
  );
});

test('moving-average adapter validates parameters', () => {
  assert.deepEqual(maCrossAdapter.parseParams(params), params);

  for (const patch of [
    { fastMA: 1 },
    { fastMA: 2.5 },
    { slowMA: 2 },
    { slowMA: 3.5 },
    { leverage: 0 },
    { stopLossPct: 1 },
    { positionPct: 0 },
  ]) {
    assert.throws(
      () => maCrossAdapter.parseParams({ ...params, ...patch }),
      /invalid strategy/i,
    );
  }
});

test('moving-average adapter reproduces signal decisions', () => {
  assert.equal(maCrossAdapter.decide(params, {
    prices: [1, 2],
    index: 1,
    position: 0,
    entryPrice: 0,
  }), 'hold');
  assert.equal(maCrossAdapter.decide(params, {
    prices: [1, 2, 3, 4],
    index: 3,
    position: 0,
    entryPrice: 0,
  }), 'long');
  assert.equal(maCrossAdapter.decide(params, {
    prices: [4, 3, 2, 1],
    index: 3,
    position: 0,
    entryPrice: 0,
  }), 'short');
  assert.equal(maCrossAdapter.decide(params, {
    prices: [1, 1, 1],
    index: 2,
    position: 0,
    entryPrice: 0,
  }), 'hold');
});

test('moving-average adapter exposes its prescription policy', () => {
  assert.deepEqual(
    maCrossAdapter.targetedFields(
      new Set(['liquidation', 'stop-loss-bleed']),
    ),
    ['leverage', 'stopLossPct', 'fastMA', 'slowMA'],
  );
  assert.deepEqual(
    maCrossAdapter.targetedPatch(params, ['drawdown-breach']).patch,
    { positionPct: 0.7 },
  );
  assert.equal(maCrossAdapter.paramLabel('fastMA'), '快均线');

  const first = maCrossAdapter.jitterParams(
    params,
    mulberry32(7),
    ['leverage', 'stopLossPct'],
  );
  const second = maCrossAdapter.jitterParams(
    params,
    mulberry32(7),
    ['leverage', 'stopLossPct'],
  );
  assert.deepEqual(first, second);
  assert.equal(first.fastMA, params.fastMA);
  assert.equal(first.slowMA, params.slowMA);
});

test('registry constructs a typed strategy through its adapter', () => {
  const registry = createStrategyRegistry([maCrossAdapter]);
  const strategy = registry.parse('ma-cross', {
    id: 'ma',
    name: 'moving average',
    universe: ['BTCUSDT'],
    timeframe: '1h',
  }, params);

  assert.equal(strategy.archetype, 'ma-cross');
  assert.deepEqual(strategy.params, params);
  assert.deepEqual(
    Object.keys(strategy),
    ['id', 'name', 'archetype', 'params', 'universe', 'timeframe'],
  );
});

test('registry preserves discrimination for a runtime archetype', () => {
  const registry = createStrategyRegistry([maCrossAdapter]);
  const parseRuntimeArchetype = (archetype: StrategyArchetype) => {
    return registry.parse(archetype, {
      id: 'runtime',
      name: 'runtime strategy',
      universe: ['BTCUSDT'],
      timeframe: '1h',
    }, params);
  };

  const strategy = parseRuntimeArchetype('ma-cross');
  assert.equal(strategy.archetype, 'ma-cross');
  if (strategy.archetype === 'ma-cross') {
    assert.equal(strategy.params.fastMA, params.fastMA);
  }
});

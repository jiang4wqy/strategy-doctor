import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/backtest/path.ts';
import type {
  MaCrossParams,
  RsiBollingerParams,
  StrategyArchetype,
} from '../../src/contracts.ts';
import { maCrossAdapter } from '../../src/strategy/adapters/ma-cross.ts';
import { rsiBollingerAdapter } from '../../src/strategy/adapters/rsi-bollinger.ts';
import {
  createStrategyRegistry,
  getStrategyAdapter,
  strategyRegistry,
} from '../../src/strategy/registry.ts';

const params: MaCrossParams = {
  fastMA: 2,
  slowMA: 3,
  leverage: 10,
  stopLossPct: 0.5,
  positionPct: 1,
};

const meanReversionParams: RsiBollingerParams = {
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
  trendFilterPeriod: 50,
  trendFilterThreshold: 0.03,
  leverage: 3,
  stopLossPct: 0.05,
  positionPct: 0.5,
};

test('registry returns the registered moving-average adapter', () => {
  assert.equal(getStrategyAdapter('ma-cross').archetype, 'ma-cross');
});

test('registry returns the registered mean-reversion adapter', () => {
  assert.equal(
    getStrategyAdapter('rsi-bollinger-mean-reversion'),
    rsiBollingerAdapter,
  );
});

test('registry exposes immutable strategy capability definitions', () => {
  const definitions = strategyRegistry.listDefinitions();

  assert.equal(definitions.length, 2);
  assert.deepEqual(
    definitions.map(definition => definition.archetype),
    ['ma-cross', 'rsi-bollinger-mean-reversion'],
  );
  assert.equal(
    strategyRegistry.getDefinition('ma-cross').parameters[0].key,
    'fastMA',
  );
  assert.equal(
    strategyRegistry
      .getDefinition('rsi-bollinger-mean-reversion')
      .parameters[0].key,
    'rsiPeriod',
  );
  assert.ok(Object.isFrozen(definitions));
  assert.ok(Object.isFrozen(definitions[0]));
  assert.ok(Object.isFrozen(definitions[0].parameters));
  for (const definition of definitions) {
    assert.ok(
      definition.parameters.every(parameter => Object.isFrozen(parameter)),
    );
    assert.ok(Object.isFrozen(definition.example));
    assert.ok(Object.isFrozen(definition.example.params));
    assert.ok(Object.isFrozen(definition.example.universe));
  }
});

test('registry capability bounds match exclusive RSI parser limits', () => {
  const definition = strategyRegistry.getDefinition(
    'rsi-bollinger-mean-reversion',
  );
  const oversold = definition.parameters.find(
    parameter => parameter.key === 'rsiOversold',
  );
  const overbought = definition.parameters.find(
    parameter => parameter.key === 'rsiOverbought',
  );

  assert.equal(oversold?.maximum, 50);
  assert.equal(oversold?.exclusiveMaximum, true);
  assert.equal(overbought?.maximum, 100);
  assert.equal(overbought?.exclusiveMaximum, true);
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
  const combined = maCrossAdapter.targetedPatch(params, [
    'liquidation',
    'drawdown-breach',
    'stop-loss-bleed',
  ]);
  assert.deepEqual(combined.patch, {
    leverage: 5,
    stopLossPct: 0.08,
    positionPct: 0.7,
    fastMA: 3,
    slowMA: 5,
  });
  assert.deepEqual(combined.rationale, [
    'Reduce leverage and tighten stop-loss to within half of the liquidation line.',
    'Lower position exposure to reduce drawdown pressure.',
    'Slow moving averages by 1.5x to reduce whipsaw entries and stop-loss bleed.',
  ]);
  assert.equal(maCrossAdapter.paramLabel('fastMA'), 'fastMA');

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

  const allFields = maCrossAdapter.jitterParams(
    params,
    mulberry32(9),
    ['fastMA', 'slowMA', 'leverage', 'stopLossPct', 'positionPct'],
  );
  assert.doesNotThrow(() => maCrossAdapter.parseParams(allFields));
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

test('default registry constructs the enhanced mean-reversion strategy', () => {
  const strategy = {
    id: 'mean-reversion',
    name: 'RSI Bollinger mean reversion',
    universe: ['BTCUSDT'],
    timeframe: '4h',
  };
  const parsed = {
    ...strategy,
    archetype: 'rsi-bollinger-mean-reversion' as const,
    params: getStrategyAdapter(
      'rsi-bollinger-mean-reversion',
    ).parseParams(meanReversionParams),
  };

  assert.equal(parsed.archetype, 'rsi-bollinger-mean-reversion');
  assert.deepEqual(parsed.params, meanReversionParams);
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

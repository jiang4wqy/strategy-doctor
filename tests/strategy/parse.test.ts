import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StrategyValidationError } from '../../src/contracts.ts';
import { parseStrategy } from '../../src/strategy/parse.ts';

const validStrategy = {
  id: 'tf-001',
  name: '高杠杆趋势跟随',
  archetype: 'ma-cross',
  params: {
    fastMA: 8,
    slowMA: 30,
    leverage: 10,
    stopLossPct: 0.5,
    positionPct: 1,
  },
  universe: ['BTCUSDT'],
  timeframe: '1h',
};

const validMeanReversionStrategy = {
  id: 'mr-001',
  name: 'RSI Bollinger 均值回归',
  archetype: 'rsi-bollinger-mean-reversion',
  params: {
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
  },
  universe: ['BTCUSDT'],
  timeframe: '4h',
};

const validBreakoutStrategy = {
  id: 'bo-001',
  name: 'BTC confirmed breakout',
  archetype: 'breakout-confirmation',
  params: {
    breakoutLookback: 24,
    confirmationBars: 2,
    exitLookback: 8,
    volatilityLookback: 12,
    minBreakoutPct: 0.012,
    minVolatilityPct: 0.002,
    leverage: 4,
    stopLossPct: 0.08,
    positionPct: 0.55,
  },
  universe: ['BTCUSDT'],
  timeframe: '1h',
};

test('parseStrategy accepts a valid moving-average strategy', () => {
  assert.deepEqual(parseStrategy(validStrategy), validStrategy);
});

test('parseStrategy normalizes a single USDT symbol to uppercase', () => {
  const parsed = parseStrategy({
    ...validStrategy,
    universe: [' btcusdt '],
  });

  assert.deepEqual(parsed.universe, ['BTCUSDT']);
});

test('parseStrategy accepts the enhanced mean-reversion strategy', () => {
  const strategy = parseStrategy(validMeanReversionStrategy);

  assert.deepEqual(strategy, validMeanReversionStrategy);
  assert.equal(
    strategy.params.trendFilterPeriod,
    validMeanReversionStrategy.params.trendFilterPeriod,
  );
  assert.equal(
    strategy.params.trendFilterThreshold,
    validMeanReversionStrategy.params.trendFilterThreshold,
  );
});

test('parseStrategy accepts a confirmed breakout strategy', () => {
  const strategy = parseStrategy(validBreakoutStrategy);

  assert.deepEqual(strategy, validBreakoutStrategy);
  assert.equal(strategy.params.breakoutLookback, 24);
  assert.equal(strategy.params.confirmationBars, 2);
});

test('parseStrategy rejects malformed identity and market fields', () => {
  for (const invalid of [
    { ...validStrategy, id: ' ' },
    { ...validStrategy, name: '' },
    { ...validStrategy, archetype: 'grid' },
    { ...validStrategy, universe: [] },
    { ...validStrategy, universe: ['BTCUSDT', ' '] },
  ]) {
    assert.throws(() => parseStrategy(invalid), /strategy/i);
  }
});

test('parseStrategy rejects unsupported market boundaries with stable codes', () => {
  assert.throws(
    () => parseStrategy({
      ...validStrategy,
      universe: ['BTCUSDT', 'ETHUSDT'],
    }),
    (error: unknown) => (
      error instanceof StrategyValidationError
      && error.code === 'MULTI_SYMBOL_UNSUPPORTED'
      && error.field === 'strategy.universe'
    ),
  );
  assert.throws(
    () => parseStrategy({
      ...validStrategy,
      universe: ['BTCUSD'],
    }),
    (error: unknown) => (
      error instanceof StrategyValidationError
      && error.code === 'UNSUPPORTED_SYMBOL'
      && error.field === 'strategy.universe.0'
    ),
  );
  assert.throws(
    () => parseStrategy({
      ...validStrategy,
      timeframe: '15m',
    }),
    (error: unknown) => (
      error instanceof StrategyValidationError
      && error.code === 'UNSUPPORTED_TIMEFRAME'
      && error.field === 'strategy.timeframe'
    ),
  );
});

test('parseStrategy rejects invalid parameter invariants', () => {
  const invalidParams = [
    { fastMA: 1 },
    { fastMA: 8.5 },
    { slowMA: 8 },
    { slowMA: 30.5 },
    { leverage: 0.9 },
    { leverage: Number.POSITIVE_INFINITY },
    { stopLossPct: 0 },
    { stopLossPct: 1 },
    { positionPct: 0 },
    { positionPct: 1.01 },
  ];

  for (const patch of invalidParams) {
    assert.throws(
      () => parseStrategy({
        ...validStrategy,
        params: { ...validStrategy.params, ...patch },
      }),
      /strategy/i,
    );
  }
});

test('parseStrategy rejects invalid breakout invariants', () => {
  for (const patch of [
    { breakoutLookback: 4 },
    { confirmationBars: 0 },
    { exitLookback: 24 },
    { volatilityLookback: 2 },
    { minBreakoutPct: 0 },
    { minVolatilityPct: -0.1 },
  ]) {
    assert.throws(
      () => parseStrategy({
        ...validBreakoutStrategy,
        params: { ...validBreakoutStrategy.params, ...patch },
      }),
      /strategy/i,
    );
  }
});

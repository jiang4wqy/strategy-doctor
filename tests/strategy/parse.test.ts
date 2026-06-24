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

test('parseStrategy accepts a valid moving-average strategy', () => {
  assert.deepEqual(parseStrategy(validStrategy), validStrategy);
});

test('parseStrategy preserves optional backtest data selection', () => {
  const parsed = parseStrategy({
    id: 'ma-window',
    name: 'MA with market window',
    archetype: 'ma-cross',
    params: {
      fastMA: 8,
      slowMA: 30,
      leverage: 3,
      stopLossPct: 0.1,
      positionPct: 0.5,
    },
    universe: ['ethusdt'],
    timeframe: '4H',
    backtest: {
      source: 'bitget-public',
      candleLimit: 360,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
    },
    execution: {
      feeRatePct: 0.001,
      slippagePct: 0.0007,
    },
  });

  assert.deepEqual(parsed.backtest, {
    source: 'bitget-public',
    candleLimit: 360,
    startDate: '2026-01-01',
    endDate: '2026-06-01',
  });
  assert.deepEqual(parsed.universe, ['ETHUSDT']);
  assert.equal(parsed.timeframe, '4h');
  assert.deepEqual(parsed.execution, {
    feeRatePct: 0.001,
    slippagePct: 0.0007,
  });
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

test('parseStrategy rejects malformed identity and market fields', () => {
  for (const invalid of [
    { ...validStrategy, id: ' ' },
    { ...validStrategy, name: '' },
    { ...validStrategy, archetype: 'grid' },
    { ...validStrategy, universe: [] },
    { ...validStrategy, universe: ['BTCUSDT', ' '] },
    { ...validStrategy, execution: { feeRatePct: 0.03 } },
    { ...validStrategy, execution: { slippagePct: -0.01 } },
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

test('parseStrategy enforces symbol-specific and global date boundaries', () => {
  assert.throws(
    () => parseStrategy({
      ...validStrategy,
      universe: ['ETHUSDT'],
      backtest: {
        startDate: '2014-01-01',
        endDate: '2016-01-01',
      },
    }),
    (error: unknown) => (
      error instanceof StrategyValidationError
      && error.code === 'INVALID_REQUEST'
      && error.field === 'strategy.backtest.startDate'
    ),
  );

  const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  assert.throws(
    () => parseStrategy({
      ...validStrategy,
      backtest: {
        startDate: futureDate,
      },
    }),
    (error: unknown) => (
      error instanceof StrategyValidationError
      && error.code === 'INVALID_REQUEST'
      && error.field === 'strategy.backtest.startDate'
    ),
  );
  assert.throws(
    () => parseStrategy({
      ...validStrategy,
      backtest: {
        endDate: futureDate,
      },
    }),
    (error: unknown) => (
      error instanceof StrategyValidationError
      && error.code === 'INVALID_REQUEST'
      && error.field === 'strategy.backtest.endDate'
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    { ...validStrategy, timeframe: '' },
  ]) {
    assert.throws(() => parseStrategy(invalid), /strategy/i);
  }
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

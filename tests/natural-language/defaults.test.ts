import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultStrategy,
} from '../../src/natural-language/defaults.ts';
import { DescriptionParseError } from '../../src/natural-language/errors.ts';
import { strategyRegistry } from '../../src/strategy/registry.ts';

test('buildDefaultStrategy copies RSI defaults from capability metadata', () => {
  const strategy = buildDefaultStrategy(
    'rsi-bollinger-mean-reversion',
    { symbol: 'BTCUSDT', timeframe: '4h' },
  );
  const definition = strategyRegistry.getDefinition(
    'rsi-bollinger-mean-reversion',
  );

  assert.equal(strategy.id, 'natural-rsi-bollinger-mean-reversion');
  assert.equal(strategy.params.rsiPeriod, 10);
  assert.equal(strategy.params.bollingerPeriod, 14);
  assert.equal(strategy.params.trendFilterPeriod, 30);
  assert.deepEqual(strategy.universe, ['BTCUSDT']);
  for (const parameter of definition.parameters) {
    assert.equal(
      strategy.params[parameter.key],
      parameter.defaultValue,
    );
  }
});

test('buildDefaultStrategy applies deterministic market defaults and clones data', () => {
  const first = buildDefaultStrategy('ma-cross');
  const second = buildDefaultStrategy('ma-cross');
  const definition = strategyRegistry.getDefinition('ma-cross');

  assert.deepEqual(first, second);
  assert.deepEqual(first.universe, ['BTCUSDT']);
  assert.equal(first.timeframe, '4h');
  assert.notEqual(first.params, definition.example.params);
  assert.notEqual(first.universe, definition.example.universe);
});

test('buildDefaultStrategy copies breakout defaults from capability metadata', () => {
  const strategy = buildDefaultStrategy('breakout-confirmation');
  const definition = strategyRegistry.getDefinition('breakout-confirmation');

  assert.equal(strategy.id, 'natural-breakout-confirmation');
  assert.equal(strategy.params.breakoutLookback, 24);
  assert.equal(strategy.params.confirmationBars, 2);
  for (const parameter of definition.parameters) {
    assert.equal(strategy.params[parameter.key], parameter.defaultValue);
  }
});

test('DescriptionParseError preserves stable parser details', () => {
  const error = new DescriptionParseError(
    'UNSUPPORTED_STRATEGY_DESCRIPTION',
    'Only registered strategies are supported.',
    true,
  );

  assert.equal(error.code, 'UNSUPPORTED_STRATEGY_DESCRIPTION');
  assert.equal(error.aiFallbackAllowed, true);
  assert.equal(error.message, 'Only registered strategies are supported.');
});

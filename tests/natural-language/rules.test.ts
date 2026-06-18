import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DescriptionParseError } from '../../src/natural-language/errors.ts';
import { parseWithRules } from '../../src/natural-language/rules.ts';

test('parseWithRules extracts equivalent English and Chinese MA strategies', () => {
  const english = parseWithRules(
    'BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30, '
    + '5x leverage, 10% stop loss, 60% position.',
  );
  const chinese = parseWithRules(
    'BTC 一小时均线交叉，快线 8，慢线 30，5 倍杠杆，止损 10%，仓位 60%。',
  );

  for (const draft of [english, chinese]) {
    assert.equal(draft.strategy.archetype, 'ma-cross');
    if (draft.strategy.archetype !== 'ma-cross') {
      assert.fail('expected moving-average strategy');
    }
    assert.deepEqual(draft.strategy.params, {
      fastMA: 8,
      slowMA: 30,
      leverage: 5,
      stopLossPct: 0.1,
      positionPct: 0.6,
    });
    assert.deepEqual(draft.strategy.universe, ['BTCUSDT']);
    assert.equal(draft.strategy.timeframe, '1h');
    assert.equal(draft.source, 'rules');
    assert.equal(draft.warnings.length, 0);
  }
});

test('parseWithRules extracts equivalent RSI Bollinger strategies', () => {
  const english = parseWithRules(
    'BTC 4h RSI 10 with Bollinger period 14 and 1.75 standard deviations, '
    + 'oversold 30, overbought 70, trend filter 30 with 5% threshold.',
  );
  const chinese = parseWithRules(
    'BTC 四小时 RSI 10 配合布林带 14、1.75 倍标准差，超卖 30、超买 70，'
    + '趋势过滤周期 30，偏离阈值 5%。',
  );

  for (const draft of [english, chinese]) {
    assert.equal(
      draft.strategy.archetype,
      'rsi-bollinger-mean-reversion',
    );
    if (draft.strategy.archetype !== 'rsi-bollinger-mean-reversion') {
      assert.fail('expected RSI Bollinger strategy');
    }
    assert.equal(draft.strategy.params.rsiPeriod, 10);
    assert.equal(draft.strategy.params.bollingerPeriod, 14);
    assert.equal(draft.strategy.params.bollingerStdDev, 1.75);
    assert.equal(draft.strategy.params.rsiOversold, 30);
    assert.equal(draft.strategy.params.rsiOverbought, 70);
    assert.equal(draft.strategy.params.trendFilterPeriod, 30);
    assert.equal(draft.strategy.params.trendFilterThreshold, 0.05);
    assert.equal(draft.strategy.timeframe, '4h');
  }
});

test('parseWithRules extracts confirmed breakout strategies', () => {
  const draft = parseWithRules(
    'BTCUSDT 1h confirmed breakout, breakout lookback 24, '
    + 'confirmation bars 2, exit lookback 8, volatility lookback 12, '
    + 'minimum breakout 1.2%, minimum volatility 0.2%, 4x leverage, '
    + '8% stop loss, 55% position.',
  );

  assert.equal(draft.strategy.archetype, 'breakout-confirmation');
  if (draft.strategy.archetype !== 'breakout-confirmation') {
    assert.fail('expected breakout strategy');
  }
  assert.deepEqual(draft.strategy.params, {
    breakoutLookback: 24,
    confirmationBars: 2,
    exitLookback: 8,
    volatilityLookback: 12,
    minBreakoutPct: 0.012,
    minVolatilityPct: 0.002,
    leverage: 4,
    stopLossPct: 0.08,
    positionPct: 0.55,
  });
  assert.equal(draft.strategy.timeframe, '1h');
  assert.equal(draft.source, 'rules');
  assert.equal(draft.warnings.length, 0);
});

test('parseWithRules reports ambiguous and forbidden descriptions', () => {
  assert.throws(
    () => parseWithRules('combine MA crossover and RSI Bollinger'),
    (error: unknown) => (
      error instanceof DescriptionParseError
      && error.code === 'AMBIGUOUS_DESCRIPTION'
      && error.aiFallbackAllowed === false
    ),
  );
  assert.throws(
    () => parseWithRules('write and execute a custom grid trading bot'),
    (error: unknown) => (
      error instanceof DescriptionParseError
      && error.code === 'UNSUPPORTED_STRATEGY_DESCRIPTION'
      && error.aiFallbackAllowed === false
    ),
  );
  assert.throws(
    () => parseWithRules('a strategy that buys dips'),
    (error: unknown) => (
      error instanceof DescriptionParseError
      && error.code === 'UNSUPPORTED_STRATEGY_DESCRIPTION'
      && error.aiFallbackAllowed === true
    ),
  );
});

test('parseWithRules records defaults and warns on low-confidence MA text', () => {
  const draft = parseWithRules('BTC moving average strategy');

  assert.equal(draft.strategy.archetype, 'ma-cross');
  assert.ok(draft.confidence < 0.75);
  assert.deepEqual(draft.warnings.map(warning => warning.code), [
    'LOW_CONFIDENCE',
  ]);
  assert.ok(draft.assumptions.some(
    assumption => assumption.field === 'strategy.params.fastMA',
  ));
  assert.ok(draft.assumptions.some(
    assumption => (
      assumption.field === 'strategy.timeframe'
      && assumption.reason === 'market-default'
    ),
  ));
  assert.ok(!draft.assumptions.some(
    assumption => assumption.field === 'strategy.universe.0',
  ));
});

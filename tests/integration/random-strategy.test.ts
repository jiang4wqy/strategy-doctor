import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStrategy } from '../../src/strategy/parse.ts';
import { randomStrategyDraft } from '../../web/src/strategy-playground.ts';

test('random strategy generator emits parser-supported strategies', () => {
  const supportedTimeframes = new Set(['1h', '4h', '1d']);
  for (let index = 0; index < 100; index++) {
    const draft = randomStrategyDraft();
    const strategy = parseStrategy(draft.strategy);

    assert.ok(strategy.universe[0].endsWith('USDT'));
    assert.ok(supportedTimeframes.has(strategy.timeframe));
    assert.ok(
      strategy.archetype === 'ma-cross'
        || strategy.archetype === 'rsi-bollinger-mean-reversion',
    );
  }
});

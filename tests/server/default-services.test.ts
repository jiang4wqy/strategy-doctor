import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultServices,
} from '../../src/server/default-services.ts';

test('default services expose registered capabilities and local parsing', async () => {
  const services = createDefaultServices();

  assert.equal(services.capabilities().length, 2);
  const draft = await services.parse(
    'BTC 4小时 RSI 14 配合布林带 20 和趋势过滤器 50',
  );
  assert.equal(
    draft.strategy.archetype,
    'rsi-bollinger-mean-reversion',
  );
  assert.ok(services.factors().factors.length > 0);
  assert.ok(services.notebooks().templates.length > 0);
  assert.ok(services.multiFactorFramework().outputs.length > 0);
});

test('default diagnosis service returns the shared diagnosis result', async () => {
  const services = createDefaultServices();
  const result = await services.diagnose({
    strategy: {
      id: 'default-service-ma',
      name: 'Default service MA',
      archetype: 'ma-cross',
      params: {
        fastMA: 8,
        slowMA: 30,
        leverage: 5,
        stopLossPct: 0.1,
        positionPct: 0.6,
      },
      universe: ['BTCUSDT'],
      timeframe: '1h',
    },
    style: 'conservative',
    seed: 42,
    candidates: 1,
  });

  assert.equal(result.scorecard.evaluations.length, 5);
  assert.equal(result.view.scorecard, result.scorecard);
});

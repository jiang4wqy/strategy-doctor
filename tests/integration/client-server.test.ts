import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStrategyDoctor,
} from '../../src/client/index.ts';
import { buildServer } from '../../src/server/app.ts';

test('typed client completes the real API workflow', async t => {
  const app = await buildServer({
    env: {
      DOCTOR_API_KEYS: 'integration-agent-key',
      DOCTOR_STATIC_ROOT: 'intentionally-missing-build',
    },
  });
  t.after(() => app.close());
  const address = await app.listen({
    host: '127.0.0.1',
    port: 0,
  });
  const client = createStrategyDoctor({
    baseUrl: address,
    apiKey: 'integration-agent-key',
  });

  const capabilities = await client.capabilities();
  const draft = await client.parseStrategy({
    description:
      'BTC 4h RSI 14 with Bollinger period 20 and trend filter 50',
  });
  const view = await client.diagnose({
    strategy: draft.strategy,
    style: 'conservative',
    seed: 42,
    candidates: 6,
  });

  assert.equal(capabilities.length, 4);
  assert.ok(capabilities.some(
    capability => capability.archetype === 'atr-trend-breakout',
  ));
  assert.equal(
    draft.strategy.archetype,
    'rsi-bollinger-mean-reversion',
  );
  assert.equal(view.scorecard.evaluations.length, 5);
  assert.equal(view.charts.riskRadar.length, 5);
  assert.ok(view.charts.treatmentEquity.every(
    series => series.equity.length > 0,
  ));
});

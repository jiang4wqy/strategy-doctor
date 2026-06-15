import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DescriptionParseError } from '../../src/natural-language/errors.ts';
import type { StrategyDraft } from '../../src/platform/contracts.ts';
import { buildServer } from '../../src/server/app.ts';

const bearer = {
  authorization: 'Bearer parse-test-key',
  'content-type': 'application/json',
};

const rsiDraft: StrategyDraft = {
  strategy: {
    id: 'rsi-bollinger-natural-language',
    name: 'RSI Bollinger natural-language strategy',
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
      stopLossPct: 0.08,
      positionPct: 0.5,
    },
    universe: ['BTCUSDT'],
    timeframe: '4h',
  },
  source: 'rules',
  confidence: 0.92,
  assumptions: [],
  warnings: [],
};

async function buildFixture() {
  const app = await buildServer({
    env: {
      DOCTOR_API_KEYS: 'parse-test-key',
      DOCTOR_STATIC_ROOT: 'missing-web-build',
    },
    services: {
      parse: async description => {
        if (description === 'ambiguous') {
          throw new DescriptionParseError(
            'AMBIGUOUS_DESCRIPTION',
            'The description names more than one strategy archetype.',
          );
        }
        if (description === 'unsupported') {
          throw new DescriptionParseError(
            'UNSUPPORTED_STRATEGY_DESCRIPTION',
            'The description does not match a supported strategy.',
          );
        }
        return rsiDraft;
      },
    },
  });
  await app.ready();
  return app;
}

test('parse route requires authentication', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/strategies/parse',
    headers: { 'content-type': 'application/json' },
    payload: { description: 'BTC 4小时 RSI 配合布林带均值回归' },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'AUTH_REQUIRED');
});

test('parse route validates the 2000-character description limit', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/strategies/parse',
    headers: bearer,
    payload: { description: 'x'.repeat(2001) },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'INVALID_REQUEST');
});

test('parse route returns a StrategyDraft envelope for Chinese RSI text', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/strategies/parse',
    headers: bearer,
    payload: { description: 'BTC 4小时 RSI 配合布林带均值回归' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().apiVersion, 'v1');
  assert.match(response.json().requestId, /^req_/);
  assert.deepEqual(response.json().data, rsiDraft);
});

test('parse route maps ambiguous and unsupported descriptions', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const ambiguous = await app.inject({
    method: 'POST',
    url: '/api/v1/strategies/parse',
    headers: bearer,
    payload: { description: 'ambiguous' },
  });
  assert.equal(ambiguous.statusCode, 400);
  assert.equal(
    ambiguous.json().error.code,
    'AMBIGUOUS_DESCRIPTION',
  );

  const unsupported = await app.inject({
    method: 'POST',
    url: '/api/v1/strategies/parse',
    headers: bearer,
    payload: { description: 'unsupported' },
  });
  assert.equal(unsupported.statusCode, 422);
  assert.equal(
    unsupported.json().error.code,
    'UNSUPPORTED_STRATEGY_DESCRIPTION',
  );
});

test('parse route rate limits the twenty-first request in one minute', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  for (let index = 0; index < 20; index++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/strategies/parse',
      headers: bearer,
      payload: { description: `RSI request ${index}` },
    });
    assert.equal(response.statusCode, 200);
  }

  const limited = await app.inject({
    method: 'POST',
    url: '/api/v1/strategies/parse',
    headers: bearer,
    payload: { description: 'RSI request 21' },
  });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, 'RATE_LIMITED');
});

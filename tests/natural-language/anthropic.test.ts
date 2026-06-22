import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWithAnthropic,
} from '../../src/natural-language/anthropic.ts';

const enabledEnv = {
  DOCTOR_NL_AI_ENABLED: '1',
  ANTHROPIC_API_KEY: 'test-key',
  DOCTOR_NL_MODEL: 'test-model',
};

const validStrategy = {
  id: 'ai-rsi',
  name: 'AI parsed RSI Bollinger',
  archetype: 'rsi-bollinger-mean-reversion',
  params: {
    rsiPeriod: 10,
    rsiOversold: 30,
    rsiOverbought: 70,
    bollingerPeriod: 14,
    bollingerStdDev: 1.75,
    trendFilterPeriod: 30,
    trendFilterThreshold: 0.05,
    leverage: 3,
    stopLossPct: 0.05,
    positionPct: 0.5,
  },
  universe: ['BTCUSDT'],
  timeframe: '4h',
};

function anthropicResponse(payload: unknown): Response {
  return new Response(JSON.stringify({
    content: [{
      type: 'text',
      text: JSON.stringify(payload),
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('parseWithAnthropic stays disabled without complete opt-in', async () => {
  let called = false;
  const result = await parseWithAnthropic('RSI Bollinger', {
    env: {
      DOCTOR_NL_AI_ENABLED: '0',
      ANTHROPIC_API_KEY: 'test-key',
      DOCTOR_NL_MODEL: 'test-model',
    },
    fetch: async () => {
      called = true;
      throw new Error('must not call');
    },
  });

  assert.equal(result, undefined);
  assert.equal(called, false);
});

test('parseWithAnthropic sends only capability-constrained JSON instructions', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const result = await parseWithAnthropic('BTC 4h RSI Bollinger', {
    env: enabledEnv,
    fetch: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return anthropicResponse({
        strategy: validStrategy,
        explicitFields: [
          'strategy.universe.0',
          'strategy.timeframe',
        ],
      });
    },
  });

  assert.equal(result?.source, 'anthropic');
  assert.equal(
    result?.strategy.archetype,
    'rsi-bollinger-mean-reversion',
  );
  const system = String(requestBody?.system);
  assert.match(system, /JSON only/i);
  assert.match(system, /do not generate source code/i);
  assert.match(system, /"ma-cross"/);
  assert.match(system, /"rsi-bollinger-mean-reversion"/);
  assert.match(system, /"breakout-confirmation"/);
  assert.doesNotMatch(system, /snapshot|account|position history/i);
  assert.ok(result?.assumptions.some(
    assumption => assumption.field === 'strategy.params.rsiPeriod',
  ));
});

test('parseWithAnthropic rejects unsafe or invalid model output', async () => {
  const cases: Array<() => Promise<Response>> = [
    async () => new Response('{invalid json', { status: 200 }),
    async () => anthropicResponse({
      strategy: { ...validStrategy, archetype: 'grid' },
      explicitFields: [],
    }),
    async () => anthropicResponse({
      strategy: {
        ...validStrategy,
        params: { ...validStrategy.params, rsiPeriod: 1 },
      },
      explicitFields: ['strategy.params.rsiPeriod'],
    }),
    async () => anthropicResponse({
      strategy: {
        ...validStrategy,
        params: { ...validStrategy.params, leverage: 4 },
      },
      explicitFields: [],
    }),
    async () => new Response('unavailable', { status: 503 }),
  ];

  for (const fetchCase of cases) {
    assert.equal(await parseWithAnthropic('description', {
      env: enabledEnv,
      fetch: fetchCase,
    }), undefined);
  }
});

test('parseWithAnthropic aborts at the configured timeout', async () => {
  let aborted = false;
  const result = await parseWithAnthropic('description', {
    env: enabledEnv,
    timeoutMs: 5,
    fetch: async (_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('aborted'));
        });
      });
    },
  });

  assert.equal(result, undefined);
  assert.equal(aborted, true);
});

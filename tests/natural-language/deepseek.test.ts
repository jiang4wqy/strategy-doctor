import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWithDeepSeek,
} from '../../src/natural-language/deepseek.ts';

const enabledEnv = {
  DOCTOR_NL_AI_ENABLED: '1',
  DOCTOR_NL_DEEPSEEK_ENABLED: '1',
  DEEPSEEK_API_KEY: 'test-key',
  DOCTOR_DEEPSEEK_MODEL: 'deepseek-test-model',
};

const validStrategy = {
  id: 'ai-deepseek',
  name: 'AI parsed MA',
  archetype: 'ma-cross',
  params: {
    fastMA: 8,
    slowMA: 30,
    leverage: 10,
    stopLossPct: 0.5,
    positionPct: 1,
  },
  universe: ['BTCUSDT'],
  timeframe: '4h',
};

function deepseekResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        role: 'assistant',
        content: JSON.stringify(payload),
      },
    }],
  }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('parseWithDeepSeek stays disabled without complete opt-in', async () => {
  let called = false;
  const result = await parseWithDeepSeek('moving average strategy', {
    env: {
      DOCTOR_NL_AI_ENABLED: '0',
      DOCTOR_NL_DEEPSEEK_ENABLED: '0',
      DEEPSEEK_API_KEY: 'test-key',
      DOCTOR_DEEPSEEK_MODEL: 'deepseek-test-model',
    },
    fetch: async () => {
      called = true;
      throw new Error('must not call');
    },
  });

  assert.equal(result, undefined);
  assert.equal(called, false);
});

test('parseWithDeepSeek accepts compatible chat JSON payload', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const result = await parseWithDeepSeek('BTCUSDT 1h MA 8 and 30', {
    env: enabledEnv,
    baseUrl: 'https://api.deepseek.example/chat/completions',
    fetch: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return deepseekResponse({
        strategy: validStrategy,
        explicitFields: [
          'strategy.universe.0',
          'strategy.timeframe',
        ],
      });
    },
  });

  assert.equal(result?.source, 'deepseek');
  assert.equal(result?.strategy.archetype, 'ma-cross');
  assert.equal(requestBody?.model, 'deepseek-test-model');
  assert.deepEqual(requestBody?.response_format, { type: 'json_object' });
  const messages = requestBody?.messages as Array<{ role: string; content: string }>;
  assert.equal(messages[0]?.role, 'system');
  assert.equal(messages[1]?.role, 'user');
});

test('parseWithDeepSeek rejects malformed or unsafe output', async () => {
  const cases: Array<() => Promise<Response>> = [
    async () => new Response('{invalid json', { status: 200 }),
    async () => deepseekResponse({
      strategy: { ...validStrategy, archetype: 'grid' },
      explicitFields: [],
    }),
    async () => deepseekResponse({
      strategy: {
        ...validStrategy,
        params: { ...validStrategy.params, fastMA: 1 },
      },
      explicitFields: ['strategy.params.fastMA'],
    }),
    async () => deepseekResponse({
      strategy: {
        ...validStrategy,
        params: { ...validStrategy.params, leverage: 4 },
      },
      explicitFields: [],
    }),
    async () => new Response('unavailable', { status: 503 }),
  ];

  for (const fetchCase of cases) {
    assert.equal(await parseWithDeepSeek('description', {
      env: enabledEnv,
      fetch: fetchCase,
    }), undefined);
  }
});

test('parseWithDeepSeek respects timeout abort', async () => {
  let aborted = false;
  const result = await parseWithDeepSeek('description', {
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

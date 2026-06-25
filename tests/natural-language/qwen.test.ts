import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWithQwen,
} from '../../src/natural-language/qwen.ts';

const enabledEnv = {
  DOCTOR_NL_AI_ENABLED: '1',
  DOCTOR_NL_QWEN_ENABLED: '1',
  QWEN_API_KEY: 'test-key',
  DOCTOR_QWEN_MODEL: 'qwen-test-model',
};

const validStrategy = {
  id: 'ai-qwen',
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

function qwenResponse(payload: unknown, status = 200): Response {
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

test('parseWithQwen stays disabled without complete opt-in', async () => {
  let called = false;
  const result = await parseWithQwen('moving average strategy', {
    env: {
      DOCTOR_NL_AI_ENABLED: '0',
      DOCTOR_NL_QWEN_ENABLED: '0',
      QWEN_API_KEY: 'test-key',
      DOCTOR_QWEN_MODEL: 'qwen-test-model',
    },
    fetch: async () => {
      called = true;
      throw new Error('must not call');
    },
  });

  assert.equal(result, undefined);
  assert.equal(called, false);
});

test('parseWithQwen reads BITGET_QWEN_API_KEY fallback', async () => {
  let called = false;
  const result = await parseWithQwen('moving average strategy', {
    env: {
      DOCTOR_NL_AI_ENABLED: '1',
      DOCTOR_NL_QWEN_ENABLED: '1',
      BITGET_QWEN_API_KEY: 'fallback-key',
      DOCTOR_QWEN_MODEL: 'qwen-test-model',
    },
    fetch: async () => {
      called = true;
      return qwenResponse({
        strategy: {
          id: 'ai-fallback',
          name: 'AI',
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
        },
        explicitFields: [
          'strategy.universe.0',
          'strategy.timeframe',
        ],
      });
    },
  });

  assert.equal(result?.source, 'qwen');
  assert.equal(called, true);
});

test('parseWithQwen accepts compatible chat JSON payload', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const result = await parseWithQwen('BTCUSDT 1h MA 8 and 30', {
    env: enabledEnv,
    baseUrl: 'https://api.qwen.example/v1/chat/completions',
    fetch: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return qwenResponse({
        strategy: validStrategy,
        explicitFields: [
          'strategy.universe.0',
          'strategy.timeframe',
        ],
      });
    },
  });

  assert.equal(result?.source, 'qwen');
  assert.equal(result?.strategy.archetype, 'ma-cross');
  assert.equal(requestBody?.model, 'qwen-test-model');
  const messages = requestBody?.messages as Array<{ role: string; content: string }>;
  assert.equal(messages[0]?.role, 'system');
  assert.equal(messages[1]?.role, 'user');
});

test('parseWithQwen rejects malformed or unsafe output', async () => {
  const cases: Array<() => Promise<Response>> = [
    async () => new Response('{invalid json', { status: 200 }),
    async () => qwenResponse({
      strategy: { ...validStrategy, archetype: 'grid' },
      explicitFields: [],
    }),
    async () => qwenResponse({
      strategy: {
        ...validStrategy,
        params: { ...validStrategy.params, fastMA: 1 },
      },
      explicitFields: ['strategy.params.fastMA'],
    }),
    async () => qwenResponse({
      strategy: {
        ...validStrategy,
        params: { ...validStrategy.params, leverage: 4 },
      },
      explicitFields: [],
    }),
    async () => new Response('unavailable', { status: 503 }),
  ];

  for (const fetchCase of cases) {
    assert.equal(await parseWithQwen('description', {
      env: enabledEnv,
      fetch: fetchCase,
    }), undefined);
  }
});

test('parseWithQwen respects timeout abort', async () => {
  let aborted = false;
  const result = await parseWithQwen('description', {
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

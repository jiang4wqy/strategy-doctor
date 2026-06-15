import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStrategyDoctor,
} from '../../src/client/index.ts';
import { StrategyDoctorApiError } from '../../src/client/error.ts';
import type { DiagnoseRequest } from '../../src/platform/contracts.ts';

const requestFixture: DiagnoseRequest = {
  strategy: {
    id: 'client-ma',
    name: 'Client MA',
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
  },
  style: 'conservative',
  seed: 42,
  candidates: 6,
};

function success(data: unknown, requestId = 'req-client'): Response {
  return new Response(JSON.stringify({
    apiVersion: 'v1',
    requestId,
    data,
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('client sends the three typed operations with Bearer authentication', async () => {
  const calls: Array<{
    url: string;
    init?: RequestInit;
  }> = [];
  const responses = [
    success([]),
    success({
      strategy: requestFixture.strategy,
      source: 'rules',
      confidence: 0.9,
      assumptions: [],
      warnings: [],
    }),
    success({
      scorecard: {},
      summary: {},
      charts: {},
    }),
  ];
  const doctor = createStrategyDoctor({
    baseUrl: 'https://doctor.example/',
    apiKey: 'agent-key',
    fetch: async (input, init) => {
      calls.push({ url: String(input), init });
      return responses.shift()!;
    },
  });

  await doctor.capabilities();
  await doctor.parseStrategy({ description: 'BTC 4h RSI Bollinger' });
  await doctor.diagnose(requestFixture);

  assert.deepEqual(calls.map(call => [
    call.init?.method ?? 'GET',
    call.url,
  ]), [
    ['GET', 'https://doctor.example/api/v1/capabilities'],
    ['POST', 'https://doctor.example/api/v1/strategies/parse'],
    ['POST', 'https://doctor.example/api/v1/diagnoses'],
  ]);
  for (const call of calls) {
    assert.equal(
      new Headers(call.init?.headers).get('authorization'),
      'Bearer agent-key',
    );
  }
  assert.equal(
    new Headers(calls[1].init?.headers).get('content-type'),
    'application/json',
  );
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
    description: 'BTC 4h RSI Bollinger',
  });
});

test('client maps API and malformed responses to typed errors', async () => {
  const apiFailure = createStrategyDoctor({
    baseUrl: 'https://doctor.example',
    apiKey: 'agent-key',
    fetch: async () => new Response(JSON.stringify({
      apiVersion: 'v1',
      requestId: 'req-rate',
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests.',
        retryable: true,
      },
    }), { status: 429 }),
  });
  await assert.rejects(
    apiFailure.capabilities(),
    (error: unknown) => (
      error instanceof StrategyDoctorApiError
      && error.status === 429
      && error.code === 'RATE_LIMITED'
    ),
  );

  const malformed = createStrategyDoctor({
    baseUrl: 'https://doctor.example',
    apiKey: 'agent-key',
    fetch: async () => new Response('not-json', { status: 200 }),
  });
  await assert.rejects(
    malformed.capabilities(),
    (error: unknown) => (
      error instanceof StrategyDoctorApiError
      && error.code === 'INVALID_RESPONSE'
    ),
  );
});

test('client forwards AbortSignal and validates its base URL', async () => {
  const controller = new AbortController();
  let receivedSignal: AbortSignal | null | undefined;
  const doctor = createStrategyDoctor({
    baseUrl: 'http://127.0.0.1:8080///',
    apiKey: 'agent-key',
    fetch: async (_input, init) => {
      receivedSignal = init?.signal;
      return success([]);
    },
  });

  await doctor.capabilities({ signal: controller.signal });
  assert.equal(receivedSignal, controller.signal);

  assert.throws(
    () => createStrategyDoctor({
      baseUrl: 'file:///tmp/doctor',
      apiKey: 'agent-key',
    }),
    /http/i,
  );
  assert.throws(
    () => createStrategyDoctor({
      baseUrl: 'not a URL',
      apiKey: 'agent-key',
    }),
    /base URL/i,
  );
  assert.throws(
    () => createStrategyDoctor({
      baseUrl: 'https://doctor.example',
      apiKey: '',
    }),
    /API key/i,
  );
});

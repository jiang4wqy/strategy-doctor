import { test } from 'node:test';
import assert from 'node:assert/strict';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { diagnoseStrategy } from '../../src/application/diagnose.ts';
import type { DiagnoseRequest } from '../../src/platform/contracts.ts';
import { strategyRegistry } from '../../src/strategy/registry.ts';
import { registerAuth } from '../../src/server/auth.ts';
import { DiagnosisLimiter } from '../../src/server/concurrency.ts';
import { fail } from '../../src/server/envelope.ts';
import { toApiError } from '../../src/server/errors.ts';
import { registerCapabilityRoutes } from '../../src/server/routes/capabilities.ts';
import { registerDiagnosisRoutes } from '../../src/server/routes/diagnoses.ts';
import { registerHealthRoutes } from '../../src/server/routes/health.ts';
import { parseServerConfig } from '../../src/server/config.ts';

const config = parseServerConfig({
  DOCTOR_API_KEYS: 'test-key',
});

const validRequest: DiagnoseRequest = {
  strategy: {
    id: 'ma-api',
    name: 'MA API strategy',
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

async function buildFixture() {
  const app = Fastify();
  app.setErrorHandler((error, request, reply) => {
    const mapped = toApiError(error);
    return reply
      .code(mapped.statusCode)
      .send(fail(request.id, mapped.error));
  });
  await app.register(rateLimit, { global: false });
  await registerAuth(app, config);
  await app.register(registerHealthRoutes);
  await app.register(registerCapabilityRoutes, {
    capabilities: () => strategyRegistry.listDefinitions(),
  });
  await app.register(registerDiagnosisRoutes, {
    diagnose: diagnoseStrategy,
    limiter: new DiagnosisLimiter(2),
  });
  await app.ready();
  return app;
}

const bearer = { authorization: 'Bearer test-key' };

test('health is public while capabilities require authentication', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const health = await app.inject({
    method: 'GET',
    url: '/api/v1/health',
  });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json().data, {
    status: 'ok',
    offline: true,
  });

  const unauthenticated = await app.inject({
    method: 'GET',
    url: '/api/v1/capabilities',
  });
  assert.equal(unauthenticated.statusCode, 401);

  const capabilities = await app.inject({
    method: 'GET',
    url: '/api/v1/capabilities',
    headers: bearer,
  });
  assert.equal(capabilities.statusCode, 200);
  assert.equal(capabilities.json().data.length, 3);
});

test('diagnosis route returns the shared DiagnosisView envelope', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/diagnoses',
    headers: bearer,
    payload: validRequest,
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.apiVersion, 'v1');
  assert.match(body.requestId, /^req-/);
  assert.equal(body.data.scorecard.evaluations.length, 5);
  assert.equal(typeof body.data.summary.returnDelta, 'number');
  assert.equal(
    body.data.summary.returnDelta,
    body.data.scorecard.tradeoff.returnCost,
  );
});

test('diagnosis route rejects unsupported multi-symbol requests', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/diagnoses',
    headers: bearer,
    payload: {
      ...validRequest,
      strategy: {
        ...validRequest.strategy,
        universe: ['BTCUSDT', 'ETHUSDT'],
      },
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'MULTI_SYMBOL_UNSUPPORTED');
  assert.equal(response.json().error.field, 'strategy.universe');
});

test('diagnosis route applies defaults and validates request fields', async t => {
  const received: DiagnoseRequest[] = [];
  const app = Fastify();
  app.setErrorHandler((error, request, reply) => {
    const mapped = toApiError(error);
    return reply
      .code(mapped.statusCode)
      .send(fail(request.id, mapped.error));
  });
  await app.register(rateLimit, { global: false });
  await registerAuth(app, config);
  await app.register(registerDiagnosisRoutes, {
    diagnose: async request => {
      received.push(request);
      return diagnoseStrategy(request);
    },
    limiter: new DiagnosisLimiter(),
  });
  await app.ready();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/diagnoses',
    headers: bearer,
    payload: { strategy: validRequest.strategy },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(received[0].style, 'conservative');
  assert.equal(received[0].seed, 42);
  assert.equal(received[0].candidates, 6);

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/v1/diagnoses',
    headers: bearer,
    payload: {
      strategy: validRequest.strategy,
      candidates: 0,
    },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, 'INVALID_REQUEST');
  assert.equal(invalid.json().error.field, 'candidates');
});

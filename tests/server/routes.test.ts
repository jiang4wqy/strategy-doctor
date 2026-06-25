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
import { registerResearchRoutes } from '../../src/server/routes/research.ts';
import { parseServerConfig } from '../../src/server/config.ts';
import {
  getFactorLibrary,
  getMultiFactorFramework,
  getNotebookCatalog,
} from '../../src/research/factor-library.ts';
import { trackPaperSignal } from '../../src/research/paper-signal.ts';
import { createOnChainDashboardService } from '../../src/research/onchain-dashboard.ts';
import { createPaperSandboxService } from '../../src/research/paper-sandbox.ts';

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
  const paperSandbox = createPaperSandboxService();
  const onChainDashboard = createOnChainDashboardService();
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
  await app.register(registerResearchRoutes, {
    factors: getFactorLibrary,
    notebooks: getNotebookCatalog,
    multiFactorFramework: getMultiFactorFramework,
    paperSignal: trackPaperSignal,
    apiCallMonitor: () => ({
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-01T00:05:00.000Z',
      totalCalls: 10,
      totalErrors: 0,
      successRate: 100,
      topPaths: [
        {
          path: '/api/v1/factors',
          count: 3,
          errorCount: 0,
          avgDurationMs: 7,
          successRate: 100,
          lastStatus: 200,
          lastSeen: '2026-01-01T00:00:00.000Z',
        },
      ],
      recent: [],
    }),
    paperSandbox: {
      createSession: request => paperSandbox.createSession(request),
      listSessions: () => paperSandbox.listSessions(),
      getSession: id => paperSandbox.getSession(id),
      stepSession: (id, request) => paperSandbox.stepSession(id, request),
      closeSession: id => paperSandbox.closeSession(id),
    },
    onChainDashboard: request => onChainDashboard.getDashboard(request),
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
  assert.equal(capabilities.json().data.length, 2);
});

test('research routes expose factors, notebooks, framework, and paper signals', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const factors = await app.inject({
    method: 'GET',
    url: '/api/v1/factors',
    headers: bearer,
  });
  assert.equal(factors.statusCode, 200);
  assert.ok(factors.json().data.factors.length > 0);

  const notebooks = await app.inject({
    method: 'GET',
    url: '/api/v1/notebooks',
    headers: bearer,
  });
  assert.equal(notebooks.statusCode, 200);
  assert.ok(notebooks.json().data.templates.length > 0);

  const framework = await app.inject({
    method: 'GET',
    url: '/api/v1/multi-factor-framework',
    headers: bearer,
  });
  assert.equal(framework.statusCode, 200);
  assert.ok(framework.json().data.outputs.includes('strategy model review'));

  const signal = await app.inject({
    method: 'POST',
    url: '/api/v1/paper/signals',
    headers: {
      ...bearer,
      'content-type': 'application/json',
    },
    payload: {
      strategy: validRequest.strategy,
      prices: [100, 101, 102, 103, 104, 105, 106, 107],
    },
  });
  assert.equal(signal.statusCode, 200);
  assert.equal(signal.json().data.symbol, 'BTCUSDT');
});

test('research routes expose api monitoring, paper sandbox, and onchain dashboard', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const monitor = await app.inject({
    method: 'GET',
    url: '/api/v1/monitor/api-calls',
    headers: {
      ...bearer,
    },
    query: { limit: '5' },
  });
  assert.equal(monitor.statusCode, 200);
  assert.equal(monitor.json().data.totalCalls, 10);

  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/paper/sandbox',
    headers: {
      ...bearer,
      'content-type': 'application/json',
    },
    payload: {
      strategy: validRequest.strategy,
      maxBars: 72,
    },
  });
  assert.equal(created.statusCode, 201);
  const sessionId = created.json().data.session.id;

  const list = await app.inject({
    method: 'GET',
    url: '/api/v1/paper/sandbox',
    headers: bearer,
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.sessions.length, 1);

  const session = await app.inject({
    method: 'GET',
    url: `/api/v1/paper/sandbox/${sessionId}`,
    headers: bearer,
  });
  assert.equal(session.statusCode, 200);
  assert.equal(session.json().data.id, sessionId);

  const step = await app.inject({
    method: 'POST',
    url: `/api/v1/paper/sandbox/${sessionId}/step`,
    headers: {
      ...bearer,
      'content-type': 'application/json',
    },
    payload: { steps: 3 },
  });
  assert.equal(step.statusCode, 200);
  assert.equal(step.json().data.id, sessionId);
  assert.equal(
    typeof step.json().data.currentIndex,
    'number',
  );

  const closed = await app.inject({
    method: 'DELETE',
    url: `/api/v1/paper/sandbox/${sessionId}`,
    headers: bearer,
  });
  assert.equal(closed.statusCode, 200);
  assert.equal(closed.json().data.status, 'removed');

  const onchain = await app.inject({
    method: 'GET',
    url: '/api/v1/onchain/dashboard',
    headers: bearer,
    query: {
      symbol: 'ETHUSDT',
      timeframe: '4h',
    },
  });
  assert.equal(onchain.statusCode, 200);
  assert.equal(onchain.json().data.symbol, 'ETHUSDT');
  assert.equal(onchain.json().data.timeframe, '4h');
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

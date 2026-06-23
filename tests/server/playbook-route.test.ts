import { test } from 'node:test';
import assert from 'node:assert/strict';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { diagnoseStrategy } from '../../src/application/diagnose.ts';
import type { DiagnoseRequest, StrategyDraft } from '../../src/platform/contracts.ts';
import { registerAuth } from '../../src/server/auth.ts';
import { parseServerConfig } from '../../src/server/config.ts';
import { DiagnosisLimiter } from '../../src/server/concurrency.ts';
import { fail } from '../../src/server/envelope.ts';
import { toApiError } from '../../src/server/errors.ts';
import { registerPlaybookRoutes } from '../../src/server/routes/playbook.ts';

const config = parseServerConfig({
  DOCTOR_API_KEYS: 'test-key',
});
const bearer = { authorization: 'Bearer test-key' };

const strategy: DiagnoseRequest['strategy'] = {
  id: 'playbook-ma',
  name: 'Playbook MA Cross',
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
};

async function buildFixture(parse?: (description: string) => Promise<StrategyDraft>) {
  const app = Fastify();
  app.setErrorHandler((error, request, reply) => {
    const mapped = toApiError(error);
    return reply
      .code(mapped.statusCode)
      .send(fail(request.id, mapped.error));
  });
  await app.register(rateLimit, { global: false });
  await registerAuth(app, config);
  await app.register(registerPlaybookRoutes, {
    parse: parse ?? (async () => ({
      strategy,
      source: 'rules',
      confidence: 0.9,
      assumptions: [],
      warnings: [],
    })),
    diagnose: diagnoseStrategy,
    limiter: new DiagnosisLimiter(2),
  });
  await app.ready();
  return app;
}

test('playbook route diagnoses structured Playbook exports', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/playbook/diagnoses',
    headers: bearer,
    payload: {
      playbook: {
        playbookId: 'agent-101',
        name: 'Trend Defense Agent',
        strategy,
      },
      style: 'trend',
      seed: 42,
      candidates: 3,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.import.source, 'strategy-json');
  assert.equal(body.data.import.playbookId, 'agent-101');
  assert.equal(body.data.import.strategy.archetype, 'ma-cross');
  assert.equal(body.data.view.scorecard.evaluations.length, 5);
});

test('playbook route parses natural-language Playbook ideas', async t => {
  const seen: string[] = [];
  const app = await buildFixture(async description => {
    seen.push(description);
    return {
      strategy,
      source: 'rules',
      confidence: 0.82,
      assumptions: [],
      warnings: [],
    };
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/playbook/diagnoses',
    headers: bearer,
    payload: {
      playbook: {
        agentId: 'agent-102',
        title: 'Natural Language Agent',
        prompt: 'BTC moving average crossover with defensive risk controls',
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(seen, [
    'BTC moving average crossover with defensive risk controls',
  ]);
  assert.equal(response.json().data.import.source, 'description');
});

test('playbook route rejects missing import material', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/playbook/diagnoses',
    headers: bearer,
    payload: {
      playbook: {
        name: 'Empty Agent',
      },
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'INVALID_REQUEST');
  assert.equal(response.json().error.field, 'playbook');
});

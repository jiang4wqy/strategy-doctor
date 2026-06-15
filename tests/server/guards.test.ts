import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {
  requireJsonMutation,
  requireSameOrigin,
} from '../../src/server/guards.ts';
import { fail } from '../../src/server/envelope.ts';
import { toApiError } from '../../src/server/errors.ts';

async function buildFixture() {
  const app = Fastify();
  app.setErrorHandler((error, request, reply) => {
    const mapped = toApiError(error);
    return reply
      .code(mapped.statusCode)
      .send(fail(request.id, mapped.error));
  });
  app.post('/mutation', {
    preHandler: [requireJsonMutation, requireSameOrigin],
  }, async () => ({ accepted: true }));
  await app.ready();
  return app;
}

test('mutation guards require JSON content type', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/mutation',
    headers: { 'content-type': 'text/plain' },
    payload: 'plain text',
  });

  assert.equal(response.statusCode, 415);
  assert.equal(response.json().error.code, 'INVALID_REQUEST');
  assert.equal(response.json().error.field, 'content-type');
});

test('mutation guards reject cross-origin browser requests', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/mutation',
    headers: {
      'content-type': 'application/json',
      host: 'doctor.example',
      origin: 'https://untrusted.example',
    },
    payload: {},
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, 'INVALID_REQUEST');
  assert.equal(response.json().error.field, 'origin');
});

test('mutation guards allow matching origins and origin-free Agent calls', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const browser = await app.inject({
    method: 'POST',
    url: '/mutation',
    headers: {
      'content-type': 'application/json',
      host: 'doctor.example',
      origin: 'https://doctor.example',
    },
    payload: {},
  });
  assert.equal(browser.statusCode, 200);

  const agent = await app.inject({
    method: 'POST',
    url: '/mutation',
    headers: {
      'content-type': 'application/json',
      host: 'doctor.example',
    },
    payload: {},
  });
  assert.equal(agent.statusCode, 200);
});

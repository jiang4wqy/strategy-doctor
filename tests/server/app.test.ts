import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../src/server/app.ts';

const env = {
  DOCTOR_API_KEYS: 'test-key',
  DOCTOR_BODY_LIMIT: String(32 * 1024),
};
const bearer = { authorization: 'Bearer test-key' };

test('buildServer exposes protected OpenAPI for registered routes', async t => {
  const app = await buildServer({ env });
  t.after(() => app.close());

  const unauthenticated = await app.inject({
    method: 'GET',
    url: '/api/v1/openapi.json',
  });
  assert.equal(unauthenticated.statusCode, 401);

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/openapi.json',
    headers: bearer,
  });
  assert.equal(response.statusCode, 200);
  const openapi = response.json();
  assert.equal(openapi.openapi, '3.0.3');
  assert.ok(openapi.paths['/api/v1/health']);
  assert.ok(openapi.paths['/api/v1/capabilities']);
  assert.ok(openapi.paths['/api/v1/diagnoses']);
});

test('buildServer returns common envelopes for oversized and unknown requests', async t => {
  const app = await buildServer({ env });
  t.after(() => app.close());

  const oversized = await app.inject({
    method: 'POST',
    url: '/api/v1/diagnoses',
    headers: {
      ...bearer,
      'content-type': 'application/json',
    },
    payload: JSON.stringify({ padding: 'x'.repeat(33 * 1024) }),
  });
  assert.equal(oversized.statusCode, 413);
  assert.equal(oversized.json().error.code, 'INVALID_REQUEST');
  assert.match(oversized.json().requestId, /^req_/);

  const missing = await app.inject({
    method: 'GET',
    url: '/api/v1/unknown',
    headers: bearer,
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, 'INVALID_REQUEST');
  assert.match(missing.json().requestId, /^req_/);
});

test('diagnosis rate limits use the stable RATE_LIMITED envelope', async t => {
  const app = await buildServer({ env });
  t.after(() => app.close());

  for (let index = 0; index < 6; index++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/diagnoses',
      headers: bearer,
      payload: { candidates: 0 },
    });
    assert.equal(response.statusCode, 400);
  }
  const limited = await app.inject({
    method: 'POST',
    url: '/api/v1/diagnoses',
    headers: bearer,
    payload: { candidates: 0 },
  });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, 'RATE_LIMITED');
  assert.equal(limited.json().error.retryable, true);
});

test('body validation never exposes internal stack details', async t => {
  const app = await buildServer({ env });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/diagnoses',
    headers: bearer,
    payload: [],
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'INVALID_REQUEST');
  assert.doesNotMatch(JSON.stringify(response.json()), /stack|node_modules/i);
});

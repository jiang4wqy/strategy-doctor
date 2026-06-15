import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerAuth } from '../../src/server/auth.ts';
import { parseServerConfig } from '../../src/server/config.ts';

const config = parseServerConfig({
  DOCTOR_WEB_ACCESS_CODE: 'team-code',
  DOCTOR_SESSION_SECRET: 's'.repeat(32),
  DOCTOR_API_KEYS: 'agent-one,agent-two',
});

async function buildFixture() {
  const app = Fastify();
  await registerAuth(app, config);
  app.get('/protected', {
    preHandler: app.requireAuth,
  }, async () => ({ protected: true }));
  await app.ready();
  return app;
}

test('authentication rejects missing and unknown credentials', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const missing = await app.inject({
    method: 'GET',
    url: '/protected',
  });
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().error.code, 'AUTH_REQUIRED');

  const unknown = await app.inject({
    method: 'GET',
    url: '/protected',
    headers: { authorization: 'Bearer unknown' },
  });
  assert.equal(unknown.statusCode, 401);
  assert.equal(unknown.json().error.code, 'AUTH_INVALID');
});

test('configured Bearer keys access protected routes', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/protected',
    headers: { authorization: 'Bearer agent-two' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { protected: true });
});

test('access-code login creates a signed HttpOnly session cookie', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/v1/auth',
    payload: { accessCode: 'wrong-code' },
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.json().error.code, 'AUTH_INVALID');

  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth',
    payload: { accessCode: 'team-code' },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(login.json().data.authenticated, true);
  const setCookie = login.headers['set-cookie'];
  assert.equal(typeof setCookie, 'string');
  assert.match(String(setCookie), /doctor_session=/);
  assert.match(String(setCookie), /HttpOnly/i);
  assert.match(String(setCookie), /SameSite=Lax/i);

  const cookie = String(setCookie).split(';', 1)[0];
  const protectedResponse = await app.inject({
    method: 'GET',
    url: '/protected',
    headers: { cookie },
  });
  assert.equal(protectedResponse.statusCode, 200);
});

test('logout expires the browser session cookie', async t => {
  const app = await buildFixture();
  t.after(() => app.close());

  const logout = await app.inject({
    method: 'DELETE',
    url: '/api/v1/auth',
  });

  assert.equal(logout.statusCode, 200);
  assert.equal(logout.json().data.authenticated, false);
  assert.match(
    String(logout.headers['set-cookie']),
    /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i,
  );
});

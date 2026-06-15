import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseServerConfig } from '../../src/server/config.ts';

test('parseServerConfig applies local offline defaults', () => {
  const config = parseServerConfig({});

  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 8080);
  assert.deepEqual(config.apiKeys, []);
  assert.equal(config.sessionTtlSeconds, 12 * 60 * 60);
  assert.equal(config.bodyLimit, 32 * 1024);
  assert.equal(config.staticRoot, path.resolve('web/dist'));
});

test('parseServerConfig trims configured API keys and numeric settings', () => {
  const config = parseServerConfig({
    DOCTOR_WEB_ACCESS_CODE: 'team-code',
    DOCTOR_SESSION_SECRET: 'a'.repeat(32),
    DOCTOR_API_KEYS: 'agent-one, agent-two,agent-one ',
    DOCTOR_HOST: '0.0.0.0',
    DOCTOR_PORT: '9090',
    DOCTOR_SESSION_TTL_SECONDS: '3600',
    DOCTOR_BODY_LIMIT: '4096',
    DOCTOR_STATIC_ROOT: './custom-dist',
  });

  assert.deepEqual(config.apiKeys, ['agent-one', 'agent-two']);
  assert.equal(config.port, 9090);
  assert.equal(config.sessionTtlSeconds, 3600);
  assert.equal(config.bodyLimit, 4096);
  assert.equal(config.staticRoot, path.resolve('custom-dist'));
});

test('parseServerConfig protects non-loopback binding and invalid values', () => {
  assert.throws(
    () => parseServerConfig({ DOCTOR_HOST: '0.0.0.0' }),
    /access code.*session secret/i,
  );
  assert.throws(
    () => parseServerConfig({
      DOCTOR_WEB_ACCESS_CODE: 'team-code',
      DOCTOR_SESSION_SECRET: 'short',
    }),
    /session secret.*32/i,
  );
  assert.throws(
    () => parseServerConfig({ DOCTOR_PORT: '70000' }),
    /port/i,
  );
  assert.throws(
    () => parseServerConfig({ DOCTOR_BODY_LIMIT: '0' }),
    /body limit/i,
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildServer } from '../../src/server/app.ts';

async function createStaticRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'strategy-doctor-web-'));
  await mkdir(path.join(root, 'assets'));
  await writeFile(
    path.join(root, 'index.html'),
    '<!doctype html><title>Strategy Doctor Web</title>',
    'utf8',
  );
  await writeFile(
    path.join(root, 'assets', 'app.js'),
    'globalThis.strategyDoctorLoaded = true;',
    'utf8',
  );
  return root;
}

test('server hosts the Web build and preserves API not-found envelopes', async t => {
  const staticRoot = await createStaticRoot();
  t.after(() => rm(staticRoot, { recursive: true, force: true }));
  const app = await buildServer({
    env: {
      DOCTOR_API_KEYS: 'static-test-key',
      DOCTOR_STATIC_ROOT: 'intentionally-missing-build',
    },
    staticRoot,
  });
  t.after(() => app.close());

  const index = await app.inject({ method: 'GET', url: '/' });
  assert.equal(index.statusCode, 200);
  assert.match(index.headers['content-type'] ?? '', /^text\/html/);
  assert.match(index.body, /Strategy Doctor Web/);

  const asset = await app.inject({
    method: 'GET',
    url: '/assets/app.js',
  });
  assert.equal(asset.statusCode, 200);
  assert.match(
    asset.headers['content-type'] ?? '',
    /javascript|text\/plain/,
  );
  assert.match(asset.body, /strategyDoctorLoaded/);

  const missingAsset = await app.inject({
    method: 'GET',
    url: '/assets/missing.js',
  });
  assert.equal(missingAsset.statusCode, 404);
  assert.doesNotMatch(
    missingAsset.headers['content-type'] ?? '',
    /^text\/html/,
  );
  assert.equal(missingAsset.json().error.code, 'INVALID_REQUEST');

  const history = await app.inject({
    method: 'GET',
    url: '/history',
  });
  assert.equal(history.statusCode, 200);
  assert.match(history.headers['content-type'] ?? '', /^text\/html/);
  assert.match(history.body, /Strategy Doctor Web/);

  const missingApi = await app.inject({
    method: 'GET',
    url: '/api/v1/unknown',
  });
  assert.equal(missingApi.statusCode, 404);
  assert.match(
    missingApi.headers['content-type'] ?? '',
    /^application\/json/,
  );
  assert.equal(missingApi.json().error.code, 'INVALID_REQUEST');
});

test('server explains how to build the Web client when assets are missing', async t => {
  const app = await buildServer({
    env: {
      DOCTOR_STATIC_ROOT: 'intentionally-missing-build',
    },
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'INVALID_REQUEST');
  assert.match(response.json().error.message, /npm\.cmd run build:web/);
});

test('an empty static directory is not treated as a Web build', async t => {
  const staticRoot = await mkdtemp(
    path.join(tmpdir(), 'strategy-doctor-empty-web-'),
  );
  t.after(() => rm(staticRoot, { recursive: true, force: true }));
  const app = await buildServer({ staticRoot });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.statusCode, 404);
  assert.match(response.json().error.message, /npm\.cmd run build:web/);
});

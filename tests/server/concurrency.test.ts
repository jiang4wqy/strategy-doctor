import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DiagnosisLimiter,
} from '../../src/server/concurrency.ts';
import { ServerBusyError } from '../../src/server/errors.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

test('DiagnosisLimiter rejects work beyond its active capacity', async () => {
  const limiter = new DiagnosisLimiter(2);
  const first = deferred<string>();
  const second = deferred<string>();
  let thirdInvoked = false;

  const firstRun = limiter.run(() => first.promise);
  const secondRun = limiter.run(() => second.promise);

  await assert.rejects(
    limiter.run(async () => {
      thirdInvoked = true;
      return 'third';
    }),
    ServerBusyError,
  );
  assert.equal(thirdInvoked, false);

  first.resolve('first');
  assert.equal(await firstRun, 'first');
  assert.equal(await limiter.run(async () => 'next'), 'next');

  second.resolve('second');
  assert.equal(await secondRun, 'second');
});

test('DiagnosisLimiter releases capacity after a rejected operation', async () => {
  const limiter = new DiagnosisLimiter(1);

  await assert.rejects(
    limiter.run(async () => {
      throw new Error('diagnosis failed');
    }),
    /diagnosis failed/,
  );
  assert.equal(await limiter.run(async () => 'recovered'), 'recovered');
});

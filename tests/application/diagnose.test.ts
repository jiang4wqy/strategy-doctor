import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Strategy } from '../../src/contracts.ts';
import { diagnoseStrategy } from '../../src/application/diagnose.ts';

const strategy = JSON.parse(
  readFileSync(
    new URL('../../examples/rsi-bollinger.json', import.meta.url),
    'utf8',
  ),
) as Strategy;

test('diagnoseStrategy returns one deterministic offline result for all five dimensions', async () => {
  const request = {
    strategy,
    style: 'conservative' as const,
    seed: 42,
    candidates: 6,
  };

  const first = await diagnoseStrategy(request);
  const second = await diagnoseStrategy(request);

  assert.deepEqual(first, second);
  assert.deepEqual(first.view.scorecard, first.scorecard);
  assert.equal(first.scorecard.scenarioSetId, 'tx42/ho100042');
  assert.equal(first.scorecard.evaluations.length, 5);
  assert.equal(first.view.charts.heldOutComparison.length, 5);
});

test('diagnoseStrategy rejects invalid seed and candidate boundaries', async () => {
  await assert.rejects(
    diagnoseStrategy({
      strategy,
      style: 'conservative',
      seed: Number.MAX_SAFE_INTEGER,
      candidates: 6,
    }),
    /seed/i,
  );
  await assert.rejects(
    diagnoseStrategy({
      strategy,
      style: 'conservative',
      seed: 42,
      candidates: 0,
    }),
    /candidate/i,
  );
});

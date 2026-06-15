import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  measurePlatform,
} from '../../src/scripts/measure-platform.ts';

test('platform measurement reports parse and diagnosis timing summaries', async () => {
  const result = await measurePlatform(1);

  assert.equal(result.samples, 1);
  for (const summary of [result.parseMs, result.diagnosisMs]) {
    assert.equal(typeof summary.mean, 'number');
    assert.equal(typeof summary.minimum, 'number');
    assert.equal(typeof summary.maximum, 'number');
    assert.ok(summary.minimum >= 0);
    assert.ok(summary.maximum >= summary.minimum);
    assert.ok(summary.mean >= summary.minimum);
    assert.ok(summary.mean <= summary.maximum);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  populationStandardDeviation,
  simpleMovingAverage,
  wilderRsi,
} from '../../src/strategy/indicators.ts';

test('simpleMovingAverage returns a ready window average', () => {
  assert.equal(simpleMovingAverage([1, 2, 3, 4], 3, 3), 3);
  assert.equal(simpleMovingAverage([1, 2], 3, 1), null);
});

test('populationStandardDeviation uses the population denominator', () => {
  const deviation = populationStandardDeviation([1, 2, 3], 3, 2);
  assert.ok(deviation !== null);
  assert.ok(Math.abs(deviation - Math.sqrt(2 / 3)) < 1e-12);
  assert.equal(populationStandardDeviation([1, 2], 3, 1), null);
});

test('wilderRsi handles all-gain, all-loss, and flat windows', () => {
  assert.equal(wilderRsi([1, 2, 3, 4], 3, 3), 100);
  assert.equal(wilderRsi([4, 3, 2, 1], 3, 3), 0);
  assert.equal(wilderRsi([1, 1, 1, 1], 3, 3), 50);
  assert.equal(wilderRsi([1, 2, 3], 3, 2), null);
});

test('wilderRsi recursively smooths later gains and losses', () => {
  const rsi = wilderRsi([1, 2, 3, 2, 4], 3, 4);
  assert.ok(rsi !== null);
  assert.ok(Math.abs(rsi - 83.33333333333333) < 1e-12);
});

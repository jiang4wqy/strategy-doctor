import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePath, mulberry32 } from '../../src/backtest/path.ts';
import type { MarketShock } from '../../src/contracts.ts';

test('mulberry32 returns the same sequence for the same seed', () => {
  const first = mulberry32(42);
  const second = mulberry32(42);

  for (let i = 0; i < 100; i++) {
    assert.equal(first(), second());
  }
});

test('generatePath is deterministic for the same shock', () => {
  const shock: MarketShock = {
    kind: 'squeeze',
    magnitude: 0.3,
    durationBars: 48,
    volMult: 2,
    seed: 42,
  };

  assert.deepEqual(generatePath(shock), generatePath(shock));
});

test('squeeze path rises to induce a long before reversing sharply', () => {
  const totalBars = 240;
  const shock: MarketShock = {
    kind: 'squeeze',
    magnitude: 0.3,
    durationBars: 48,
    volMult: 0,
    seed: 42,
  };
  const prices = generatePath(shock, totalBars);
  const shockStart = Math.floor(totalBars / 3);
  const shockEnd = shockStart + shock.durationBars;
  const peak = Math.max(...prices.slice(shockStart, shockEnd));

  assert.ok(peak > prices[shockStart] * 1.05, 'squeeze should first push price higher');
  assert.ok(prices[shockEnd] < peak * 0.75, 'squeeze should then reverse by more than 25%');
});

test('whipsaw path repeatedly reverses without a large net direction', () => {
  const totalBars = 240;
  const shock: MarketShock = {
    kind: 'whipsaw',
    magnitude: 0.27,
    durationBars: 69,
    volMult: 1.5,
    seed: 99,
  };
  const prices = generatePath(shock, totalBars);
  const shockStart = Math.floor(totalBars / 3);
  const shockEnd = shockStart + shock.durationBars;
  const returns = prices
    .slice(shockStart + 1, shockEnd)
    .map((price, index) => price / prices[shockStart + index] - 1);
  const directionChanges = returns.slice(1).reduce(
    (count, value, index) =>
      count + (Math.sign(value) !== Math.sign(returns[index]) ? 1 : 0),
    0,
  );
  const netMove = prices[shockEnd] / prices[shockStart] - 1;

  assert.ok(directionChanges >= 5);
  assert.ok(Math.abs(netMove) < shock.magnitude / 2);
});

test('generatePath never emits non-positive prices', () => {
  const shock: MarketShock = {
    kind: 'gap',
    magnitude: 0.45,
    durationBars: 1,
    volMult: 3,
    seed: 9,
  };

  assert.ok(generatePath(shock).every(price => Number.isFinite(price) && price > 0));
});

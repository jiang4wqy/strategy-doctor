import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Metrics } from '../../src/contracts.ts';
import { scoreStyle } from '../../src/scoring/scorecard.ts';
import { getProfile, STYLES } from '../../src/scoring/styles.ts';

const metrics = (overrides: Partial<Metrics> = {}): Metrics => ({
  pnlPct: 0.05,
  maxDrawdownPct: 0.05,
  liquidated: false,
  numTrades: 3,
  equityCurve: [1],
  ...overrides,
});

test('style presets contain each supported style exactly once', () => {
  assert.deepEqual(
    STYLES.map(profile => profile.style).sort(),
    ['aggressive', 'conservative', 'trend'],
  );
});

test('style preset weights sum to one', () => {
  for (const profile of STYLES) {
    assert.ok(Math.abs(profile.pnlWeight + profile.ddWeight - 1) < 1e-9);
  }
});

test('clean results pass the conservative profile with a high score', () => {
  const score = scoreStyle(
    [metrics(), metrics(), metrics()],
    getProfile('conservative'),
  );

  assert.equal(score.survived, true);
  assert.ok(score.riskScore >= 60);
});

test('aggressive profile tolerates one liquidation in five while conservative does not', () => {
  const results = [
    metrics({ liquidated: true, maxDrawdownPct: 0.95, pnlPct: -0.9 }),
    metrics(),
    metrics(),
    metrics(),
    metrics(),
  ];

  const conservative = scoreStyle(results, getProfile('conservative'));
  const aggressive = scoreStyle(results, getProfile('aggressive'));

  assert.equal(conservative.survived, false);
  assert.equal(aggressive.survived, true);
  assert.ok(aggressive.riskScore > conservative.riskScore);
  assert.equal(aggressive.worstDrawdownPct, 0.95);
});

test('large drawdown heavily penalizes the conservative score', () => {
  const clean = scoreStyle(
    [metrics()],
    getProfile('conservative'),
  ).riskScore;
  const drawdown = scoreStyle(
    [metrics({ maxDrawdownPct: 0.5 })],
    getProfile('conservative'),
  ).riskScore;

  assert.ok(drawdown < clean * 0.5);
});

test('a failed profile cannot report a passing-looking score', () => {
  const score = scoreStyle(
    [metrics({ pnlPct: 10, maxDrawdownPct: 0.83 })],
    getProfile('aggressive'),
  );

  assert.equal(score.survived, false);
  assert.ok(score.riskScore < 60);
});

test('scoreStyle reports the arithmetic mean return', () => {
  const score = scoreStyle(
    [metrics({ pnlPct: 0.2 }), metrics({ pnlPct: -0.1 })],
    getProfile('trend'),
  );

  assert.ok(Math.abs(score.meanPnlPct - 0.05) < 1e-12);
});

test('scoreStyle rejects an empty result set', () => {
  assert.throws(
    () => scoreStyle([], getProfile('conservative')),
    /results/i,
  );
});

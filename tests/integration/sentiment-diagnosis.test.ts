import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type { Metrics, Strategy } from '../../src/contracts.ts';
import { classifyDeath } from '../../src/redteam/diagnose.ts';
import {
  buildSentimentScenario,
  parseSentimentSnapshot,
} from '../../src/redteam/sentiment.ts';
import { scoreStyle } from '../../src/scoring/scorecard.ts';
import { STYLES } from '../../src/scoring/styles.ts';

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

const assertFiniteMetrics = (metrics: Metrics) => {
  assert.ok(Number.isFinite(metrics.pnlPct));
  assert.ok(Number.isFinite(metrics.maxDrawdownPct));
  assert.ok(Number.isInteger(metrics.numTrades));
  assert.ok(metrics.equityCurve.every(Number.isFinite));
};

test('frozen sentiment snapshot produces deterministic diagnosis and style scores offline', async () => {
  const snapshot = parseSentimentSnapshot(
    loadJson('../../examples/sentiment-btc.snapshot.json'),
  );
  const strategy = loadJson('../../examples/trend-follower.json') as Strategy;
  const scenario = buildSentimentScenario(snapshot, 42);
  const backtester = new MockBacktester();

  const firstMetrics = await backtester.run(strategy, scenario);
  const secondMetrics = await backtester.run(strategy, scenario);
  const cause = classifyDeath(firstMetrics);
  const scores = Object.fromEntries(
    STYLES.map(profile => [
      profile.style,
      scoreStyle([firstMetrics], profile),
    ]),
  );

  assert.equal(scenario.sourceSkill, 'sentiment-analyst');
  assertFiniteMetrics(firstMetrics);
  assert.deepEqual(firstMetrics, secondMetrics);
  assert.notEqual(cause, 'survived');
  assert.deepEqual(
    Object.keys(scores).sort(),
    ['aggressive', 'conservative', 'trend'],
  );
  assert.ok(scores.aggressive.riskScore > scores.trend.riskScore);
  assert.ok(scores.trend.riskScore > scores.conservative.riskScore);
  assert.ok(Object.values(scores).every(score => !score.survived));
});

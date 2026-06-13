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
import {
  buildTechnicalScenario,
  parseTechnicalSnapshot,
} from '../../src/redteam/technical.ts';
import { scoreStyle } from '../../src/scoring/scorecard.ts';
import { STYLES } from '../../src/scoring/styles.ts';

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

const finiteMetrics = (metrics: Metrics) =>
  Number.isFinite(metrics.pnlPct)
  && Number.isFinite(metrics.maxDrawdownPct)
  && Number.isInteger(metrics.numTrades)
  && metrics.equityCurve.every(Number.isFinite);

test('technical snapshot creates a deterministic honest whipsaw diagnosis', async () => {
  const snapshot = parseTechnicalSnapshot(
    loadJson('../../examples/technical-btc-4h.snapshot.json'),
  );
  const strategy = loadJson('../../examples/trend-follower.json') as Strategy;
  const scenario = buildTechnicalScenario(snapshot, 99);
  const backtester = new MockBacktester();

  const firstMetrics = await backtester.run(strategy, scenario);
  const secondMetrics = await backtester.run(strategy, scenario);

  assert.equal(scenario.sourceSkill, 'technical-analysis');
  assert.equal(scenario.shock.kind, 'whipsaw');
  assert.ok(finiteMetrics(firstMetrics));
  assert.deepEqual(firstMetrics, secondMetrics);
  assert.ok(firstMetrics.numTrades >= 1);
  assert.equal(classifyDeath(firstMetrics), classifyDeath(secondMetrics));
});

test('sentiment and technical scenarios produce three multi-scenario style scores', async () => {
  const strategy = loadJson('../../examples/trend-follower.json') as Strategy;
  const sentimentScenario = buildSentimentScenario(
    parseSentimentSnapshot(
      loadJson('../../examples/sentiment-btc.snapshot.json'),
    ),
    42,
  );
  const technicalScenario = buildTechnicalScenario(
    parseTechnicalSnapshot(
      loadJson('../../examples/technical-btc-4h.snapshot.json'),
    ),
    99,
  );
  const backtester = new MockBacktester();
  const results = await Promise.all([
    backtester.run(strategy, sentimentScenario),
    backtester.run(strategy, technicalScenario),
  ]);
  const scores = Object.fromEntries(
    STYLES.map(profile => [
      profile.style,
      scoreStyle(results, profile),
    ]),
  );

  assert.deepEqual(
    Object.keys(scores).sort(),
    ['aggressive', 'conservative', 'trend'],
  );
  assert.ok(
    Object.values(scores).every(
      score => Number.isInteger(score.riskScore)
        && score.riskScore >= 0
        && score.riskScore <= 100,
    ),
  );
});

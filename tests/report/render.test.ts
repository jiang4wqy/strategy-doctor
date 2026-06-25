import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type { Scenario, Strategy } from '../../src/contracts.ts';
import { runDoctor } from '../../src/pipeline/doctor.ts';
import {
  buildSentimentScenario,
  parseSentimentSnapshot,
} from '../../src/redteam/sentiment.ts';
import {
  buildTechnicalScenario,
  parseTechnicalSnapshot,
} from '../../src/redteam/technical.ts';
import { renderScorecard } from '../../src/report/render.ts';

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

const buildScenarioSet = (seed: number): Scenario[] => [
  buildSentimentScenario(
    parseSentimentSnapshot(
      loadJson('../../examples/sentiment-btc.snapshot.json'),
    ),
    seed,
  ),
  buildTechnicalScenario(
    parseTechnicalSnapshot(
      loadJson('../../examples/technical-btc-4h.snapshot.json'),
    ),
    seed,
  ),
];

test('renderScorecard includes scores, deaths, prescription, and honest tradeoff', async () => {
  const strategy = loadJson(
    '../../examples/trend-follower.json',
  ) as Strategy;
  const card = await runDoctor(strategy, new MockBacktester(), {
    style: 'conservative',
    treatment: buildScenarioSet(42),
    heldOut: buildScenarioSet(100042),
  });

  const markdown = renderScorecard(card, strategy);

  assert.ok(markdown.includes(strategy.name));
  assert.ok(markdown.includes('Five-Dimensional Stress Coverage'));
  assert.ok(markdown.includes('Skill'));
  assert.ok(markdown.includes('Observed At'));
  assert.ok(markdown.includes('Damage'));
  assert.ok(markdown.includes('sentiment-analyst'));
  assert.ok(markdown.includes('technical-analysis'));
  assert.ok(markdown.includes('squeeze'));
  assert.ok(markdown.includes('whipsaw'));
  assert.ok(markdown.includes('Three Style Scores'));
  assert.ok(markdown.includes('Failure List'));
  assert.ok(markdown.includes('Prescription'));
  assert.ok(markdown.includes('held-out'));
  assert.ok(markdown.includes('tx42/ho100042'));
  assert.ok(markdown.includes('does not promise'));
});

test('renderScorecard explicitly reports survivors and zero-change prescription', async () => {
  const strategy = loadJson(
    '../../examples/trend-follower.json',
  ) as Strategy;
  const cleanBacktest = {
    async run() {
      return {
        pnlPct: 0.03,
        maxDrawdownPct: 0.01,
        liquidated: false,
        numTrades: 1,
        equityCurve: [1, 1.03],
      };
    },
  };
  const card = await runDoctor(strategy, cleanBacktest, {
    style: 'conservative',
    treatment: buildScenarioSet(42),
    heldOut: buildScenarioSet(100042),
  });

  const markdown = renderScorecard(card, strategy);

  assert.ok(markdown.includes('Survived'));
  assert.ok(markdown.includes('No fatal outcomes were found in the treatment scenarios.'));
  assert.ok(markdown.includes('Parameter changes: `{}`'));
  assert.ok(markdown.includes('Mean return change: +0.0%'));
});

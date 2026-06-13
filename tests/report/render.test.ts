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
  assert.ok(markdown.includes('三风格评分'));
  assert.ok(markdown.includes('死因清单'));
  assert.ok(markdown.includes('处方'));
  assert.ok(markdown.includes('held-out'));
  assert.ok(markdown.includes('tx42/ho100042'));
  assert.ok(markdown.includes('不承诺'));
});

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

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

const strategy = loadJson('../../examples/trend-follower.json') as Strategy;

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

test('runDoctor rejects overlapping treatment and held-out seeds', async () => {
  await assert.rejects(
    runDoctor(strategy, new MockBacktester(), {
      style: 'conservative',
      treatment: buildScenarioSet(42),
      heldOut: buildScenarioSet(42),
    }),
    /seed/,
  );
});

test('runDoctor returns a complete scorecard for frozen snapshot scenarios', async () => {
  const card = await runDoctor(strategy, new MockBacktester(), {
    style: 'conservative',
    treatment: buildScenarioSet(42),
    heldOut: buildScenarioSet(100042),
  });

  assert.equal(card.strategyId, strategy.id);
  assert.equal(card.scenarioSetId, 'tx42/ho100042');
  assert.deepEqual(
    Object.keys(card.perStyle).sort(),
    ['aggressive', 'conservative', 'trend'],
  );
  assert.ok(card.deaths.length > 0);
  assert.ok(card.prescription);
  assert.ok(card.tradeoff);
  assert.ok(Number.isFinite(card.tradeoff.robustnessGain));
  assert.ok(Number.isFinite(card.tradeoff.returnCost));
});

test('runDoctor is deterministic for identical inputs', async () => {
  const options = {
    style: 'conservative' as const,
    treatment: buildScenarioSet(42),
    heldOut: buildScenarioSet(100042),
  };
  const backtest = new MockBacktester();

  const first = await runDoctor(strategy, backtest, options);
  const second = await runDoctor(strategy, backtest, options);

  assert.deepEqual(first, second);
});

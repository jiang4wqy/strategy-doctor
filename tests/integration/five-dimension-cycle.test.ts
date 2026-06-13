import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type { Strategy, StrategyParams } from '../../src/contracts.ts';
import {
  buildBaseScenarioSet,
  loadDefaultSnapshotBundle,
} from '../../src/data/snapshots.ts';
import { runDoctor } from '../../src/pipeline/doctor.ts';

const buildScenarioSet = (seed: number) =>
  buildBaseScenarioSet(loadDefaultSnapshotBundle(), seed);

const loadStrategy = (): Strategy =>
  JSON.parse(
    readFileSync(
      new URL('../../examples/trend-follower.json', import.meta.url),
      'utf8',
    ),
  ) as Strategy;

test('buildScenarioSet returns the five official dimensions deterministically', () => {
  const first = buildScenarioSet(42);
  const second = buildScenarioSet(42);

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map(scenario => scenario.dimension).sort(),
    ['macro', 'market-intel', 'news', 'sentiment', 'technical'],
  );
  assert.deepEqual(
    first.map(scenario => scenario.sourceSkill).sort(),
    [
      'macro-analyst',
      'market-intel',
      'news-briefing',
      'sentiment-analyst',
      'technical-analysis',
    ],
  );
  assert.ok(first.every(scenario => scenario.shock.seed === 42));
});

test('five-dimensional doctor cycle is deterministic and only patches death-related parameters', async () => {
  const strategy = loadStrategy();
  const options = {
    style: 'conservative' as const,
    treatment: buildScenarioSet(42),
    heldOut: buildScenarioSet(100042),
  };
  const backtester = new MockBacktester();

  const first = await runDoctor(strategy, backtester, options);
  const second = await runDoctor(strategy, backtester, options);

  assert.deepEqual(first, second);
  assert.equal(first.evaluations.length, 5);
  assert.ok(first.evaluations.every(evaluation => evaluation.sourceObservedAt));
  assert.ok(first.prescription);
  assert.ok(first.tradeoff);
  assert.ok(Number.isFinite(first.tradeoff.robustnessGain));
  assert.ok(Number.isFinite(first.tradeoff.returnCost));

  const allowed = new Set<keyof StrategyParams>();
  for (const death of first.deaths) {
    if (death.cause === 'liquidation') {
      allowed.add('leverage');
      allowed.add('stopLossPct');
    } else if (death.cause === 'drawdown-breach') {
      allowed.add('positionPct');
    } else if (death.cause === 'stop-loss-bleed') {
      allowed.add('fastMA');
      allowed.add('slowMA');
    }
  }

  assert.ok(
    Object.keys(first.prescription.changes)
      .every(key => allowed.has(key as keyof StrategyParams)),
  );
});

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type {
  DeathCause,
  Scorecard,
  Strategy,
} from '../../src/contracts.ts';
import {
  buildBaseScenarioSet,
  loadDefaultSnapshotBundle,
} from '../../src/data/snapshots.ts';
import { runDoctor } from '../../src/pipeline/doctor.ts';
import { parseStrategy } from '../../src/strategy/parse.ts';
import {
  getStrategyAdapter,
  type AnyStrategyAdapter,
} from '../../src/strategy/registry.ts';

const loadStrategy = (relativePath: string): Strategy =>
  parseStrategy(JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
  ));

const run = (strategy: Strategy): Promise<Scorecard> =>
  runDoctor(strategy, new MockBacktester(), {
    style: 'conservative',
    treatment: buildBaseScenarioSet(loadDefaultSnapshotBundle(), 42),
    heldOut: buildBaseScenarioSet(loadDefaultSnapshotBundle(), 100042),
  });

const assertComplete = (
  strategy: Strategy,
  scorecard: Scorecard,
): void => {
  assert.equal(scorecard.evaluations.length, 5);
  assert.deepEqual(
    Object.keys(scorecard.perStyle).sort(),
    ['aggressive', 'conservative', 'trend'],
  );
  assert.equal(
    scorecard.prescription.patchedStrategy.archetype,
    strategy.archetype,
  );
  assert.ok(Number.isFinite(scorecard.tradeoff.robustnessGain));
  assert.ok(Number.isFinite(scorecard.tradeoff.returnCost));

  const causes = new Set<DeathCause>(
    scorecard.deaths.map(death => death.cause),
  );
  const adapter = getStrategyAdapter(
    strategy.archetype,
  ) as AnyStrategyAdapter;
  const allowed = new Set<string>(
    adapter.targetedFields(causes) as readonly string[],
  );
  assert.ok(
    Object.keys(scorecard.prescription.changes)
      .every(key => allowed.has(key)),
  );
};

test('both strategies complete deterministic diagnosis and prescription on shared scenarios', async () => {
  const movingAverage = loadStrategy('../../examples/trend-follower.json');
  const meanReversion = loadStrategy('../../examples/rsi-bollinger.json');

  const [maFirst, maSecond, rsiFirst, rsiSecond] = await Promise.all([
    run(movingAverage),
    run(movingAverage),
    run(meanReversion),
    run(meanReversion),
  ]);

  assert.deepEqual(maFirst, maSecond);
  assert.deepEqual(rsiFirst, rsiSecond);
  assertComplete(movingAverage, maFirst);
  assertComplete(meanReversion, rsiFirst);
  assert.ok(
    rsiFirst.evaluations.every(evaluation => evaluation.metrics.numTrades > 0),
  );

  assert.notDeepEqual(
    maFirst.evaluations.map(evaluation => evaluation.metrics),
    rsiFirst.evaluations.map(evaluation => evaluation.metrics),
  );
  assert.notDeepEqual(
    maFirst.evaluations.map(evaluation => evaluation.cause),
    rsiFirst.evaluations.map(evaluation => evaluation.cause),
  );
});

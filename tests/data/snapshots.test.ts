import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaseScenarioSet,
  loadDefaultSnapshotBundle,
} from '../../src/data/snapshots.ts';

test('default snapshot bundle builds all five dimensions with provenance', () => {
  const bundle = loadDefaultSnapshotBundle();
  const scenarios = buildBaseScenarioSet(bundle, 42);

  assert.deepEqual(
    scenarios.map(scenario => scenario.dimension).sort(),
    ['macro', 'market-intel', 'news', 'sentiment', 'technical'],
  );
  assert.ok(scenarios.every(scenario => scenario.sourceObservedAt));
  assert.ok(scenarios.every(scenario => scenario.shock.seed === 42));
});

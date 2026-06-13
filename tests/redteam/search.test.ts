import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  BacktestAdapter,
  Metrics,
  Scenario,
  Strategy,
} from '../../src/contracts.ts';
import {
  buildBaseScenarioSet,
  loadDefaultSnapshotBundle,
} from '../../src/data/snapshots.ts';
import {
  buildAdversarialScenarioSet,
  buildScenarioCandidates,
  selectWorstPerDimension,
} from '../../src/redteam/search.ts';

const strategy: Strategy = {
  id: 'strategy',
  name: 'strategy',
  archetype: 'ma-cross',
  params: {
    fastMA: 8,
    slowMA: 30,
    leverage: 2,
    stopLossPct: 0.05,
    positionPct: 0.5,
  },
  universe: ['BTCUSDT'],
  timeframe: '1h',
};

const metrics = (scenario: Scenario): Metrics => ({
  pnlPct: -scenario.shock.magnitude,
  maxDrawdownPct: scenario.shock.magnitude,
  liquidated: false,
  numTrades: 1,
  equityCurve: [1, 1 - scenario.shock.magnitude],
});

test('buildScenarioCandidates is deterministic and retains the baseline', () => {
  const base = buildBaseScenarioSet(loadDefaultSnapshotBundle(), 42)[0];
  const first = buildScenarioCandidates(base, 6);
  const second = buildScenarioCandidates(base, 6);

  assert.deepEqual(first, second);
  assert.equal(first.length, 6);
  assert.deepEqual(first[0].shock, base.shock);
  assert.equal(first[0].id, `${base.dimension}-42-c0`);
  assert.ok(first.every(candidate => candidate.shock.seed === 42));
  assert.equal(new Set(first.map(candidate => candidate.id)).size, 6);
});

test('buildScenarioCandidates respects each dimension boundary', () => {
  const scenarios = buildBaseScenarioSet(loadDefaultSnapshotBundle(), 42);
  const expected = {
    macro: { magnitude: [0.08, 0.4], duration: [24, 192], vol: [1, 3] },
    'market-intel': { magnitude: [0.12, 0.4], duration: [18, 72], vol: [1.2, 3] },
    news: { magnitude: [0.08, 0.35], duration: [1, 12], vol: [1.2, 3] },
    sentiment: { magnitude: [0.15, 0.45], duration: [24, 72], vol: [1.5, 3] },
    technical: { magnitude: [0.15, 0.4], duration: [40, 100], vol: [1, 2] },
  } as const;

  for (const scenario of scenarios) {
    const bounds = expected[scenario.dimension];
    for (const candidate of buildScenarioCandidates(scenario, 50)) {
      assert.ok(candidate.shock.magnitude >= bounds.magnitude[0]);
      assert.ok(candidate.shock.magnitude <= bounds.magnitude[1]);
      assert.ok(candidate.shock.durationBars >= bounds.duration[0]);
      assert.ok(candidate.shock.durationBars <= bounds.duration[1]);
      assert.ok(candidate.shock.volMult >= bounds.vol[0]);
      assert.ok(candidate.shock.volMult <= bounds.vol[1]);
    }
  }
});

test('selectWorstPerDimension uses damage score and lexical tie breaking', async () => {
  const base = buildBaseScenarioSet(loadDefaultSnapshotBundle(), 42);
  const candidates = base.flatMap(scenario => buildScenarioCandidates(scenario, 6));
  const backtest: BacktestAdapter = {
    async run(_strategy, scenario) {
      return metrics(scenario);
    },
  };
  const selected = await selectWorstPerDimension(
    strategy,
    [...candidates].reverse(),
    backtest,
  );

  assert.equal(selected.length, 5);
  for (const scenario of selected) {
    const sameDimension = candidates.filter(
      candidate => candidate.dimension === scenario.dimension,
    );
    const highestMagnitude = Math.max(
      ...sameDimension.map(candidate => candidate.shock.magnitude),
    );
    assert.equal(scenario.shock.magnitude, highestMagnitude);
  }

  const tieBacktest: BacktestAdapter = {
    async run() {
      return metrics({ ...base[0], shock: { ...base[0].shock, magnitude: 0.1 } });
    },
  };
  const tieCandidates = buildScenarioCandidates(base[0], 3).reverse();
  const [tieWinner] = await selectWorstPerDimension(
    strategy,
    tieCandidates,
    tieBacktest,
  );
  assert.equal(tieWinner.id, 'macro-42-c0');
});

test('buildAdversarialScenarioSet selects one scenario per dimension without forcing death', async () => {
  const cleanBacktest: BacktestAdapter = {
    async run() {
      return {
        pnlPct: 0.05,
        maxDrawdownPct: 0.02,
        liquidated: false,
        numTrades: 2,
        equityCurve: [1, 1.05],
      };
    },
  };
  const selected = await buildAdversarialScenarioSet(
    strategy,
    loadDefaultSnapshotBundle(),
    42,
    6,
    cleanBacktest,
  );

  assert.equal(selected.length, 5);
  assert.ok(selected.every(scenario => scenario.id.endsWith('-c0')));
});

test('buildScenarioCandidates rejects counts outside 1 to 50', () => {
  const base = buildBaseScenarioSet(loadDefaultSnapshotBundle(), 42)[0];
  for (const count of [0, 51, 1.5]) {
    assert.throws(() => buildScenarioCandidates(base, count), /candidate/i);
  }
});

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type {
  BacktestAdapter,
  Metrics,
  Scenario,
  Strategy,
} from '../../src/contracts.ts';
import {
  runDoctor,
  runDoctorDetailed,
} from '../../src/pipeline/doctor.ts';
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
  assert.equal(card.evaluations.length, 2);
  assert.deepEqual(
    card.evaluations.map(evaluation => evaluation.dimension).sort(),
    ['sentiment', 'technical'],
  );
  assert.ok(
    card.evaluations.every(
      evaluation => Number.isFinite(evaluation.damageScore),
    ),
  );
  assert.ok(card.deaths.length > 0);
  assert.ok(card.prescription);
  assert.ok(card.tradeoff);
  assert.ok(Number.isFinite(card.tradeoff.robustnessGain));
  assert.ok(Number.isFinite(card.tradeoff.returnCost));
});

test('runDoctorDetailed preserves the legacy scorecard and held-out metrics', async () => {
  const treatment = buildScenarioSet(42);
  const heldOut = buildScenarioSet(100042);
  const options = {
    style: 'conservative' as const,
    treatment,
    heldOut,
  };
  const detailed = await runDoctorDetailed(
    strategy,
    new MockBacktester(),
    options,
  );
  const legacy = await runDoctor(strategy, new MockBacktester(), options);

  assert.deepEqual(detailed.scorecard, legacy);
  assert.equal(detailed.heldOut.originalMetrics.length, heldOut.length);
  assert.equal(detailed.heldOut.patchedMetrics.length, heldOut.length);
});

test('runDoctorDetailed evaluates each held-out strategy exactly once', async () => {
  const treatment = buildScenarioSet(42);
  const heldOut = buildScenarioSet(100042);
  const heldOutIds = new Set(heldOut.map(scenario => scenario.id));
  const counts = new Map<string, number>();
  const mock = new MockBacktester();
  const backtest: BacktestAdapter = {
    async run(candidate, scenario) {
      if (heldOutIds.has(scenario.id)) {
        const key = `${candidate.id}:${scenario.id}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return mock.run(candidate, scenario);
    },
  };

  const result = await runDoctorDetailed(strategy, backtest, {
    style: 'conservative',
    treatment,
    heldOut,
  });

  assert.equal(counts.size, heldOut.length * 2);
  assert.ok([...counts.values()].every(count => count === 1));
  assert.equal(result.heldOut.originalMetrics.length, heldOut.length);
  assert.equal(result.heldOut.patchedMetrics.length, heldOut.length);
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

test('runDoctor can enrich evaluation narratives through an injected narrator', async () => {
  const card = await runDoctor(strategy, new MockBacktester(), {
    style: 'conservative',
    treatment: buildScenarioSet(42),
    heldOut: buildScenarioSet(100042),
    narrator: async ({ scenario }) => `增强叙事：${scenario.dimension}`,
  });

  assert.ok(
    card.evaluations.every(
      evaluation => evaluation.narrative === `增强叙事：${evaluation.dimension}`,
    ),
  );
  assert.ok(
    card.deaths.every(death => death.narrative.startsWith('增强叙事：')),
  );
});

test('runDoctor returns a zero-change prescription when every scenario survives', async () => {
  const cleanMetrics: Metrics = {
    pnlPct: 0.05,
    maxDrawdownPct: 0.02,
    liquidated: false,
    numTrades: 2,
    equityCurve: [1, 1.05],
  };
  const backtest: BacktestAdapter = {
    async run() {
      return cleanMetrics;
    },
  };

  const card = await runDoctor(strategy, backtest, {
    style: 'conservative',
    treatment: buildScenarioSet(42),
    heldOut: buildScenarioSet(100042),
  });

  assert.equal(card.deaths.length, 0);
  assert.deepEqual(card.prescription?.changes, {});
  assert.deepEqual(card.tradeoff, {
    robustnessGain: 0,
    returnCost: 0,
  });
});

test('runDoctor rejects duplicate scenario ids and dimensions', async () => {
  const treatment = buildScenarioSet(42);
  const heldOut = buildScenarioSet(100042);

  await assert.rejects(
    runDoctor(strategy, new MockBacktester(), {
      style: 'conservative',
      treatment: [treatment[0], { ...treatment[1], id: treatment[0].id }],
      heldOut,
    }),
    /duplicate.*id/i,
  );
  await assert.rejects(
    runDoctor(strategy, new MockBacktester(), {
      style: 'conservative',
      treatment: [
        treatment[0],
        { ...treatment[1], dimension: treatment[0].dimension },
      ],
      heldOut,
    }),
    /duplicate.*dimension/i,
  );
});

test('runDoctor rejects mismatched dimensions and invalid shocks', async () => {
  const treatment = buildScenarioSet(42);
  const heldOut = buildScenarioSet(100042);

  await assert.rejects(
    runDoctor(strategy, new MockBacktester(), {
      style: 'conservative',
      treatment,
      heldOut: [heldOut[0]],
    }),
    /dimension/i,
  );
  await assert.rejects(
    runDoctor(strategy, new MockBacktester(), {
      style: 'conservative',
      treatment: [
        {
          ...treatment[0],
          shock: { ...treatment[0].shock, magnitude: Number.NaN },
        },
        treatment[1],
      ],
      heldOut,
    }),
    /magnitude/i,
  );
});

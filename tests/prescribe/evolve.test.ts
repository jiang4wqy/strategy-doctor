import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type {
  Death,
  MaCrossStrategy,
  Metrics,
  Scenario,
  Strategy,
} from '../../src/contracts.ts';
import { prescribe } from '../../src/prescribe/evolve.ts';
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
import { getProfile } from '../../src/scoring/styles.ts';
import { maCrossAdapter } from '../../src/strategy/adapters/ma-cross.ts';

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

const fragile = loadJson(
  '../../examples/trend-follower.json',
) as MaCrossStrategy;

const treatmentScenarios = (): Scenario[] => [
  buildSentimentScenario(
    parseSentimentSnapshot(
      loadJson('../../examples/sentiment-btc.snapshot.json'),
    ),
    42,
  ),
  buildTechnicalScenario(
    parseTechnicalSnapshot(
      loadJson('../../examples/technical-btc-4h.snapshot.json'),
    ),
    99,
  ),
];

const diagnose = async (
  strategy: Strategy,
  scenarios: Scenario[],
  backtest: MockBacktester,
): Promise<Death[]> => {
  const deaths: Death[] = [];
  for (const scenario of scenarios) {
    const metrics = await backtest.run(strategy, scenario);
    const cause = classifyDeath(metrics);
    if (cause !== 'survived') {
      deaths.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        dimension: scenario.dimension,
        cause,
        metrics,
        narrative: scenario.narrative,
      });
    }
  }
  return deaths;
};

const evaluate = async (
  strategy: Strategy,
  scenarios: Scenario[],
  backtest: MockBacktester,
): Promise<Metrics[]> =>
  Promise.all(scenarios.map(scenario => backtest.run(strategy, scenario)));

test('prescribe lowers leverage and does not reduce treatment risk score', async () => {
  const backtest = new MockBacktester();
  const treatment = treatmentScenarios();
  const deaths = await diagnose(fragile, treatment, backtest);
  const profile = getProfile('conservative');
  const prescription = await prescribe(
    fragile,
    deaths,
    treatment,
    backtest,
    profile,
    { candidates: 8, seed: 7 },
  );
  const originalScore = scoreStyle(
    await evaluate(fragile, treatment, backtest),
    profile,
  );
  const patchedScore = scoreStyle(
    await evaluate(prescription.patchedStrategy, treatment, backtest),
    profile,
  );

  assert.equal(prescription.patchedStrategy.archetype, 'ma-cross');
  if (prescription.patchedStrategy.archetype !== 'ma-cross') {
    assert.fail('expected a moving-average prescription');
  }
  assert.ok(
    prescription.patchedStrategy.params.leverage < fragile.params.leverage,
  );
  assert.equal(
    prescription.patchedStrategy.params.fastMA,
    fragile.params.fastMA,
  );
  assert.equal(
    prescription.patchedStrategy.params.slowMA,
    fragile.params.slowMA,
  );
  assert.ok(prescription.rationale.includes('杠杆'));
  assert.ok(prescription.rationale.includes('最终处方'));
  assert.ok(
    prescription.rationale.includes(
      String(prescription.patchedStrategy.params.leverage),
    ),
  );
  assert.ok(Object.keys(prescription.changes).length > 0);
  assert.ok(patchedScore.riskScore >= originalScore.riskScore);
});

test('prescribe is deterministic for identical inputs', async () => {
  const backtest = new MockBacktester();
  const treatment = treatmentScenarios();
  const deaths = await diagnose(fragile, treatment, backtest);
  const profile = getProfile('conservative');
  const options = { candidates: 8, seed: 7 };

  const first = await prescribe(
    fragile,
    deaths,
    treatment,
    backtest,
    profile,
    options,
  );
  const second = await prescribe(
    fragile,
    deaths,
    treatment,
    backtest,
    profile,
    options,
  );

  assert.deepEqual(first, second);
});

test('prescribe leaves a strategy unchanged when there are no actionable deaths', async () => {
  const prescription = await prescribe(
    fragile,
    [],
    treatmentScenarios(),
    new MockBacktester(),
    getProfile('conservative'),
  );

  assert.deepEqual(prescription.changes, {});
  assert.equal(prescription.rationale, '');
  assert.deepEqual(prescription.patchedStrategy, fragile);
});

test('prescribe rejects an empty treatment set and invalid candidate count', async () => {
  const death: Death = {
    scenarioId: 'scenario',
    scenarioName: 'scenario',
    dimension: 'technical',
    cause: 'liquidation',
    narrative: '',
    metrics: {
      pnlPct: -0.9,
      maxDrawdownPct: 0.95,
      liquidated: true,
      numTrades: 1,
      equityCurve: [1, 0.1],
    },
  };

  await assert.rejects(
    prescribe(
      fragile,
      [death],
      [],
      new MockBacktester(),
      getProfile('conservative'),
    ),
    /treatment/,
  );
  await assert.rejects(
    prescribe(
      fragile,
      [death],
      treatmentScenarios(),
      new MockBacktester(),
      getProfile('conservative'),
      { candidates: 0, seed: 7 },
    ),
    /candidates/,
  );
  await assert.rejects(
    prescribe(
      fragile,
      [death],
      treatmentScenarios(),
      new MockBacktester(),
      getProfile('conservative'),
      { candidates: 1, seed: 1.5 },
    ),
    /seed/,
  );
});

test('prescribe delegates mutation policy and labels to the strategy adapter', async () => {
  const calls = {
    targetedPatch: 0,
    targetedFields: 0,
    jitterParams: 0,
    paramLabel: 0,
  };
  const original = {
    targetedPatch: maCrossAdapter.targetedPatch,
    targetedFields: maCrossAdapter.targetedFields,
    jitterParams: maCrossAdapter.jitterParams,
    paramLabel: maCrossAdapter.paramLabel,
  };

  maCrossAdapter.targetedPatch = (...args) => {
    calls.targetedPatch++;
    return original.targetedPatch(...args);
  };
  maCrossAdapter.targetedFields = (...args) => {
    calls.targetedFields++;
    return original.targetedFields(...args);
  };
  maCrossAdapter.jitterParams = (...args) => {
    calls.jitterParams++;
    return original.jitterParams(...args);
  };
  maCrossAdapter.paramLabel = (...args) => {
    calls.paramLabel++;
    return original.paramLabel(...args);
  };

  try {
    const backtest = new MockBacktester();
    const treatment = treatmentScenarios();
    const deaths = await diagnose(fragile, treatment, backtest);
    await prescribe(
      fragile,
      deaths,
      treatment,
      backtest,
      getProfile('conservative'),
      { candidates: 3, seed: 7 },
    );
  } finally {
    maCrossAdapter.targetedPatch = original.targetedPatch;
    maCrossAdapter.targetedFields = original.targetedFields;
    maCrossAdapter.jitterParams = original.jitterParams;
    maCrossAdapter.paramLabel = original.paramLabel;
  }

  assert.ok(calls.targetedPatch > 0);
  assert.ok(calls.targetedFields > 0);
  assert.ok(calls.jitterParams > 0);
  assert.ok(calls.paramLabel > 0);
});

test('prescription search contains no moving-average parameter policy', () => {
  const source = readFileSync(
    new URL('../../src/prescribe/evolve.ts', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /\bfastMA\b|\bslowMA\b/);
  assert.match(source, /targetedPatch/);
  assert.match(source, /targetedFields/);
  assert.match(source, /jitterParams/);
  assert.match(source, /paramLabel/);
});

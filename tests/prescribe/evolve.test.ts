import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type {
  Death,
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

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

const fragile = loadJson('../../examples/trend-follower.json') as Strategy;

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
});

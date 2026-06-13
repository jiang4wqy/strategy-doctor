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
import { validateOnHeldOut } from '../../src/prescribe/validate.ts';
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

const buildScenarioSets = (): {
  treatment: Scenario[];
  heldOut: Scenario[];
} => {
  const sentiment = parseSentimentSnapshot(
    loadJson('../../examples/sentiment-btc.snapshot.json'),
  );
  const technical = parseTechnicalSnapshot(
    loadJson('../../examples/technical-btc-4h.snapshot.json'),
  );

  return {
    treatment: [
      buildSentimentScenario(sentiment, 42),
      buildTechnicalScenario(technical, 99),
    ],
    heldOut: [
      buildSentimentScenario(sentiment, 100042),
      buildTechnicalScenario(technical, 100099),
    ],
  };
};

const runAll = (
  strategy: Strategy,
  scenarios: Scenario[],
  backtest: MockBacktester,
): Promise<Metrics[]> =>
  Promise.all(scenarios.map(scenario => backtest.run(strategy, scenario)));

const diagnose = (
  scenarios: Scenario[],
  results: Metrics[],
): Death[] =>
  scenarios.flatMap((scenario, index) => {
    const cause = classifyDeath(results[index]);
    return cause === 'survived'
      ? []
      : [{
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        dimension: scenario.dimension,
        cause,
        metrics: results[index],
        narrative: scenario.narrative,
      }];
  });

test('frozen snapshots complete diagnosis, prescription, and held-out validation offline', async () => {
  const strategy = loadJson(
    '../../examples/trend-follower.json',
  ) as MaCrossStrategy;
  const { treatment, heldOut } = buildScenarioSets();
  const backtest = new MockBacktester();
  const profile = getProfile('conservative');
  const originalTreatment = await runAll(strategy, treatment, backtest);
  const deaths = diagnose(treatment, originalTreatment);

  assert.deepEqual(
    new Set(deaths.map(death => death.cause)),
    new Set(['drawdown-breach', 'liquidation']),
  );

  const prescription = await prescribe(
    strategy,
    deaths,
    treatment,
    backtest,
    profile,
    { candidates: 24, seed: 7 },
  );
  const patchedTreatment = await runAll(
    prescription.patchedStrategy,
    treatment,
    backtest,
  );
  const originalScore = scoreStyle(originalTreatment, profile);
  const patchedScore = scoreStyle(patchedTreatment, profile);
  const tradeoff = await validateOnHeldOut(
    strategy,
    prescription.patchedStrategy,
    treatment,
    heldOut,
    backtest,
    profile,
  );

  assert.equal(prescription.patchedStrategy.archetype, 'ma-cross');
  if (prescription.patchedStrategy.archetype !== 'ma-cross') {
    assert.fail('expected a moving-average prescription');
  }
  assert.equal(
    prescription.patchedStrategy.params.fastMA,
    strategy.params.fastMA,
  );
  assert.equal(
    prescription.patchedStrategy.params.slowMA,
    strategy.params.slowMA,
  );
  assert.deepEqual(
    Object.keys(prescription.changes).sort(),
    ['leverage', 'positionPct', 'stopLossPct'],
  );
  assert.ok(
    patchedTreatment.filter(result => result.liquidated).length
      < originalTreatment.filter(result => result.liquidated).length,
  );
  assert.ok(patchedScore.riskScore > originalScore.riskScore);
  assert.ok(tradeoff.robustnessGain > 0);
  assert.ok(Number.isFinite(tradeoff.returnCost));
});

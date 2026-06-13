import type {
  BacktestAdapter,
  Metrics,
  Scenario,
  Strategy,
  Tradeoff,
} from '../contracts.ts';
import { scoreStyle } from '../scoring/scorecard.ts';
import type { StyleProfile } from '../scoring/styles.ts';

async function runAll(
  strategy: Strategy,
  scenarios: Scenario[],
  backtest: BacktestAdapter,
): Promise<Metrics[]> {
  return Promise.all(
    scenarios.map(scenario => backtest.run(strategy, scenario)),
  );
}

export async function validateOnHeldOut(
  original: Strategy,
  patched: Strategy,
  treatment: Scenario[],
  heldOut: Scenario[],
  backtest: BacktestAdapter,
  profile: StyleProfile,
): Promise<Tradeoff> {
  if (treatment.length === 0) {
    throw new Error('treatment scenarios must not be empty');
  }
  if (heldOut.length === 0) {
    throw new Error('held-out scenarios must not be empty');
  }

  const treatmentSeeds = new Set(
    treatment.map(scenario => scenario.shock.seed),
  );
  const overlappingSeed = heldOut.find(
    scenario => treatmentSeeds.has(scenario.shock.seed),
  );
  if (overlappingSeed) {
    throw new Error(
      `held-out seed ${overlappingSeed.shock.seed} overlaps treatment set`,
    );
  }

  const [originalResults, patchedResults] = await Promise.all([
    runAll(original, heldOut, backtest),
    runAll(patched, heldOut, backtest),
  ]);
  const originalScore = scoreStyle(originalResults, profile);
  const patchedScore = scoreStyle(patchedResults, profile);

  return {
    robustnessGain: patchedScore.riskScore - originalScore.riskScore,
    returnCost: Number(
      (patchedScore.meanPnlPct - originalScore.meanPnlPct).toFixed(4),
    ),
  };
}

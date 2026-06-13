import type {
  BacktestAdapter,
  Death,
  Metrics,
  Scenario,
  Scorecard,
  Strategy,
  StyleName,
  StyleScore,
} from '../contracts.ts';
import { prescribe } from '../prescribe/evolve.ts';
import { validateOnHeldOut } from '../prescribe/validate.ts';
import { classifyDeath } from '../redteam/diagnose.ts';
import { scoreStyle } from '../scoring/scorecard.ts';
import { getProfile, STYLES } from '../scoring/styles.ts';

export interface DoctorOptions {
  style: StyleName;
  treatment: Scenario[];
  heldOut: Scenario[];
}

async function runAll(
  strategy: Strategy,
  scenarios: Scenario[],
  backtest: BacktestAdapter,
): Promise<Metrics[]> {
  return Promise.all(
    scenarios.map(scenario => backtest.run(strategy, scenario)),
  );
}

function diagnose(
  scenarios: Scenario[],
  metrics: Metrics[],
): Death[] {
  return scenarios.flatMap((scenario, index) => {
    const cause = classifyDeath(metrics[index]);
    return cause === 'survived'
      ? []
      : [{
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        dimension: scenario.dimension,
        cause,
        metrics: metrics[index],
        narrative: scenario.narrative,
      }];
  });
}

function validateScenarioSets(
  treatment: Scenario[],
  heldOut: Scenario[],
): void {
  if (treatment.length === 0) {
    throw new Error('treatment scenarios must not be empty');
  }
  if (heldOut.length === 0) {
    throw new Error('held-out scenarios must not be empty');
  }

  const treatmentSeeds = new Set(
    treatment.map(scenario => scenario.shock.seed),
  );
  const overlapping = heldOut.find(
    scenario => treatmentSeeds.has(scenario.shock.seed),
  );
  if (overlapping) {
    throw new Error(
      `held-out seed ${overlapping.shock.seed} overlaps treatment set`,
    );
  }
}

export async function runDoctor(
  strategy: Strategy,
  backtest: BacktestAdapter,
  options: DoctorOptions,
): Promise<Scorecard> {
  validateScenarioSets(options.treatment, options.heldOut);

  const treatmentMetrics = await runAll(
    strategy,
    options.treatment,
    backtest,
  );
  const deaths = diagnose(options.treatment, treatmentMetrics);
  const perStyle = Object.fromEntries(
    STYLES.map(profile => [
      profile.style,
      scoreStyle(treatmentMetrics, profile),
    ]),
  ) as Record<StyleName, StyleScore>;

  const scorecard: Scorecard = {
    strategyId: strategy.id,
    scenarioSetId:
      `tx${options.treatment[0].shock.seed}/ho${options.heldOut[0].shock.seed}`,
    perStyle,
    deaths,
  };

  if (deaths.length === 0) {
    return scorecard;
  }

  const profile = getProfile(options.style);
  const prescription = await prescribe(
    strategy,
    deaths,
    options.treatment,
    backtest,
    profile,
  );
  const tradeoff = await validateOnHeldOut(
    strategy,
    prescription.patchedStrategy,
    options.treatment,
    options.heldOut,
    backtest,
    profile,
  );

  return {
    ...scorecard,
    prescription,
    tradeoff,
  };
}

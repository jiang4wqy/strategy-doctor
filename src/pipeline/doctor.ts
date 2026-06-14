import type {
  BacktestAdapter,
  Death,
  Metrics,
  Scenario,
  ScenarioEvaluation,
  Scorecard,
  Strategy,
  StyleName,
  StyleScore,
} from '../contracts.ts';
import { prescribe } from '../prescribe/evolve.ts';
import {
  type HeldOutValidation,
  validateOnHeldOutDetailed,
} from '../prescribe/validate.ts';
import { classifyDeath } from '../redteam/diagnose.ts';
import type { Narrator } from '../redteam/narrate.ts';
import { scoreStyle } from '../scoring/scorecard.ts';
import { getProfile, STYLES } from '../scoring/styles.ts';

export interface DoctorOptions {
  style: StyleName;
  treatment: Scenario[];
  heldOut: Scenario[];
  narrator?: Narrator;
}

export interface DoctorResult {
  scorecard: Scorecard;
  heldOut: HeldOutValidation;
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
  evaluations: ScenarioEvaluation[],
): Death[] {
  return evaluations.flatMap(evaluation => {
    return evaluation.cause === 'survived'
      ? []
      : [{
        scenarioId: evaluation.scenarioId,
        scenarioName: evaluation.scenarioName,
        dimension: evaluation.dimension,
        cause: evaluation.cause,
        metrics: evaluation.metrics,
        narrative: evaluation.narrative,
      }];
  });
}

const SOURCE_SKILLS = {
  sentiment: 'sentiment-analyst',
  macro: 'macro-analyst',
  'market-intel': 'market-intel',
  news: 'news-briefing',
  technical: 'technical-analysis',
} as const;

const SHOCK_KINDS = {
  sentiment: new Set(['squeeze']),
  macro: new Set(['crash', 'grind']),
  'market-intel': new Set(['crash']),
  news: new Set(['gap']),
  technical: new Set(['whipsaw']),
} as const;

function validateScenarioSet(label: string, scenarios: Scenario[]): void {
  const ids = new Set<string>();
  const dimensions = new Set<string>();
  const rootSeed = scenarios[0].shock.seed;

  for (const scenario of scenarios) {
    if (ids.has(scenario.id)) {
      throw new Error(`${label} contains duplicate scenario id: ${scenario.id}`);
    }
    if (dimensions.has(scenario.dimension)) {
      throw new Error(
        `${label} contains duplicate dimension: ${scenario.dimension}`,
      );
    }
    ids.add(scenario.id);
    dimensions.add(scenario.dimension);

    if (
      scenario.id.trim() === ''
      || scenario.name.trim() === ''
      || scenario.narrative.trim() === ''
    ) {
      throw new Error(`${label} scenario text fields must not be empty`);
    }
    if (scenario.sourceSkill !== SOURCE_SKILLS[scenario.dimension]) {
      throw new Error(
        `${label} sourceSkill does not match ${scenario.dimension}`,
      );
    }
    if (
      scenario.sourceObservedAt !== undefined
      && !Number.isFinite(Date.parse(scenario.sourceObservedAt))
    ) {
      throw new Error(`${label} sourceObservedAt must be a valid date-time`);
    }
    if (!Number.isInteger(scenario.severity) || scenario.severity < 1 || scenario.severity > 5) {
      throw new Error(`${label} severity must be an integer from 1 to 5`);
    }
    if (!SHOCK_KINDS[scenario.dimension].has(scenario.shock.kind as never)) {
      throw new Error(
        `${label} shock kind does not match ${scenario.dimension}`,
      );
    }
    if (
      !Number.isFinite(scenario.shock.magnitude)
      || scenario.shock.magnitude <= 0
      || scenario.shock.magnitude > 1
    ) {
      throw new Error(`${label} shock magnitude must be in (0, 1]`);
    }
    if (
      !Number.isSafeInteger(scenario.shock.durationBars)
      || scenario.shock.durationBars < 1
    ) {
      throw new Error(`${label} shock durationBars must be a positive integer`);
    }
    if (
      !Number.isFinite(scenario.shock.volMult)
      || scenario.shock.volMult <= 0
      || scenario.shock.volMult > 10
    ) {
      throw new Error(`${label} shock volMult must be in (0, 10]`);
    }
    if (!Number.isSafeInteger(scenario.shock.seed)) {
      throw new Error(`${label} shock seed must be a safe integer`);
    }
    if (scenario.shock.seed !== rootSeed) {
      throw new Error(`${label} scenarios must share one root seed`);
    }
  }
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
  validateScenarioSet('treatment', treatment);
  validateScenarioSet('held-out', heldOut);

  const treatmentDimensions = treatment
    .map(scenario => scenario.dimension)
    .sort();
  const heldOutDimensions = heldOut
    .map(scenario => scenario.dimension)
    .sort();
  if (treatmentDimensions.join('|') !== heldOutDimensions.join('|')) {
    throw new Error('treatment and held-out dimension sets must match');
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

async function evaluate(
  scenarios: Scenario[],
  metrics: Metrics[],
  narrator?: Narrator,
): Promise<ScenarioEvaluation[]> {
  return Promise.all(scenarios.map(async (scenario, index) => {
    const result = metrics[index];
    const cause = classifyDeath(result);
    const narrative = narrator
      ? await narrator({ scenario, metrics: result, cause })
      : scenario.narrative;
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      dimension: scenario.dimension,
      sourceSkill: scenario.sourceSkill,
      sourceObservedAt: scenario.sourceObservedAt,
      severity: scenario.severity,
      shock: scenario.shock,
      metrics: result,
      cause,
      damageScore:
        (result.liquidated ? 1000 : 0)
        + result.maxDrawdownPct * 100
        - result.pnlPct * 100,
      narrative,
    };
  }));
}

export async function runDoctorDetailed(
  strategy: Strategy,
  backtest: BacktestAdapter,
  options: DoctorOptions,
): Promise<DoctorResult> {
  validateScenarioSets(options.treatment, options.heldOut);

  const treatmentMetrics = await runAll(
    strategy,
    options.treatment,
    backtest,
  );
  const evaluations = await evaluate(
    options.treatment,
    treatmentMetrics,
    options.narrator,
  );
  const deaths = diagnose(evaluations);
  const perStyle = Object.fromEntries(
    STYLES.map(profile => [
      profile.style,
      scoreStyle(treatmentMetrics, profile),
    ]),
  ) as Record<StyleName, StyleScore>;

  const profile = getProfile(options.style);
  const prescription = await prescribe(
    strategy,
    deaths,
    options.treatment,
    backtest,
    profile,
  );
  const heldOut = await validateOnHeldOutDetailed(
    strategy,
    prescription.patchedStrategy,
    options.treatment,
    options.heldOut,
    backtest,
    profile,
  );

  return {
    scorecard: {
      strategyId: strategy.id,
      scenarioSetId:
        `tx${options.treatment[0].shock.seed}/ho${options.heldOut[0].shock.seed}`,
      perStyle,
      evaluations,
      deaths,
      prescription,
      tradeoff: heldOut.tradeoff,
    },
    heldOut,
  };
}

export async function runDoctor(
  strategy: Strategy,
  backtest: BacktestAdapter,
  options: DoctorOptions,
): Promise<Scorecard> {
  return (await runDoctorDetailed(strategy, backtest, options)).scorecard;
}

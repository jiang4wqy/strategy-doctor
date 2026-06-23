import type {
  BacktestAdapter,
  Death,
  Metrics,
  NarrationConsensus,
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
  onTrace?: (entry: string) => void;
}

export interface DoctorResult {
  scorecard: Scorecard;
  heldOut: HeldOutValidation;
  modelConsistency?: {
    prescriptionAgreement?: {
      agreementRate: number;
      requestedStyles: StyleName[];
      agreeingStyles: StyleName[];
      mismatches: string[];
    };
    narrationAgreement?: {
      agreementRate: number;
      requestedModels: string[];
      agreeingModels: string[];
      mismatches: string[];
      avgSimilarity: number;
      sampleCount: number;
    };
  };
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

const VALIDATION_PROFILE_ENV = 'DOCTOR_PRESCRIPTION_VALIDATION_STYLES';

function getValidationProfiles(): StyleName[] {
  const raw = process.env[VALIDATION_PROFILE_ENV];
  if (!raw) {
    return [];
  }
  const requested = new Set<StyleName>();
  for (const item of raw.split(',').map(value => value.trim())) {
    if (
      item === 'conservative'
      || item === 'aggressive'
      || item === 'trend'
    ) {
      requested.add(item);
    }
  }
  return [...requested];
}

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

function summarizeScenarioSet(label: string, scenarios: Scenario[]): string {
  const shockKinds = new Set(scenarios.map(scenario => scenario.shock.kind)).size;
  const severity = scenarios.map(scenario => scenario.severity);
  const minSeverity = Math.min(...severity);
  const maxSeverity = Math.max(...severity);
  const causes = Object.entries(
    scenarios.reduce((counts, scenario) => {
      counts[scenario.dimension] = (counts[scenario.dimension] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>),
  )
    .map(([dimension, count]) => `${dimension}=${count}`)
    .join(', ');

  return `${label}: n=${scenarios.length}, seed=${scenarios[0].shock.seed}, shockKinds=${shockKinds}, severity=[${minSeverity}, ${maxSeverity}], dims=[${causes}]`;
}

function summarizeStyleScores(perStyle: Record<StyleName, StyleScore>): string {
  return Object.values(perStyle)
    .map(
      score =>
        `${score.style}:{riskScore=${score.riskScore.toFixed(2)}, survived=${score.survived}, worstDD=${score.worstDrawdownPct.toFixed(4)}, meanPnL=${(
          score.meanPnlPct * 100
        ).toFixed(2)}%}`,
    )
    .join(' | ');
}

async function evaluate(
  scenarios: Scenario[],
  metrics: Metrics[],
  narrator?: Narrator,
): Promise<ScenarioEvaluation[]> {
  return Promise.all(scenarios.map(async (scenario, index) => {
    const result = metrics[index];
    const cause = classifyDeath(result);
    const narrated = narrator
      ? await narrator({ scenario, metrics: result, cause })
      : scenario.narrative;
    const narrative = typeof narrated === 'string'
      ? narrated
      : narrated.text;
    const narrationConsensus = typeof narrated === 'object' && narrated !== null
      ? narrated.consensus
      : undefined;
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
      narrationConsensus: narrationConsensus as
        | ScenarioEvaluation['narrationConsensus']
        | undefined,
    };
  }));
}

function aggregateNarrationAgreement(
  evaluations: ScenarioEvaluation[],
): {
  agreementRate: number;
  requestedModels: string[];
  agreeingModels: string[];
  mismatches: string[];
  avgSimilarity: number;
  sampleCount: number;
} | undefined {
  const rates: NarrationConsensus[] = evaluations
    .map(evaluation => evaluation.narrationConsensus)
    .filter((consensus): consensus is NarrationConsensus => (
      consensus !== undefined
      && consensus !== null
      && typeof consensus.agreementRate === 'number'
    ));

  if (rates.length === 0) {
    return undefined;
  }

  const requestedModels = new Set<string>();
  const agreeingModels = new Set<string>();
  const mismatches = new Set<string>();
  let avgSimilarity = 0;
  for (const consensus of rates) {
    for (const model of consensus.requestedModels) {
      requestedModels.add(model);
    }
    for (const model of consensus.agreeingModels) {
      agreeingModels.add(model);
    }
    for (const model of consensus.mismatches) {
      mismatches.add(model);
    }
    avgSimilarity += consensus.avgSimilarity;
  }

  return {
    agreementRate: rates.reduce((sum, item) => sum + item.agreementRate, 0)
      / rates.length,
    requestedModels: [...requestedModels],
    agreeingModels: [...agreeingModels],
    mismatches: [...mismatches],
    avgSimilarity: Number((avgSimilarity / rates.length).toFixed(4)),
    sampleCount: rates.length,
  };
}

export async function runDoctorDetailed(
  strategy: Strategy,
  backtest: BacktestAdapter,
  options: DoctorOptions,
): Promise<DoctorResult> {
  validateScenarioSets(options.treatment, options.heldOut);
  const trace = options.onTrace;
  trace?.('doctor-start');
  trace?.(
    `doctor start strategy=${strategy.id} style=${options.style} ${summarizeScenarioSet('treatment', options.treatment)} ${summarizeScenarioSet('heldOut', options.heldOut)}`,
  );

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
  trace?.(`scorecard-style-summaries ${summarizeStyleScores(perStyle)}`);

  const profile = getProfile(options.style);
  const validationProfiles = getValidationProfiles();
  const prescription = await prescribe(
    strategy,
    deaths,
    options.treatment,
    backtest,
    profile,
    options.onTrace
      ? {
          onTrace: options.onTrace,
          validationProfiles: validationProfiles.length > 0
            ? validationProfiles
            : [options.style],
      }
      : {
          validationProfiles: validationProfiles.length > 0
            ? validationProfiles
            : [options.style],
      },
  );
  const heldOut = await validateOnHeldOutDetailed(
    strategy,
    prescription.patchedStrategy,
    options.treatment,
    options.heldOut,
    backtest,
    profile,
  );

  const heldOutGain = `${heldOut.tradeoff.robustnessGain >= 0 ? '+' : ''}${heldOut.tradeoff.robustnessGain.toFixed(4)}`;
  const heldOutCost = `${heldOut.tradeoff.returnCost >= 0 ? '+' : ''}${(
    heldOut.tradeoff.returnCost * 100
  ).toFixed(2)}%`;
  const modelConsistency = {
    prescriptionAgreement: prescription.consensus
      ? {
        agreementRate: prescription.consensus.agreementRate,
        requestedStyles: prescription.consensus.requestedStyles,
        agreeingStyles: prescription.consensus.agreeingStyles,
        mismatches: prescription.consensus.mismatches,
      }
      : undefined,
    narrationAgreement: aggregateNarrationAgreement(evaluations),
  };

  trace?.(
    `doctor end: prescriptions=${Object.keys(prescription.changes).length} changes, heldOutMetrics=${heldOut.patchedMetrics.length}/${heldOut.originalMetrics.length}, robustness=${heldOutGain}, returnCost=${heldOutCost}`,
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
    modelConsistency,
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

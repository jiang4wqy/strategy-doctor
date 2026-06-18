import type {
  BacktestAdapter,
  Death,
  DeathCause,
  Metrics,
  ParameterChanges,
  Prescription,
  Scenario,
  Strategy,
  StrategyParamKey,
  StrategyParams,
  TargetedPatch,
} from '../contracts.ts';
import { mulberry32 } from '../backtest/path.ts';
import { scoreStyle } from '../scoring/scorecard.ts';
import type { StyleProfile } from '../scoring/styles.ts';
import {
  getStrategyAdapter,
  type AnyStrategyAdapter,
} from '../strategy/registry.ts';
import { diffParams } from './mutations.ts';

export interface PrescribeOptions {
  candidates: number;
  seed: number;
}

interface CandidateEvaluation {
  params: StrategyParams;
  score: number;
  survived: boolean;
  liquidations: number;
  worstDrawdown: number;
  meanPnl: number;
}

const DEFAULT_OPTIONS: PrescribeOptions = {
  candidates: 8,
  seed: 7,
};

function parameterRecord(
  params: StrategyParams | ParameterChanges,
): Record<string, number | undefined> {
  return params as unknown as Record<string, number | undefined>;
}

function summarizeChanges(
  before: StrategyParams,
  changes: ParameterChanges,
  adapter: AnyStrategyAdapter,
): string {
  const previous = parameterRecord(before);
  const updated = parameterRecord(changes);
  return (Object.keys(changes) as StrategyParamKey[])
    .map(key => (
      `${adapter.paramLabel(key as never)} ${previous[key]}→${updated[key]}`
    ))
    .join('，');
}

function preservesTargetedIntent(
  candidate: StrategyParams,
  original: StrategyParams,
  base: StrategyParams,
  patch: ParameterChanges,
  causes: ReadonlySet<DeathCause>,
): boolean {
  if (causes.has('liquidation')) {
    const stopLimit = 0.8 / candidate.leverage / 2;
    if (
      candidate.leverage > base.leverage
      || candidate.stopLossPct > stopLimit
    ) {
      return false;
    }
  }
  if (
    causes.has('drawdown-breach')
    && candidate.positionPct > base.positionPct
  ) {
    return false;
  }

  const originalValues = parameterRecord(original);
  const baseValues = parameterRecord(base);
  const candidateValues = parameterRecord(candidate);
  for (const key of Object.keys(patch) as StrategyParamKey[]) {
    if (key === 'stopLossPct') {
      continue;
    }
    const originalValue = originalValues[key];
    const baseValue = baseValues[key];
    const candidateValue = candidateValues[key];
    if (
      originalValue === undefined
      || baseValue === undefined
      || candidateValue === undefined
    ) {
      continue;
    }
    if (baseValue < originalValue && candidateValue > baseValue) {
      return false;
    }
    if (baseValue > originalValue && candidateValue < baseValue) {
      return false;
    }
  }
  return true;
}

function isBetter(
  candidate: CandidateEvaluation,
  current: CandidateEvaluation | undefined,
): boolean {
  if (!current) {
    return true;
  }
  if (candidate.survived !== current.survived) {
    return candidate.survived;
  }
  if (candidate.score !== current.score) {
    return candidate.score > current.score;
  }
  if (candidate.liquidations !== current.liquidations) {
    return candidate.liquidations < current.liquidations;
  }
  if (candidate.worstDrawdown !== current.worstDrawdown) {
    return candidate.worstDrawdown < current.worstDrawdown;
  }
  return candidate.meanPnl > current.meanPnl;
}

async function evaluateCandidate(
  strategy: Strategy,
  params: StrategyParams,
  treatment: Scenario[],
  backtest: BacktestAdapter,
  profile: StyleProfile,
): Promise<CandidateEvaluation> {
  const trial = {
    ...strategy,
    id: `${strategy.id}-rx`,
    params,
  } as Strategy;
  const results: Metrics[] = await Promise.all(
    treatment.map(scenario => backtest.run(trial, scenario)),
  );
  const styleScore = scoreStyle(results, profile);

  return {
    params,
    score: styleScore.riskScore,
    survived: styleScore.survived,
    liquidations: results.filter(result => result.liquidated).length,
    worstDrawdown: styleScore.worstDrawdownPct,
    meanPnl: styleScore.meanPnlPct,
  };
}

export async function prescribe(
  strategy: Strategy,
  deaths: Death[],
  treatment: Scenario[],
  backtest: BacktestAdapter,
  profile: StyleProfile,
  options: PrescribeOptions = DEFAULT_OPTIONS,
): Promise<Prescription> {
  const causes = new Set(
    deaths
      .map(death => death.cause)
      .filter(cause => cause !== 'survived'),
  );
  if (causes.size === 0) {
    return {
      changes: {},
      rationale: '',
      patchedStrategy: strategy,
    };
  }
  if (treatment.length === 0) {
    throw new Error('treatment scenarios must not be empty');
  }
  if (!Number.isInteger(options.candidates) || options.candidates < 1) {
    throw new Error('candidates must be a positive integer');
  }
  if (!Number.isSafeInteger(options.seed)) {
    throw new Error('seed must be a safe integer');
  }

  const adapter = getStrategyAdapter(
    strategy.archetype,
  ) as AnyStrategyAdapter;
  const { patch, rationale } = adapter.targetedPatch(
    strategy.params as never,
    [...causes],
  ) as TargetedPatch<StrategyParams>;
  const base = {
    ...strategy.params,
    ...patch,
  } as StrategyParams;
  const random = mulberry32(options.seed);
  const fields = adapter.targetedFields(
    causes,
  ) as readonly StrategyParamKey[];
  const candidates: StrategyParams[] = [base];
  for (let index = 1; index < options.candidates; index++) {
    const candidate = adapter.jitterParams(
      base as never,
      random,
      fields as never,
    ) as StrategyParams;
    if (
      preservesTargetedIntent(
        candidate,
        strategy.params,
        base,
        patch as ParameterChanges,
        causes,
      )
    ) {
      candidates.push(candidate);
    }
  }

  let best: CandidateEvaluation | undefined;
  for (const candidate of candidates) {
    const evaluation = await evaluateCandidate(
      strategy,
      candidate,
      treatment,
      backtest,
      profile,
    );
    if (isBetter(evaluation, best)) {
      best = evaluation;
    }
  }

  const bestParams = best!.params;
  const changes = diffParams(
    strategy.params,
    bestParams,
  ) as ParameterChanges;
  const summary = summarizeChanges(strategy.params, changes, adapter);
  return {
    changes,
    rationale: `${rationale.join('；')}；最终处方：${summary}`,
    patchedStrategy: {
      ...strategy,
      id: `${strategy.id}-rx`,
      name: `${strategy.name}（处方修补版）`,
      params: bestParams,
    } as Strategy,
  };
}

import type {
  BacktestAdapter,
  Death,
  DeathCause,
  Metrics,
  Prescription,
  Scenario,
  Strategy,
  StrategyParams,
} from '../contracts.ts';
import { mulberry32 } from '../backtest/path.ts';
import { scoreStyle } from '../scoring/scorecard.ts';
import type { StyleProfile } from '../scoring/styles.ts';
import {
  diffParams,
  jitterParams,
  targetedPatch,
} from './mutations.ts';

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

const PARAM_LABELS: Record<keyof StrategyParams, string> = {
  fastMA: '快均线',
  slowMA: '慢均线',
  leverage: '杠杆',
  stopLossPct: '止损比例',
  positionPct: '仓位比例',
};

function targetedFields(causes: Set<DeathCause>): (keyof StrategyParams)[] {
  const fields = new Set<keyof StrategyParams>();
  if (causes.has('liquidation')) {
    fields.add('leverage');
    fields.add('stopLossPct');
  }
  if (causes.has('drawdown-breach')) {
    fields.add('positionPct');
  }
  if (causes.has('stop-loss-bleed')) {
    fields.add('fastMA');
    fields.add('slowMA');
  }
  return [...fields];
}

function summarizeChanges(
  before: StrategyParams,
  changes: Partial<StrategyParams>,
): string {
  return (Object.keys(changes) as (keyof StrategyParams)[])
    .map(key => `${PARAM_LABELS[key]} ${before[key]}→${changes[key]}`)
    .join('，');
}

function preservesTargetedIntent(
  candidate: StrategyParams,
  base: StrategyParams,
  causes: Set<DeathCause>,
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
  if (
    causes.has('stop-loss-bleed')
    && (
      candidate.fastMA < base.fastMA
      || candidate.slowMA < base.slowMA
    )
  ) {
    return false;
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
  const trial: Strategy = {
    ...strategy,
    id: `${strategy.id}-rx`,
    params,
  };
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

  const { patch, rationale } = targetedPatch(
    strategy.params,
    [...causes],
  );
  const base: StrategyParams = {
    ...strategy.params,
    ...patch,
  };
  const random = mulberry32(options.seed);
  const fields = targetedFields(causes);
  const candidates: StrategyParams[] = [base];
  for (let index = 1; index < options.candidates; index++) {
    const candidate = jitterParams(base, random, fields);
    if (preservesTargetedIntent(candidate, base, causes)) {
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
  const changes = diffParams(strategy.params, bestParams);
  const summary = summarizeChanges(strategy.params, changes);
  return {
    changes,
    rationale: `${rationale.join('；')}；最终处方：${summary}`,
    patchedStrategy: {
      ...strategy,
      id: `${strategy.id}-rx`,
      name: `${strategy.name}（处方修补版）`,
      params: bestParams,
    },
  };
}

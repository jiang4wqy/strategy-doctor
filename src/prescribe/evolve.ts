import type {
  BacktestAdapter,
  Death,
  DeathCause,
  Metrics,
  StyleName,
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
import { getProfile, type StyleProfile } from '../scoring/styles.ts';
import {
  getStrategyAdapter,
  type AnyStrategyAdapter,
} from '../strategy/registry.ts';
import { diffParams } from './mutations.ts';

export interface PrescribeOptions {
  candidates?: number;
  seed?: number;
  validationProfiles?: readonly StyleName[];
  onTrace?: (entry: string) => void;
}

interface CandidateEvaluation {
  params: StrategyParams;
  score: number;
  survived: boolean;
  liquidations: number;
  worstDrawdown: number;
  meanPnl: number;
}

interface ProfileCandidateEvaluation extends CandidateEvaluation {
  style: StyleName;
  params: StrategyParams;
  index: number;
}

interface ProfileConsensus {
  primaryStyle: StyleName;
  requestedStyles: StyleName[];
  agreeingStyles: StyleName[];
  agreementRate: number;
  mismatches: StyleName[];
}

type PrescribeResolvedOptions = Required<Pick<PrescribeOptions, 'candidates' | 'seed'>> & {
  validationProfiles: StyleName[];
  onTrace?: PrescribeOptions['onTrace'];
};

const DEFAULT_OPTIONS: PrescribeResolvedOptions = {
  candidates: 8,
  seed: 7,
  validationProfiles: [],
};

function normalizeValidationProfiles(
  validationProfiles: readonly StyleName[],
  primaryStyle: StyleName,
): StyleName[] {
  const profiles = new Set<StyleName>([primaryStyle]);
  for (const candidate of validationProfiles) {
    profiles.add(candidate);
  }
  return [...profiles];
}

function computeConsensus(
  orderedProfiles: ProfileCandidateEvaluation[],
  primaryProfile: StyleName,
): ProfileConsensus {
  const requested = orderedProfiles.map(item => item.style);
  const primary = orderedProfiles
    .find(item => item.style === primaryProfile);
  const primaryKey = primary ? JSON.stringify(primary.params) : JSON.stringify({});
  const agreeing = orderedProfiles
    .filter(item => JSON.stringify(item.params) === primaryKey)
    .map(item => item.style);
  const mismatches = orderedProfiles
    .map(item => item.style)
    .filter(style => !agreeing.includes(style));

  return {
    primaryStyle: primaryProfile,
    requestedStyles: requested,
    agreeingStyles: agreeing,
    agreementRate: requested.length > 0 ? agreeing.length / requested.length : 1,
    mismatches,
  };
}

function formatConsensus(consensus: ProfileConsensus): string {
  const mismatch = consensus.mismatches.length > 0
    ? `${consensus.mismatches.join(',')} mismatch`
    : 'all profiles agree';
  return `prescription consensus: primary=${consensus.primaryStyle}, agreement=${(
    consensus.agreementRate * 100
  ).toFixed(2)}%, requested=${consensus.requestedStyles.join(',')}, ${mismatch}`;
}

function parameterRecord(
  params: StrategyParams | ParameterChanges,
): Record<string, number | undefined> {
  return params as unknown as Record<string, number | undefined>;
}

function labelWithoutLocale(
  key: StrategyParamKey,
  adapter: AnyStrategyAdapter,
): string {
  const label = adapter.paramLabel(key as never);
  return /[\u4e00-\u9fff]/.test(label) ? key : label;
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
      `${labelWithoutLocale(key, adapter)} ${previous[key]} -> ${updated[key]}`
    ))
    .join('; ');
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

async function evaluateCandidateForProfile(
  strategy: Strategy,
  candidates: StrategyParams[],
  treatment: Scenario[],
  backtest: BacktestAdapter,
  profile: StyleProfile,
  trace?: PrescribeOptions['onTrace'],
): Promise<ProfileCandidateEvaluation> {
  let best: CandidateEvaluation | undefined;
  let bestIndex = 0;
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const evaluation = await evaluateCandidate(
      strategy,
      candidate,
      treatment,
      backtest,
      profile,
    );
    trace?.(
      `[${profile.style}] candidate #${index + 1}/${candidates.length}: ` +
      `risk=${evaluation.score} survived=${evaluation.survived} ` +
      `liquidations=${evaluation.liquidations} ` +
      `worstDrawdown=${evaluation.worstDrawdown.toFixed(4)} ` +
      `meanPnL=${(evaluation.meanPnl * 100).toFixed(2)}%`,
    );
    if (isBetter(evaluation, best)) {
      best = evaluation;
      bestIndex = index;
    }
  }

  if (!best) {
    throw new Error(`no candidate passed validation for profile ${profile.style}`);
  }

  return {
    ...best,
    style: profile.style,
    index: bestIndex,
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
  const resolvedOptions: PrescribeResolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    validationProfiles: [...(options.validationProfiles ?? [])],
  };
  const causes = new Set(
    deaths
      .map(death => death.cause)
      .filter(cause => cause !== 'survived'),
  );
  if (causes.size === 0) {
    const consensus = resolvedOptions.validationProfiles.length > 0
      ? {
        primaryStyle: profile.style,
        requestedStyles: normalizeValidationProfiles(
          resolvedOptions.validationProfiles,
          profile.style,
        ),
        agreeingStyles: [profile.style],
        agreementRate: 1,
        mismatches: [],
      }
      : undefined;
    return {
      changes: {},
      rationale: '',
      patchedStrategy: strategy,
      consensus,
    };
  }
  if (treatment.length === 0) {
    throw new Error('treatment scenarios must not be empty');
  }
  if (!Number.isInteger(resolvedOptions.candidates) || resolvedOptions.candidates < 1) {
    throw new Error('candidates must be a positive integer');
  }

  const adapter = getStrategyAdapter(
    strategy.archetype,
  ) as AnyStrategyAdapter;
  const trace = resolvedOptions.onTrace;
  trace?.(
    `prescribe start: ${strategy.id} | archetype=${strategy.archetype} | causes=${[
      ...causes,
    ].sort().join(',')}`,
  );

  const { patch, rationale } = adapter.targetedPatch(
    strategy.params as never,
    [...causes],
  ) as TargetedPatch<StrategyParams>;
  const base = {
    ...strategy.params,
    ...patch,
  } as StrategyParams;
  const random = mulberry32(resolvedOptions.seed);
  const fields = adapter.targetedFields(
    causes,
  ) as readonly StrategyParamKey[];
  const candidates: StrategyParams[] = [base];
  const candidateKeys = new Set<string>([JSON.stringify(base)]);
  for (let index = 1; index < resolvedOptions.candidates; index++) {
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
      const key = JSON.stringify(candidate);
      if (!candidateKeys.has(key)) {
        candidateKeys.add(key);
        candidates.push(candidate);
      }
    }
  }

  const profiles = normalizeValidationProfiles(
    resolvedOptions.validationProfiles,
    profile.style,
  ).map(requested => getProfile(requested));

  const profileEvaluations = await Promise.all(profiles.map(
    searchProfile => evaluateCandidateForProfile(
      strategy,
      candidates,
      treatment,
      backtest,
      searchProfile,
      trace,
    ),
  ));
  const best = profileEvaluations[0];
  if (!best) {
    throw new Error('prescription profile search failed');
  }
  const consensus = computeConsensus(profileEvaluations, profile.style);
  trace?.(formatConsensus(consensus));
  if (consensus.agreementRate < 1 && profiles.length > 1) {
    trace?.(
      `prescription consensus warning: ${consensus.mismatches.join(',')} ` +
      `did not match ${consensus.primaryStyle}`,
    );
  }

  const bestParams = best.params;
  const changes = diffParams(
    strategy.params,
    bestParams,
  ) as ParameterChanges;
  const summary = summarizeChanges(strategy.params, changes, adapter);
  trace?.(
    `selected candidate #${best.index + 1} with ${
      Object.keys(changes).length
    } parameter edit(s).`,
  );
  return {
    changes,
    rationale: `${rationale.join('; ')}; final prescription: ${summary}`,
    consensus,
    patchedStrategy: {
      ...strategy,
      id: `${strategy.id}-rx`,
      name: `${strategy.name} (prescription-adjusted)`,
      params: bestParams,
    } as Strategy,
  };
}

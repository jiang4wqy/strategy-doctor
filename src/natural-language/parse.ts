import { StrategyValidationError, type ModelConsensus } from '../contracts.ts';
import type {
  DraftWarning,
  StrategyDraft,
} from '../platform/contracts.ts';
import {
  parseWithAnthropic,
  type AnthropicParserOptions,
} from './anthropic.ts';
import {
  parseWithQwen,
  type QwenParserOptions,
} from './qwen.ts';
import { DescriptionParseError } from './errors.ts';
import { parseWithRules } from './rules.ts';

export interface ParseDescriptionOptions extends AnthropicParserOptions {
  rules?: typeof parseWithRules;
  anthropic?: typeof parseWithAnthropic;
  validator?: typeof parseWithAnthropic;
  qwen?: typeof parseWithQwen;
  validatorModel?: string;
  provider?: 'anthropic' | 'qwen';
  validatorProvider?: 'anthropic' | 'qwen';
  enableConsensus?: boolean;
}

function draftSignature(
  draft: StrategyDraft,
): string {
  const params = draft.strategy.params;
  const ordered = Object.entries(params)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('|');
  return `${draft.strategy.archetype}|${draft.strategy.timeframe}|${draft.strategy.universe[0]}|${ordered}`;
}

function buildConsensus(
  candidates: Array<{
    model: string;
    confidence: number;
    draft: StrategyDraft;
  }>,
): ModelConsensus | undefined {
  if (candidates.length < 2) {
    return undefined;
  }
  const votes = candidates
    .map(candidate => {
      const signature = draftSignature(candidate.draft);
      return {
        model: candidate.model,
        signature,
        confidence: candidate.confidence,
        agree: true,
      };
    });
  const references = votes.map(vote => vote.signature);
  const primary = references[0] ?? '';
  const agrees = votes.map(vote => vote.signature === primary);
  for (let index = 0; index < votes.length; index++) {
    votes[index] = { ...votes[index], agree: agrees[index] };
  }
  const agreed = votes.filter(vote => vote.agree).length;
  const score = agreed / votes.length;
  return {
    models: votes.map(vote => vote.model),
    score,
    signature: primary,
    votes,
  };
}

type NLProvider = 'anthropic' | 'qwen';

function getProvider(options: ParseDescriptionOptions): NLProvider {
  const env = options.env ?? process.env;
  if (options.provider) {
    return options.provider;
  }
  if (env.DOCTOR_NL_PROVIDER === 'qwen' || env.DOCTOR_NL_PROVIDER === 'anthropic') {
    return env.DOCTOR_NL_PROVIDER;
  }
  if (env.DOCTOR_NL_QWEN_ENABLED === '1') {
    return 'qwen';
  }
  return 'anthropic';
}

function getConfiguredModel(provider: NLProvider, options: ParseDescriptionOptions): string {
  const env = options.env ?? process.env;
  if (provider === 'qwen') {
    return options.model
      ?? env.DOCTOR_QWEN_MODEL
      ?? env.DOCTOR_NL_MODEL
      ?? '';
  }
  return options.model
    ?? env.DOCTOR_NL_MODEL
    ?? '';
}

function configuredForProvider(
  provider: NLProvider,
  options: ParseDescriptionOptions,
): boolean {
  const env = options.env ?? process.env;
  if (provider === 'anthropic') {
    if (options.anthropic) {
      return true;
    }
    return env.DOCTOR_NL_AI_ENABLED === '1'
      && Boolean(env.ANTHROPIC_API_KEY)
      && Boolean(getConfiguredModel(provider, options));
  }
  if (options.qwen) {
    return true;
  }
  return env.DOCTOR_NL_AI_ENABLED === '1'
    && (env.DOCTOR_NL_QWEN_ENABLED === '1'
      || env.DOCTOR_NL_PROVIDER === 'qwen')
    && Boolean(env.QWEN_API_KEY || env.DOCTOR_QWEN_API_KEY)
    && Boolean(getConfiguredModel(provider, options));
}

function configuredForAi(options: ParseDescriptionOptions): boolean {
  return configuredForProvider(getProvider(options), options);
}

function shouldRunConsensus(
  options: ParseDescriptionOptions,
): boolean {
  const env = options.env ?? process.env;
  if (typeof options.enableConsensus === 'boolean') {
    return options.enableConsensus;
  }
  return env.DOCTOR_NL_CONSENSUS === '1';
}

function isConsistent(
  candidates: Array<{
    model: string;
    confidence: number;
    draft: StrategyDraft;
  }>,
): boolean {
  const consensus = buildConsensus(candidates);
  if (!consensus) {
    return true;
  }
  return consensus.score === 1;
}

function fallbackWarning(): DraftWarning {
  return {
    code: 'AI_FALLBACK_FAILED',
    message: 'AI parsing was unavailable; review the local draft carefully.',
  };
}

function consensusWarning(score: number): DraftWarning {
  return {
    code: 'CONSENSUS_LOW',
    message: `Model consensus is low (${score.toFixed(2)}). Please review manual assumption fields.`,
  };
}

export async function parseStrategyDescription(
  description: string,
  options: ParseDescriptionOptions = {},
): Promise<StrategyDraft> {
  const normalized = description.trim();
  if (normalized.length < 1 || normalized.length > 2000) {
    throw new StrategyValidationError(
      'INVALID_REQUEST',
      'description must contain from 1 to 2000 characters',
      'description',
    );
  }

  const rules = options.rules ?? parseWithRules;
  const provider = getProvider(options);
  const primary = provider === 'qwen'
    ? (options.qwen ?? parseWithQwen)
    : (options.anthropic ?? parseWithAnthropic);
  const validatorProvider = options.validatorProvider
    ?? provider;
  const validator = validatorProvider === 'qwen'
    ? (options.validator as unknown as (typeof parseWithQwen) | undefined)
      ?? parseWithQwen
    : (options.validator ?? parseWithAnthropic);
  let localDraft: StrategyDraft | undefined;
  let localError: DescriptionParseError | undefined;
  try {
    localDraft = rules(normalized);
  } catch (error) {
    if (!(error instanceof DescriptionParseError)) {
      throw error;
    }
    localError = error;
    if (!error.aiFallbackAllowed) {
      throw error;
    }
  }

  const needsFallback = localDraft
    ? localDraft.confidence < 0.75
    : true;
  if (!needsFallback || !configuredForAi(options)) {
    if (localDraft) {
      return localDraft;
    }
    throw localError;
  }

  const primaryDraft = await primary(normalized, {
    ...options,
    model: options.model ?? getConfiguredModel(provider, options),
  });
  let finalDraft = primaryDraft;
  const candidates: Array<{
    model: string;
    confidence: number;
    draft: StrategyDraft;
  }> = [];
  if (primaryDraft) {
    candidates.push({
        model: getConfiguredModel(provider, options),
      confidence: primaryDraft.confidence,
      draft: primaryDraft,
    });
  }
  if (shouldRunConsensus(options)) {
    const env = options.env ?? process.env;
    const validatorModel = options.validatorModel ?? env.DOCTOR_NL_VALIDATOR_MODEL;
    const shouldRunValidator = Boolean(validatorModel)
      && options.enableConsensus !== false
      && validatorModel !== (env.DOCTOR_NL_MODEL ?? undefined);
    if (shouldRunValidator) {
      const validatorDraft = await validator(normalized, {
        ...options,
        model: validatorModel,
      });
      if (validatorDraft) {
        candidates.push({
          model: validatorModel ?? 'anthropic-validator',
          confidence: validatorDraft.confidence,
          draft: validatorDraft,
        });
      }
    }
  }
  const consensus = buildConsensus(candidates);
  if (consensus) {
    finalDraft = candidates[0].draft;
    if (!isConsistent(candidates) && consensus.score < 1) {
      finalDraft = {
        ...finalDraft,
        warnings: [
          ...finalDraft.warnings,
          consensusWarning(consensus.score),
        ],
      } as StrategyDraft;
    }
    return {
      ...finalDraft,
      consensus,
    };
  }
  if (finalDraft) {
    return finalDraft;
  }
  if (localDraft) {
    return {
      ...localDraft,
      warnings: [
        ...localDraft.warnings,
        fallbackWarning(),
      ],
    };
  }
  throw localError;
}

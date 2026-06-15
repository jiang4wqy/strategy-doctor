import { StrategyValidationError } from '../contracts.ts';
import type {
  DraftWarning,
  StrategyDraft,
} from '../platform/contracts.ts';
import {
  parseWithAnthropic,
  type AnthropicParserOptions,
} from './anthropic.ts';
import { DescriptionParseError } from './errors.ts';
import { parseWithRules } from './rules.ts';

export interface ParseDescriptionOptions extends AnthropicParserOptions {
  rules?: typeof parseWithRules;
  anthropic?: typeof parseWithAnthropic;
}

function configuredForAi(options: ParseDescriptionOptions): boolean {
  if (options.anthropic) {
    return true;
  }
  const env = options.env ?? process.env;
  return env.DOCTOR_NL_AI_ENABLED === '1'
    && Boolean(env.ANTHROPIC_API_KEY)
    && Boolean(env.DOCTOR_NL_MODEL);
}

function fallbackWarning(): DraftWarning {
  return {
    code: 'AI_FALLBACK_FAILED',
    message: 'AI parsing was unavailable; review the local draft carefully.',
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
  const anthropic = options.anthropic ?? parseWithAnthropic;
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

  const aiDraft = await anthropic(normalized, options);
  if (aiDraft) {
    return aiDraft;
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

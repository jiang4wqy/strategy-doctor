import { StrategyValidationError } from '../contracts.ts';
import type {
  DraftWarning,
  StrategyDraft,
} from '../platform/contracts.ts';
import {
  parseWithAnthropic,
  parseWithAnthropicModels,
  strategyFingerprint,
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

function normalizeModelOutputs(entries: Array<{ model: string; draft?: StrategyDraft }>) {
  const successful = entries.filter(entry => entry.draft !== undefined);
  const first = successful[0];
  if (!first || !first.draft) {
    return undefined;
  }

  const base = strategyFingerprint(first.draft.strategy);
  const agreed = successful
    .filter(entry => entry.draft && strategyFingerprint(entry.draft.strategy) === base)
    .map(entry => entry.model);

  return {
    primaryModel: first.model,
    requestedModels: successful.map(entry => entry.model),
    agreeingModels: agreed,
    agreementRate: successful.length > 0
      ? agreed.length / successful.length
      : 0,
    mismatches: successful
      .filter(entry => entry.draft && strategyFingerprint(entry.draft.strategy) !== base)
      .map(entry => entry.model),
  };
}

function attachConsensusMetadata(
  draft: StrategyDraft,
  consensus?: ReturnType<typeof normalizeModelOutputs>,
): StrategyDraft {
  if (!consensus) {
    return draft;
  }

  const enriched: StrategyDraft = { ...draft };
  enriched.consensus = consensus;
  if (consensus.agreementRate < 1 && consensus.requestedModels.length > 1) {
    enriched.warnings = [
      ...draft.warnings,
      {
        code: 'MULTI_MODEL_DISAGREEMENT',
        message:
          `Parsing consistency check did not fully agree (${consensus.agreementRate.toFixed(2)}).`,
      },
    ];
  }
  return enriched;
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

  const useSingleModelPath = typeof options.anthropic === 'function';
  const candidates = useSingleModelPath
    ? [{ model: options.env?.DOCTOR_NL_MODEL ?? 'anthropic', draft: await anthropic(normalized, options) }]
    : await parseWithAnthropicModels(normalized, options);
  const aiDraft = candidates
    .find(entry => entry.draft !== undefined)
    ?.draft;
  const consensus = candidates.length > 1
    ? normalizeModelOutputs(candidates)
    : undefined;
  if (aiDraft && consensus) {
    aiDraft.consensus = consensus;
  }

  if (aiDraft) {
    return attachConsensusMetadata(
      aiDraft,
      candidates.length > 0 ? consensus : undefined,
    );
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

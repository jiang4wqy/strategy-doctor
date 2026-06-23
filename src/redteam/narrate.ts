import type {
  DeathCause,
  Metrics,
  NarrationConsensus as SharedNarrationConsensus,
  Scenario,
} from '../contracts.ts';

export interface NarrationInput {
  scenario: Scenario;
  metrics: Metrics;
  cause: DeathCause;
}

export type Narrator = (
  input: NarrationInput,
) => Promise<string | NarrationResult>;

export interface NarrationResult {
  text: string;
  consensus?: NarrationConsensus;
}

interface NarrationConsensus extends SharedNarrationConsensus {}

interface NarratorOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  mode?: 'cascade' | 'parallel';
  timeoutMs?: number;
  onTrace?: (entry: string) => void;
}

function sanitizeNarrativeMetric(input: NarrationInput): string {
  return (
    `Scenario ${input.scenario.name} (${input.scenario.dimension}, severity ${input.scenario.severity}), `
    + `cause=${input.cause}, pnl=${(input.metrics.pnlPct * 100).toFixed(2)}%, `
    + `max_drawdown=${(input.metrics.maxDrawdownPct * 100).toFixed(2)}%, `
    + `liquidated=${input.metrics.liquidated}, trades=${input.metrics.numTrades}. `
    + `Source narrative: ${input.scenario.narrative}`
  );
}

function textFromResponse(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const content = (value as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  const block = content.find(candidate => (
    typeof candidate === 'object'
    && candidate !== null
    && (candidate as Record<string, unknown>).type === 'text'
    && typeof (candidate as Record<string, unknown>).text === 'string'
  )) as Record<string, unknown> | undefined;
  const text = block?.text;
  return typeof text === 'string' && text.trim() !== ''
    ? text.trim()
    : undefined;
}

function parseNarrationModels(options: NarratorOptions): string[] {
  const env = options.env ?? process.env;
  const primaryModel = env.DOCTOR_LLM_MODEL;
  const models = [
    ...(primaryModel ? [primaryModel] : []),
    ...(env.DOCTOR_LLM_SECONDARY_MODELS ?? '')
      .split(',')
      .map(model => model.trim())
      .filter(Boolean),
  ];
  return models.filter(
    (model, index, all) => all.indexOf(model) === index,
  );
}

function shouldCascade(options: NarratorOptions): boolean {
  const env = options.env ?? process.env;
  const mode = (options.mode ?? env.DOCTOR_LLM_ENSEMBLE_MODE ?? 'cascade')
    .toLowerCase();
  return mode !== 'parallel';
}

function similarity(a: string, b: string): number {
  const normalize = (value: string) => value.trim().toLowerCase();
  const left = new Set(normalize(a).split(/\s+/));
  const right = new Set(normalize(b).split(/\s+/));
  let overlap = 0;

  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  return union > 0 ? overlap / union : 0;
}

function buildNarrationConsensus(
  primaryModel: string,
  models: string[],
  outputs: Map<string, string>,
): NarrationConsensus {
  const primaryText = outputs.get(primaryModel);
  if (!primaryText) {
    const first = outputs.values().next().value;
    const firstModel = models.find(model => outputs.has(model)) ?? primaryModel;
    const fallbackSimilarity = typeof first === 'string'
      ? 1
      : 0;
    return {
      primaryModel: firstModel,
      requestedModels: [...outputs.keys()],
      agreeingModels: fallbackSimilarity === 1 ? [firstModel] : [],
      mismatches: fallbackSimilarity === 1 ? [] : [...outputs.keys()].filter(
        model => model !== firstModel,
      ),
      agreementRate: fallbackSimilarity,
      avgSimilarity: 1,
    };
  }

  const base = primaryText.trim().toLowerCase();
  const similarities = models
    .flatMap(model => {
      const text = outputs.get(model)?.trim();
      if (!text) {
        return [];
      }
      const similarityScore = similarity(base, text);
      return [{
        model,
        similarity: similarityScore,
      }];
    });

  const agreeing = similarities
    .filter(item => item.similarity >= 0.35)
    .map(item => item.model);
  const mismatches = similarities
    .filter(item => item.similarity < 0.35)
    .map(item => item.model);
  const avgSimilarity = similarities.reduce(
    (sum, item) => sum + item.similarity,
    0,
  ) / Math.max(1, similarities.length);

  return {
    primaryModel,
    requestedModels: similarities.map(item => item.model),
    agreeingModels: agreeing,
    mismatches,
    agreementRate: similarities.length > 0
      ? agreeing.length / similarities.length
      : 0,
    avgSimilarity,
  };
}

function fallbackNarrative(input: NarrationInput): string {
  return input.scenario.narrative;
}

export function createAnthropicNarrator(
  options: NarratorOptions = {},
): Narrator {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 3000;
  const models = parseNarrationModels(options);
  const enabled = env.DOCTOR_LLM_NARRATE === '1';
  const apiKey = env.ANTHROPIC_API_KEY;

  if (!enabled || !apiKey || models.length === 0) {
    return async input => ({ text: fallbackNarrative(input) });
  }

  const primaryModel = models[0];
  const cascade = shouldCascade(options);

  const callModel = async (
    model: string,
    input: NarrationInput,
  ): Promise<string | undefined> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 240,
            messages: [{
              role: 'user',
              content: sanitizeNarrativeMetric(input),
            }],
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        return undefined;
      }
      return textFromResponse(await response.json());
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  };

  return async (input) => {
    const outputs = new Map<string, string>();
    const requestedModels = [...models];

    if (cascade) {
      for (const model of requestedModels) {
        const text = await callModel(model, input);
        options.onTrace?.(`narration model call: ${model} completed`);
        if (text) {
          outputs.set(model, text);
        }
        if (model === primaryModel && !text) {
          options.onTrace?.(
            'narration fallback: primary model unavailable, using validators for signal',
          );
        }
      }
    } else {
      const records = await Promise.all(
        requestedModels.map(async model => ({ model, text: await callModel(model, input) })),
      );
      for (const record of records) {
        options.onTrace?.(`narration model call: ${record.model} completed`);
        if (record.text) {
          outputs.set(record.model, record.text);
        }
      }
    }

    if (outputs.size === 0) {
      options.onTrace?.('narration fallback: no valid model output');
      return { text: fallbackNarrative(input) };
    }

    const primaryText = outputs.get(primaryModel) ?? outputs.values().next().value;
    const primaryEntry = [...outputs.entries()].find(([model]) => model === primaryModel)
      ?? [...outputs.entries()][0];
    if (primaryEntry) {
      const result: NarrationResult = { text: primaryEntry[1] };
      result.consensus = buildNarrationConsensus(primaryModel, requestedModels, outputs);
      options.onTrace?.(
        `narration consensus: primary=${result.consensus.primaryModel}, ` +
        `agreement=${(result.consensus.agreementRate * 100).toFixed(2)}%, ` +
        `avgSimilarity=${result.consensus.avgSimilarity.toFixed(3)}`
      );
      if (result.consensus.agreementRate < 1) {
        options.onTrace?.(
          `narration consensus warning: ${result.consensus.mismatches.join(',')} mismatch`,
        );
      }
      return result;
    }

    if (primaryText) {
      return { text: primaryText };
    }
    return { text: fallbackNarrative(input) };
  };
}

export { fallbackNarrative };

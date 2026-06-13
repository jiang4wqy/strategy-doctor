import type {
  DeathCause,
  Metrics,
  Scenario,
} from '../contracts.ts';

export interface NarrationInput {
  scenario: Scenario;
  metrics: Metrics;
  cause: DeathCause;
}

export type Narrator = (input: NarrationInput) => Promise<string>;

interface NarratorOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export function fallbackNarrative(input: NarrationInput): string {
  return input.scenario.narrative;
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

export function createAnthropicNarrator(
  options: NarratorOptions = {},
): Narrator {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 3000;
  const enabled = env.DOCTOR_LLM_NARRATE === '1';
  const apiKey = env.ANTHROPIC_API_KEY;
  const model = env.DOCTOR_LLM_MODEL;

  return async (input) => {
    if (!enabled || !apiKey || !model) {
      return fallbackNarrative(input);
    }

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
              content: [
                '请用简洁中文解释以下策略压力测试结果。',
                '只描述风险机制、指标与场景，不给投资建议，不添加未提供的事实。',
                JSON.stringify({
                  scenario: {
                    name: input.scenario.name,
                    dimension: input.scenario.dimension,
                    severity: input.scenario.severity,
                    shock: input.scenario.shock,
                    sourceNarrative: input.scenario.narrative,
                  },
                  result: {
                    cause: input.cause,
                    pnlPct: input.metrics.pnlPct,
                    maxDrawdownPct: input.metrics.maxDrawdownPct,
                    liquidated: input.metrics.liquidated,
                    numTrades: input.metrics.numTrades,
                  },
                }),
              ].join('\n'),
            }],
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        return fallbackNarrative(input);
      }
      const text = textFromResponse(await response.json());
      return text ?? fallbackNarrative(input);
    } catch {
      return fallbackNarrative(input);
    } finally {
      clearTimeout(timeout);
    }
  };
}

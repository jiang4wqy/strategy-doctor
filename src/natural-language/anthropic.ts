import type { DraftAssumption, StrategyDraft } from '../platform/contracts.ts';
import { parseStrategy } from '../strategy/parse.ts';
import { strategyRegistry } from '../strategy/registry.ts';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export interface AnthropicParserOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function parseModelPayload(value: unknown): {
  strategy: unknown;
  explicitFields: string[];
} | undefined {
  const response = object(value);
  if (!response || !Array.isArray(response.content)) {
    return undefined;
  }
  const firstBlock = object(response.content[0]);
  if (
    !firstBlock
    || firstBlock.type !== 'text'
    || typeof firstBlock.text !== 'string'
  ) {
    return undefined;
  }
  const parsed = object(JSON.parse(firstBlock.text));
  if (
    !parsed
    || !Array.isArray(parsed.explicitFields)
    || !parsed.explicitFields.every(field => typeof field === 'string')
  ) {
    return undefined;
  }
  return {
    strategy: parsed.strategy,
    explicitFields: parsed.explicitFields as string[],
  };
}

function validateDefaults(
  strategy: ReturnType<typeof parseStrategy>,
  explicitFields: readonly string[],
): DraftAssumption[] | undefined {
  const definition = strategyRegistry.getDefinition(strategy.archetype);
  const params = strategy.params as unknown as Record<string, number>;
  const allowedFields = new Set([
    'strategy.id',
    'strategy.name',
    'strategy.universe.0',
    'strategy.timeframe',
    ...definition.parameters.map(
      parameter => `strategy.params.${parameter.key}`,
    ),
  ]);
  if (explicitFields.some(field => !allowedFields.has(field))) {
    return undefined;
  }

  const explicit = new Set(explicitFields);
  const assumptions: DraftAssumption[] = [];
  if (!explicit.has('strategy.universe.0')) {
    if (strategy.universe[0] !== 'BTCUSDT') {
      return undefined;
    }
    assumptions.push({
      field: 'strategy.universe.0',
      value: strategy.universe[0],
      reason: 'market-default',
    });
  }
  if (!explicit.has('strategy.timeframe')) {
    if (strategy.timeframe !== '4h') {
      return undefined;
    }
    assumptions.push({
      field: 'strategy.timeframe',
      value: strategy.timeframe,
      reason: 'market-default',
    });
  }
  for (const parameter of definition.parameters) {
    const field = `strategy.params.${parameter.key}`;
    if (explicit.has(field)) {
      continue;
    }
    if (!Object.is(params[parameter.key], parameter.defaultValue)) {
      return undefined;
    }
    assumptions.push({
      field,
      value: parameter.defaultValue,
      reason: 'registered-default',
    });
  }
  return assumptions;
}

export async function parseWithAnthropic(
  description: string,
  options: AnthropicParserOptions = {},
): Promise<StrategyDraft | undefined> {
  const env = options.env ?? process.env;
  const apiKey = env.ANTHROPIC_API_KEY;
  const model = env.DOCTOR_NL_MODEL;
  if (env.DOCTOR_NL_AI_ENABLED !== '1' || !apiKey || !model) {
    return undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 3000,
  );
  try {
    const response = await (options.fetch ?? globalThis.fetch)(
      ANTHROPIC_MESSAGES_URL,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          temperature: 0,
          system: [
            'Return JSON only with keys strategy and explicitFields.',
            'Do not generate source code or execution logic.',
            'Use exactly one of these capability definitions:',
            JSON.stringify(strategyRegistry.listDefinitions()),
          ].join('\n'),
          messages: [{
            role: 'user',
            content: description,
          }],
        }),
      },
    );
    if (!response.ok) {
      return undefined;
    }
    const payload = parseModelPayload(await response.json());
    if (!payload) {
      return undefined;
    }
    const strategy = parseStrategy(payload.strategy);
    const assumptions = validateDefaults(
      strategy,
      payload.explicitFields,
    );
    if (!assumptions) {
      return undefined;
    }
    return {
      strategy,
      source: 'anthropic',
      confidence: Math.min(
        0.95,
        0.75 + payload.explicitFields.length * 0.02,
      ),
      assumptions,
      warnings: [],
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

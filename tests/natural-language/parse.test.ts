import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { StrategyValidationError } from '../../src/contracts.ts';
import type { StrategyDraft } from '../../src/platform/contracts.ts';
import { DescriptionParseError } from '../../src/natural-language/errors.ts';
import {
  parseStrategyDescription,
} from '../../src/natural-language/parse.ts';

const aiDraft: StrategyDraft = {
  strategy: {
    id: 'ai-ma',
    name: 'AI MA',
    archetype: 'ma-cross',
    params: {
      fastMA: 8,
      slowMA: 30,
      leverage: 10,
      stopLossPct: 0.5,
      positionPct: 1,
    },
    universe: ['BTCUSDT'],
    timeframe: '4h',
  },
  source: 'anthropic',
  confidence: 0.85,
  assumptions: [],
  warnings: [],
};

test('parseStrategyDescription returns high-confidence local rules without AI', async () => {
  let aiCalls = 0;
  const result = await parseStrategyDescription(
    'BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30',
    {
      anthropic: async () => {
        aiCalls++;
        return aiDraft;
      },
    },
  );

  assert.equal(result.source, 'rules');
  assert.equal(aiCalls, 0);
});

test('parseStrategyDescription uses AI for an eligible unrecognized description', async () => {
  let aiCalls = 0;
  const result = await parseStrategyDescription(
    'A conservative strategy that buys market dips',
    {
      anthropic: async () => {
        aiCalls++;
        return aiDraft;
      },
    },
  );

  assert.equal(result, aiDraft);
  assert.equal(aiCalls, 1);
});

test('parseStrategyDescription can run ensemble parsing for multiple models', async () => {
  const calls: string[] = [];
  const result = await parseStrategyDescription(
    'A strategy that opens breakout positions with moving averages and trailing rules',
    {
      env: {
        DOCTOR_NL_AI_ENABLED: '1',
        ANTHROPIC_API_KEY: 'test-key',
        DOCTOR_NL_MODEL: 'model-primary',
        DOCTOR_NL_SECONDARY_MODELS: 'model-secondary,model-third',
      },
      fetch: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string };
        calls.push(body.model);
        return new Response(JSON.stringify({
          content: [{
            type: 'text',
            text: JSON.stringify({
              strategy: {
                id: 'ensemble-ma',
                name: 'Ensemble MA',
                archetype: 'ma-cross',
                params: {
                  fastMA: 12,
                  slowMA: 35,
                  leverage: 10,
                  stopLossPct: 0.05,
                  positionPct: 1,
                },
                universe: ['BTCUSDT'],
                timeframe: '4h',
              },
              explicitFields: [
                'strategy.universe.0',
                'strategy.timeframe',
                'strategy.params.fastMA',
                'strategy.params.slowMA',
                'strategy.params.leverage',
                'strategy.params.stopLossPct',
                'strategy.params.positionPct',
              ],
            }),
          }],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  );

  assert.equal(result.source, 'anthropic');
  assert.deepEqual(calls.sort(), ['model-primary', 'model-secondary', 'model-third']);
  assert.equal(result.consensus?.requestedModels.length, 3);
  assert.equal(result.consensus?.agreementRate, 1);
  assert.equal(result.warnings.length, 0);
});

test('parseStrategyDescription falls back to a secondary model when the primary output is invalid', async () => {
  const calls: string[] = [];
  const result = await parseStrategyDescription(
    'A conservative strategy that buys market dips',
    {
      env: {
        DOCTOR_NL_AI_ENABLED: '1',
        ANTHROPIC_API_KEY: 'test-key',
        DOCTOR_NL_MODEL: 'model-primary',
        DOCTOR_NL_SECONDARY_MODELS: 'model-secondary',
        DOCTOR_NL_ENSEMBLE_MODE: 'cascade',
      },
      fetch: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string };
        calls.push(body.model);
        if (body.model === 'model-primary') {
          return new Response('temporary failure', {
            status: 500,
          });
        }
        return new Response(JSON.stringify({
          content: [{
            type: 'text',
            text: JSON.stringify({
              strategy: {
                id: 'cascade-secondary',
                name: 'Cascade Secondary',
                archetype: 'ma-cross',
                params: {
                  fastMA: 12,
                  slowMA: 35,
                  leverage: 10,
                  stopLossPct: 0.05,
                  positionPct: 1,
                },
                universe: ['BTCUSDT'],
                timeframe: '4h',
              },
              explicitFields: [
                'strategy.universe.0',
                'strategy.timeframe',
                'strategy.params.fastMA',
                'strategy.params.slowMA',
                'strategy.params.leverage',
                'strategy.params.stopLossPct',
                'strategy.params.positionPct',
              ],
            }),
          }],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  );

  assert.equal(result.source, 'anthropic');
  assert.equal(result.strategy.id, 'cascade-secondary');
  assert.deepEqual(calls, ['model-primary', 'model-secondary']);
});

test('parseStrategyDescription records consensus mismatch warning when models disagree', async () => {
  const callByModel: Record<string, { fastMA: number; slowMA: number }> = {
    'model-primary': { fastMA: 9, slowMA: 28 },
    'model-secondary': { fastMA: 13, slowMA: 30 },
  };
  const result = await parseStrategyDescription(
    'A strategy that opens breakout positions with moving averages and trailing rules',
    {
      env: {
        DOCTOR_NL_AI_ENABLED: '1',
        ANTHROPIC_API_KEY: 'test-key',
        DOCTOR_NL_MODEL: 'model-primary',
        DOCTOR_NL_SECONDARY_MODELS: 'model-secondary',
      },
      fetch: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string };
        const params = callByModel[body.model];
        return new Response(JSON.stringify({
          content: [{
            type: 'text',
            text: JSON.stringify({
              strategy: {
                id: `ensemble-${body.model}`,
                name: 'Ensemble MA',
                archetype: 'ma-cross',
                params: {
                  fastMA: params.fastMA,
                  slowMA: params.slowMA,
                  leverage: 10,
                  stopLossPct: 0.05,
                  positionPct: 1,
                },
                universe: ['BTCUSDT'],
                timeframe: '4h',
              },
              explicitFields: [
                'strategy.universe.0',
                'strategy.timeframe',
                'strategy.params.fastMA',
                'strategy.params.slowMA',
                'strategy.params.leverage',
                'strategy.params.stopLossPct',
                'strategy.params.positionPct',
              ],
            }),
          }],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  );

  assert.equal(result.source, 'anthropic');
  assert.equal(result.consensus?.requestedModels.length, 2);
  assert.equal(result.consensus?.agreementRate, 0.5);
  assert.deepEqual(result.warnings.map(warning => warning.code), [
    'MULTI_MODEL_DISAGREEMENT',
  ]);
});

test('parseStrategyDescription never sends forbidden execution requests to AI', async () => {
  let aiCalls = 0;
  await assert.rejects(
    parseStrategyDescription('execute a custom martingale trading bot', {
      anthropic: async () => {
        aiCalls++;
        return aiDraft;
      },
    }),
    (error: unknown) => (
      error instanceof DescriptionParseError
      && error.code === 'UNSUPPORTED_STRATEGY_DESCRIPTION'
      && error.aiFallbackAllowed === false
    ),
  );
  assert.equal(aiCalls, 0);
});

test('failed AI fallback preserves a low-confidence local draft with warning', async () => {
  let aiCalls = 0;
  const result = await parseStrategyDescription(
    'BTC moving average strategy',
    {
      anthropic: async () => {
        aiCalls++;
        return undefined;
      },
    },
  );

  assert.equal(aiCalls, 1);
  assert.equal(result.source, 'rules');
  assert.deepEqual(result.warnings.map(warning => warning.code), [
    'LOW_CONFIDENCE',
    'AI_FALLBACK_FAILED',
  ]);
});

test('description length is validated before either parser runs', async () => {
  let rulesCalls = 0;
  let aiCalls = 0;
  await assert.rejects(
    parseStrategyDescription('x'.repeat(2001), {
      rules: () => {
        rulesCalls++;
        throw new Error('must not call');
      },
      anthropic: async () => {
        aiCalls++;
        return aiDraft;
      },
    }),
    (error: unknown) => (
      error instanceof StrategyValidationError
      && error.code === 'INVALID_REQUEST'
      && error.field === 'description'
    ),
  );
  assert.equal(rulesCalls, 0);
  assert.equal(aiCalls, 0);
});

test('natural-language parsing has no diagnosis dependency', async () => {
  const source = await readFile(
    new URL('../../src/natural-language/parse.ts', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /diagnoseStrategy|application\/diagnose/);
});

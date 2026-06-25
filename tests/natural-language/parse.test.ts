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

const qwenDraft: StrategyDraft = {
  strategy: {
    id: 'ai-ma-qwen',
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
  source: 'qwen',
  confidence: 0.88,
  assumptions: [],
  warnings: [],
};

const deepSeekDraft: StrategyDraft = {
  strategy: {
    id: 'ai-ma-deepseek',
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
  source: 'deepseek',
  confidence: 0.9,
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

test('parseStrategyDescription can use Qwen as primary model', async () => {
  let qwenCalls = 0;
  const result = await parseStrategyDescription(
    'A conservative strategy that buys market dips',
    {
      provider: 'qwen',
      env: {
        DOCTOR_NL_AI_ENABLED: '1',
        DOCTOR_NL_QWEN_ENABLED: '1',
        QWEN_API_KEY: 'test-key',
        DOCTOR_QWEN_MODEL: 'qwen-test',
      },
      qwen: async () => {
        qwenCalls++;
        return qwenDraft;
      },
    },
  );

  assert.equal(result, qwenDraft);
  assert.equal(qwenCalls, 1);
});

test('parseStrategyDescription can use DeepSeek as primary model', async () => {
  let deepSeekCalls = 0;
  const result = await parseStrategyDescription(
    'A conservative strategy that buys market dips',
    {
      provider: 'deepseek',
      env: {
        DOCTOR_NL_AI_ENABLED: '1',
        DOCTOR_NL_DEEPSEEK_ENABLED: '1',
        DEEPSEEK_API_KEY: 'test-key',
        DOCTOR_DEEPSEEK_MODEL: 'deepseek-test',
      },
      deepseek: async () => {
        deepSeekCalls++;
        return deepSeekDraft;
      },
    },
  );

  assert.equal(result, deepSeekDraft);
  assert.equal(deepSeekCalls, 1);
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

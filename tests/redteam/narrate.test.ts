import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Metrics, Scenario } from '../../src/contracts.ts';
import {
  createAnthropicNarrator,
  fallbackNarrative,
} from '../../src/redteam/narrate.ts';

const scenario: Scenario = {
  id: 'news-42-c0',
  name: 'News gap',
  dimension: 'news',
  sourceSkill: 'news-briefing',
  sourceObservedAt: '2026-06-12T15:17:31Z',
  narrative: 'Market narrative from mocked ingestion stream.',
  severity: 4,
  shock: {
    kind: 'gap',
    magnitude: 0.2,
    durationBars: 2,
    volMult: 2,
    seed: 42,
  },
};

const metrics: Metrics = {
  pnlPct: -0.4,
  maxDrawdownPct: 0.5,
  liquidated: false,
  numTrades: 3,
  equityCurve: [1, 0.6],
};

const input = {
  scenario,
  metrics,
  cause: 'drawdown-breach' as const,
};

function extractText(
  value: string | { text: string; consensus?: unknown },
): string {
  return typeof value === 'string' ? value : value.text;
}

test('narrator stays offline and deterministic when enhancement is disabled', async () => {
  let called = false;
  const narrator = createAnthropicNarrator({
    env: {},
    fetch: async () => {
      called = true;
      return new Response();
    },
  });

  const text = extractText(await narrator(input));
  assert.equal(text, fallbackNarrative(input));
  assert.equal(called, false);
});

test('narrator returns the first Anthropic text block', async () => {
  let request: RequestInit | undefined;
  const narrator = createAnthropicNarrator({
    env: {
      DOCTOR_LLM_NARRATE: '1',
      ANTHROPIC_API_KEY: 'test-key',
      DOCTOR_LLM_MODEL: 'test-model',
    },
    fetch: async (_url, init) => {
      request = init;
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: 'LLM generated narrative from primary model.',
        }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const text = extractText(await narrator(input));
  assert.equal(text, 'LLM generated narrative from primary model.');
  assert.equal(request?.method, 'POST');
  assert.equal(
    (request?.headers as Record<string, string>)['anthropic-version'],
    '2023-06-01',
  );
  const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
  assert.equal(body.model, 'test-model');
  assert.equal(body.max_tokens, 240);
});

test('narrator falls back on HTTP and malformed response failures', async () => {
  const env = {
    DOCTOR_LLM_NARRATE: '1',
    ANTHROPIC_API_KEY: 'test-key',
    DOCTOR_LLM_MODEL: 'test-model',
  };
  for (const response of [
    new Response('unavailable', { status: 503 }),
    new Response(JSON.stringify({ content: [] }), { status: 200 }),
    new Response('{not-json', { status: 200 }),
  ]) {
    const narrator = createAnthropicNarrator({
      env,
      fetch: async () => response,
    });
    const text = extractText(await narrator(input));
    assert.equal(text, fallbackNarrative(input));
  }
});

test('narrator aborts at the configured timeout and falls back', async () => {
  const narrator = createAnthropicNarrator({
    env: {
      DOCTOR_LLM_NARRATE: '1',
      ANTHROPIC_API_KEY: 'test-key',
      DOCTOR_LLM_MODEL: 'test-model',
    },
    timeoutMs: 5,
    fetch: async (_url, init) => await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new Error('aborted'));
      });
    }),
  });

  const text = extractText(await narrator(input));
  assert.equal(text, fallbackNarrative(input));
});

test('narrator uses secondary model and emits consensus trace when configured', async () => {
  const calls: string[] = [];
  const traces: string[] = [];
  const narrator = createAnthropicNarrator({
    env: {
      DOCTOR_LLM_NARRATE: '1',
      ANTHROPIC_API_KEY: 'test-key',
      DOCTOR_LLM_MODEL: 'primary-llm',
      DOCTOR_LLM_SECONDARY_MODELS: 'secondary-llm',
    },
    fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { model: string };
      calls.push(body.model);
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: body.model === 'primary-llm'
            ? 'Primary explanation from first model.'
            : 'Primary explanation from first model.',
        }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    onTrace: entry => traces.push(entry),
  });

  const result = await narrator(input);
  const text = extractText(result);

  assert.equal(text, 'Primary explanation from first model.');
  assert.deepEqual(calls, ['primary-llm', 'secondary-llm']);
  assert.ok(traces.some(item => item.includes('narration consensus')));
  if (typeof result !== 'string') {
    assert.equal(result.consensus?.agreementRate, 1);
  }
});

test('narrator supports cascade mode with disagreement penalty trace', async () => {
  const traces: string[] = [];
  const narrator = createAnthropicNarrator({
    env: {
      DOCTOR_LLM_NARRATE: '1',
      ANTHROPIC_API_KEY: 'test-key',
      DOCTOR_LLM_MODEL: 'primary-llm',
      DOCTOR_LLM_SECONDARY_MODELS: 'secondary-llm',
      DOCTOR_LLM_ENSEMBLE_MODE: 'cascade',
    },
    fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { model: string };
      return new Response(JSON.stringify({
        content: [{
          type: 'text',
          text: body.model === 'primary-llm'
            ? 'Narrative about first path.'
            : 'Different narrative with mismatched wording.',
        }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    onTrace: entry => traces.push(entry),
  });

  const result = await narrator(input);
  const text = extractText(result);

  assert.equal(text, 'Narrative about first path.');
  assert.ok(traces.some(item => item.includes('narration consensus warning')));
  if (typeof result !== 'string') {
    assert.ok(result.consensus);
    assert.ok(result.consensus?.agreementRate < 1);
  }
});

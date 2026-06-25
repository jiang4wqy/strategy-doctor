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
  narrative: 'Frozen news indicates a sudden gap risk.',
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

test('narrator stays offline and deterministic when enhancement is disabled', async () => {
  let called = false;
  const narrator = createAnthropicNarrator({
    env: {},
    fetch: async () => {
      called = true;
      return new Response();
    },
  });

  assert.equal(await narrator(input), fallbackNarrative(input));
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
        content: [{ type: 'text', text: 'LLM generated risk narrative in English.' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(await narrator(input), 'LLM generated risk narrative in English.');
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
    assert.equal(await narrator(input), fallbackNarrative(input));
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

  assert.equal(await narrator(input), fallbackNarrative(input));
});
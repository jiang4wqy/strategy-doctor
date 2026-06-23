import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewWithOpenSourceModel,
  ruleBasedStrategyReview,
} from '../../src/review/model-review.ts';
import type {
  DiagnoseRequest,
  DiagnosisView,
} from '../../src/platform/contracts.ts';

const request = {
  strategy: {
    id: 'review-ma',
    name: 'Review MA',
    archetype: 'ma-cross',
    params: {
      fastMA: 8,
      slowMA: 30,
      leverage: 10,
      stopLossPct: 0.5,
      positionPct: 1,
    },
    universe: ['BTCUSDT'],
    timeframe: '1h',
  },
  style: 'conservative',
  seed: 42,
  candidates: 6,
} satisfies DiagnoseRequest;

const view = {
  scorecard: {
    deaths: [{
      dimension: 'technical',
      cause: 'liquidation',
    }],
    prescription: { changes: { leverage: 5 } },
  },
  summary: {
    riskScore: 10,
    worstDrawdownPct: 0.8,
    totalTrades: 12,
    totalTurnoverPct: 4,
    feeCostPct: 0.004,
    slippageCostPct: 0.003,
    robustnessGain: 2,
    returnDelta: -0.02,
  },
} as unknown as DiagnosisView;

test('ruleBasedStrategyReview flags risky deployment conditions', () => {
  const review = ruleBasedStrategyReview({ request, view });

  assert.equal(review.mode, 'rules');
  assert.ok(review.score < 100);
  assert.ok(review.objections.some(item => item.includes('drawdown')));
  assert.ok(review.recommendations.length > 0);
});

test('reviewWithOpenSourceModel calls an OpenAI-compatible reviewer', async () => {
  const calls: unknown[] = [];
  const review = await reviewWithOpenSourceModel({
    request,
    view,
  }, {
    env: {
      DOCTOR_REVIEW_ENABLED: '1',
      DASHSCOPE_API_KEY: 'test-key',
      DOCTOR_REVIEW_MODEL: 'qwen-plus',
      DOCTOR_REVIEW_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
    fetch: async (_url, init) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 72,
              agreementRate: 0.8,
              objections: ['Leverage remains high.'],
              recommendations: ['Reduce position size before publication.'],
              summary: 'Model reviewer accepts the repair with warnings.',
            }),
          },
        }],
      }));
    },
  });

  assert.equal(review.mode, 'open-source-model');
  assert.equal(review.reviewer, 'qwen-plus');
  assert.equal(review.score, 72);
  assert.equal(calls.length, 1);
});

test('reviewWithOpenSourceModel falls back when remote review is unavailable', async () => {
  const review = await reviewWithOpenSourceModel({
    request,
    view,
  }, {
    env: {
      DOCTOR_REVIEW_ENABLED: '1',
      DASHSCOPE_API_KEY: 'test-key',
      DOCTOR_REVIEW_MODEL: 'qwen-plus',
    },
    fetch: async () => new Response('bad gateway', { status: 502 }),
  });

  assert.equal(review.mode, 'rules');
});

// tests/mcp/tools.test.ts — MCP 工具单元测试
//
// 使用 fake client 验证每个工具的 schema 校验、委派和错误处理。
// 不连接真实服务器。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  listCapabilitiesTool,
  parseStrategyTool,
  diagnoseStrategyTool,
} from '../../src/mcp/tools.ts';
import type { StrategyDoctorClient } from '../../src/client/index.ts';
import type {
  AnyStrategyDefinition,
  DiagnosisView,
  StrategyDraft,
} from '../../src/platform/contracts.ts';

// ── Fake client ─────────────────────────────────────

function createFakeClient(): StrategyDoctorClient {
  return Object.freeze({
    async capabilities() {
      return [
        { archetype: 'ma-cross', label: 'MA Cross', description: '均线交叉' },
      ] as unknown as readonly AnyStrategyDefinition[];
    },
    async parseStrategy(input: { description: string }) {
      return {
        strategy: {
          id: 'parsed-001',
          name: input.description.slice(0, 20),
          archetype: 'ma-cross',
          params: { fastMA: 8, slowMA: 30, leverage: 10, stopLossPct: 0.5, positionPct: 1 },
          universe: ['BTCUSDT'],
          timeframe: '1h',
        },
        source: 'rules',
        confidence: 0.85,
        assumptions: [],
        warnings: [],
      } satisfies StrategyDraft;
    },
    async diagnose() {
      return {
        scorecard: {} as DiagnosisView['scorecard'],
        summary: { riskScore: 50, worstDrawdownPct: 0.3, totalTrades: 10, robustnessGain: 5, returnDelta: 0.1 },
        charts: {
          treatmentEquity: [],
          heldOutComparison: [],
          defaultHeldOutDimension: 'technical',
          riskRadar: [],
          parameterChanges: [],
          scenarioTimeline: [],
        },
      } satisfies DiagnosisView;
    },
  });
}

// ── list_strategy_capabilities ─────────────────────

test('listCapabilitiesTool name and description are set', () => {
  assert.equal(listCapabilitiesTool.name, 'list_strategy_capabilities');
  assert.ok(listCapabilitiesTool.description.length > 0);
});

test('listCapabilitiesTool calls client.capabilities', async () => {
  const client = createFakeClient();
  const result = await listCapabilitiesTool.handler(client, {});
  assert.ok(Array.isArray(result));
  assert.equal(result[0].archetype, 'ma-cross');
});

// ── parse_strategy_description ──────────────────────

test('parseStrategyTool name and description are set', () => {
  assert.equal(parseStrategyTool.name, 'parse_strategy_description');
  assert.ok(parseStrategyTool.description.length > 0);
});

test('parseStrategyTool calls client.parseStrategy', async () => {
  const client = createFakeClient();
  const result = await parseStrategyTool.handler(client, {
    description: 'BTC 1h MA cross',
  });
  assert.equal(result.source, 'rules');
  assert.equal(result.strategy.archetype, 'ma-cross');
});

test('parseStrategyTool rejects empty description', () => {
  const result = parseStrategyTool.inputSchema.safeParse({
    description: '',
  });
  assert.equal(result.success, false);
});

test('parseStrategyTool rejects too long description', () => {
  const result = parseStrategyTool.inputSchema.safeParse({
    description: 'x'.repeat(2001),
  });
  assert.equal(result.success, false);
});

test('parseStrategyTool accepts valid description', () => {
  const result = parseStrategyTool.inputSchema.safeParse({
    description: 'BTC 1h RSI mean reversion',
  });
  assert.equal(result.success, true);
});

// ── diagnose_strategy ───────────────────────────────

test('diagnoseStrategyTool name and description are set', () => {
  assert.equal(diagnoseStrategyTool.name, 'diagnose_strategy');
  assert.ok(diagnoseStrategyTool.description.length > 0);
});

test('diagnoseStrategyTool calls client.diagnose', async () => {
  const client = createFakeClient();
  const result = await diagnoseStrategyTool.handler(client, {
    strategy: JSON.stringify({
      id: 'test',
      name: 'test',
      archetype: 'ma-cross',
      params: { fastMA: 8, slowMA: 30, leverage: 10, stopLossPct: 0.5, positionPct: 1 },
      universe: ['BTCUSDT'],
      timeframe: '1h',
    }),
    style: 'conservative',
    seed: 42,
    candidates: 6,
  });
  assert.ok(typeof result.summary.riskScore === 'number');
});

test('diagnoseStrategyTool rejects invalid strategy JSON', async () => {
  const client = createFakeClient();
  await assert.rejects(
    () => diagnoseStrategyTool.handler(client, {
      strategy: 'not-json',
      style: 'conservative',
    }),
    /invalid strategy JSON/,
  );
});

test('diagnoseStrategyTool rejects invalid style', () => {
  const result = diagnoseStrategyTool.inputSchema.safeParse({
    strategy: '{}',
    style: 'unknown',
  });
  assert.equal(result.success, false);
});

test('diagnoseStrategyTool rejects candidates out of range', () => {
  const result = diagnoseStrategyTool.inputSchema.safeParse({
    strategy: '{}',
    style: 'conservative',
    candidates: 0,
  });
  assert.equal(result.success, false);
});

test('diagnoseStrategyTool applies defaults for seed and candidates', () => {
  const result = diagnoseStrategyTool.inputSchema.safeParse({
    strategy: '{}',
    style: 'aggressive',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.seed, 42);
    assert.equal(result.data.candidates, 6);
  }
});

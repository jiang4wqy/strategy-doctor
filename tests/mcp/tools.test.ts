// tests/mcp/tools.test.ts — MCP 工具单元测试
//
// 使用 fake client 验证每个工具的 schema 校验、委派和错误处理。
// 不连接真实服务器。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_TOOLS,
  listCapabilitiesTool,
  parseStrategyTool,
  diagnoseStrategyTool,
  diagnosePlaybookTool,
} from '../../src/mcp/tools.ts';
import type { StrategyDoctorClient } from '../../src/client/index.ts';
import type {
  AnyStrategyDefinition,
  DiagnosisView,
  FactorLibraryView,
  MultiFactorFrameworkView,
  NotebookCatalogView,
  PaperSignalView,
  PlaybookDiagnosisView,
  PaperSandboxCreateResponse,
  PaperSandboxListView,
  PaperSandboxSessionView,
  PaperSandboxStatus,
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
        summary: { riskScore: 50, worstDrawdownPct: 0.3, totalTrades: 10, totalTurnoverPct: 2.4, feeCostPct: 0.002, slippageCostPct: 0.001, robustnessGain: 5, returnDelta: 0.1 },
        charts: {
          treatmentEquity: [],
          treatmentDrawdown: [],
          heldOutComparison: [],
          defaultHeldOutDimension: 'technical',
          riskRadar: [],
          parameterChanges: [],
          scenarioTimeline: [],
          executionQuality: [],
        },
      } satisfies DiagnosisView;
    },
    async diagnosePlaybook() {
      return {
        import: {
          source: 'description',
          playbookId: 'agent-101',
          description: 'BTC trend strategy',
          strategy: {
            id: 'parsed-001',
            name: 'BTC trend strategy',
            archetype: 'ma-cross',
            params: { fastMA: 8, slowMA: 30, leverage: 10, stopLossPct: 0.5, positionPct: 1 },
            universe: ['BTCUSDT'],
            timeframe: '1h',
          },
        },
        view: {
          scorecard: {} as DiagnosisView['scorecard'],
          summary: { riskScore: 50, worstDrawdownPct: 0.3, totalTrades: 10, totalTurnoverPct: 2.4, feeCostPct: 0.002, slippageCostPct: 0.001, robustnessGain: 5, returnDelta: 0.1 },
          charts: {
            treatmentEquity: [],
            treatmentDrawdown: [],
            heldOutComparison: [],
            defaultHeldOutDimension: 'technical',
            riskRadar: [],
            parameterChanges: [],
            scenarioTimeline: [],
            executionQuality: [],
          },
        },
      } satisfies PlaybookDiagnosisView;
    },
    async apiCallMonitor() {
      return {
        windowStart: '2026-06-23T00:00:00.000Z',
        windowEnd: '2026-06-23T01:00:00.000Z',
        totalCalls: 0,
        totalErrors: 0,
        successRate: 100,
        topPaths: [],
        recent: [],
      };
    },
    async createPaperSandbox() {
      return {
        session: {
          id: 'sandbox-000',
          strategyId: 'parsed-001',
          strategyName: 'parsed-001',
          symbol: 'BTCUSDT',
          timeframe: '1h',
          status: 'active',
          createdAt: '2026-06-23T00:00:00.000Z',
          updatedAt: '2026-06-23T00:00:00.000Z',
          currentIndex: 0,
          totalBars: 240,
          signal: 'hold',
          position: 'flat',
          equity: 1,
          totalTrades: 0,
          turnoverPct: 0,
          feeCostPct: 0,
          slippageCostPct: 0,
          latestNotes: [],
          history: [],
        },
      } satisfies PaperSandboxCreateResponse;
    },
    async listPaperSandboxes() {
      return {
        sessions: [
          {
            id: 'sandbox-000',
            strategyId: 'parsed-001',
            strategyName: 'parsed-001',
            symbol: 'BTCUSDT',
            timeframe: '1h',
            status: 'active',
            currentIndex: 0,
            totalBars: 240,
            lastUpdatedAt: '2026-06-23T00:00:00.000Z',
            createdAt: '2026-06-23T00:00:00.000Z',
          },
        ],
      } satisfies PaperSandboxListView;
    },
    async getPaperSandbox() {
      return {
        id: 'sandbox-000',
        strategyId: 'parsed-001',
        strategyName: 'parsed-001',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        status: 'active',
        createdAt: '2026-06-23T00:00:00.000Z',
        updatedAt: '2026-06-23T00:00:00.000Z',
        currentIndex: 0,
        totalBars: 240,
        signal: 'hold',
        position: 'flat',
        equity: 1,
        totalTrades: 0,
        turnoverPct: 0,
        feeCostPct: 0,
        slippageCostPct: 0,
        latestNotes: ['mock paper sandbox session'],
        history: [],
      } satisfies PaperSandboxSessionView;
    },
    async stepPaperSandbox() {
      return {
        id: 'sandbox-000',
        strategyId: 'parsed-001',
        strategyName: 'parsed-001',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        status: 'active',
        createdAt: '2026-06-23T00:00:00.000Z',
        updatedAt: '2026-06-23T00:00:00.000Z',
        currentIndex: 1,
        totalBars: 240,
        signal: 'hold',
        position: 'flat',
        equity: 1,
        totalTrades: 0,
        turnoverPct: 0,
        feeCostPct: 0,
        slippageCostPct: 0,
        latestNotes: ['mock paper sandbox session'],
        history: [],
      } satisfies PaperSandboxSessionView;
    },
    async closePaperSandbox() {
      return {
        id: 'sandbox-000',
        status: 'removed',
      } satisfies PaperSandboxStatus;
    },
    async onChainDashboard() {
      return {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        asOf: '2026-06-23T00:00:00.000Z',
        metrics: {
          flowPressure: {
            symbol: 'BTCUSDT',
            timeframe: '1h',
            asOf: '2026-06-23T00:00:00.000Z',
            onChainFlowUsd: 12_000_000,
            spotVolumeUsd: 30_000_000,
            perpsOpenInterestUsd: 120_000_000,
            fundingRate: 0.001,
            liquidationsUsd: 1_200_000,
          },
          liquidityPressure: {
            bidAskSpreadBps: 10,
            whaleOrderDepthUsd: 5_000_000,
            borrowRate: 0.01,
          },
          riskSignals: {
            squeezeRisk: 42,
            liquidationRisk: 12,
            momentumSkew: 60,
          },
        },
      };
    },
    async factors() {
      return {
        factors: [],
        frameworkVersion: 'factor-library-v1',
      } satisfies FactorLibraryView;
    },
    async notebooks() {
      return {
        templates: [],
      } satisfies NotebookCatalogView;
    },
    async multiFactorFramework() {
      return {
        version: 'multi-factor-framework-v1',
        stages: [],
        factorGroups: [],
        outputs: [],
        safeguards: [],
      } satisfies MultiFactorFrameworkView;
    },
    async paperSignal() {
      return {
        strategyId: 'parsed-001',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        latestSignal: 'hold',
        simulatedPosition: 'flat',
        paperEquity: 1,
        totalTrades: 0,
        turnoverPct: 0,
        feeCostPct: 0,
        slippageCostPct: 0,
        lastUpdatedAt: '2026-06-23T00:00:00.000Z',
        notes: [],
      } satisfies PaperSignalView;
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

test('ALL_TOOLS invokes heterogeneous tools through one registry entry', async () => {
  const client = createFakeClient();
  const tool = ALL_TOOLS.find(
    candidate => candidate.name === 'parse_strategy_description',
  );

  assert.ok(tool);
  const result = await tool.invoke(client, {
    description: 'BTC 1h MA cross',
  });

  assert.equal((result as StrategyDraft).strategy.archetype, 'ma-cross');
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
      seed: 42,
      candidates: 6,
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

test('diagnosePlaybookTool calls client.diagnosePlaybook for prompts', async () => {
  const client = createFakeClient();
  const result = await diagnosePlaybookTool.handler(client, {
    playbook: 'BTC trend strategy with defensive stops',
    style: 'trend',
    seed: 42,
    candidates: 6,
  });

  assert.equal(result.import.source, 'description');
  assert.equal(result.import.strategy.archetype, 'ma-cross');
});

test('diagnosePlaybookTool rejects malformed JSON exports', async () => {
  const client = createFakeClient();
  await assert.rejects(
    () => diagnosePlaybookTool.handler(client, {
      playbook: '{bad-json',
      style: 'conservative',
      seed: 42,
      candidates: 6,
    }),
    /invalid Playbook JSON/,
  );
});

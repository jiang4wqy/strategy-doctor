import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Strategy, Scenario, Metrics, Scorecard } from '../src/contracts.ts';

test('契约：四大核心类型可构造且字段齐全', () => {
  const strategy: Strategy = {
    id: 's1', name: '测试策略', archetype: 'ma-cross',
    params: { fastMA: 8, slowMA: 30, leverage: 10, stopLossPct: 0.5, positionPct: 1 },
    universe: ['BTCUSDT'], timeframe: '1h',
  };
  const scenario: Scenario = {
    id: 'sc1', name: '多头挤压', dimension: 'sentiment', sourceSkill: 'sentiment-analyst',
    narrative: '资金费率极值后瀑布', severity: 3,
    shock: { kind: 'squeeze', magnitude: 0.3, durationBars: 20, volMult: 2, seed: 1 },
  };
  const metrics: Metrics = { pnlPct: -0.4, maxDrawdownPct: 0.6, liquidated: true, numTrades: 3, equityCurve: [1, 0.6] };
  const card: Scorecard = {
    strategyId: strategy.id, scenarioSetId: 'tx42/ho100042',
    perStyle: {
      conservative: { style: 'conservative', riskScore: 20, survived: false, worstDrawdownPct: 0.6, meanPnlPct: -0.4 },
      aggressive: { style: 'aggressive', riskScore: 55, survived: true, worstDrawdownPct: 0.6, meanPnlPct: -0.4 },
      trend: { style: 'trend', riskScore: 40, survived: false, worstDrawdownPct: 0.6, meanPnlPct: -0.4 },
    },
    deaths: [{ scenarioId: scenario.id, scenarioName: scenario.name, dimension: 'sentiment', cause: 'liquidation', metrics, narrative: scenario.narrative }],
  };
  assert.equal(card.deaths[0].cause, 'liquidation');
  assert.equal(scenario.shock.kind, 'squeeze');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StrategyValidationError } from '../src/contracts.ts';
import type {
  AtrTrendBreakoutStrategy,
  BreakoutConfirmationStrategy,
  MaCrossStrategy,
  Metrics,
  RsiBollingerStrategy,
  Scenario,
  Scorecard,
  Strategy,
  StrategyArchetype,
  StrategyByArchetype,
} from '../src/contracts.ts';

function signalPeriod(
  strategy: StrategyByArchetype<StrategyArchetype>,
): number {
  switch (strategy.archetype) {
    case 'ma-cross':
      return strategy.params.fastMA;
    case 'rsi-bollinger-mean-reversion':
      return strategy.params.rsiPeriod;
    case 'breakout-confirmation':
      return strategy.params.breakoutLookback;
    case 'atr-trend-breakout':
      return strategy.params.atrPeriod;
  }
}

test('契约：四大核心类型可构造且字段齐全', () => {
  const movingAverage: MaCrossStrategy = {
    id: 's1', name: '测试策略', archetype: 'ma-cross',
    params: { fastMA: 8, slowMA: 30, leverage: 10, stopLossPct: 0.5, positionPct: 1 },
    universe: ['BTCUSDT'], timeframe: '1h',
  };
  const meanReversion: RsiBollingerStrategy = {
    id: 's2',
    name: '均值回归',
    archetype: 'rsi-bollinger-mean-reversion',
    params: {
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      bollingerPeriod: 20,
      bollingerStdDev: 2,
      trendFilterPeriod: 50,
      trendFilterThreshold: 0.03,
      leverage: 3,
      stopLossPct: 0.08,
      positionPct: 0.5,
    },
    universe: ['BTCUSDT'],
    timeframe: '1h',
  };
  const breakout: BreakoutConfirmationStrategy = {
    id: 's3',
    name: '纭绐佺牬',
    archetype: 'breakout-confirmation',
    params: {
      breakoutLookback: 24,
      confirmationBars: 2,
      exitLookback: 8,
      volatilityLookback: 12,
      minBreakoutPct: 0.012,
      minVolatilityPct: 0.002,
      leverage: 4,
      stopLossPct: 0.08,
      positionPct: 0.55,
    },
    universe: ['BTCUSDT'],
    timeframe: '1h',
  };
  const atrBreakout: AtrTrendBreakoutStrategy = {
    id: 's4',
    name: 'ATR trend breakout',
    archetype: 'atr-trend-breakout',
    params: {
      atrPeriod: 14,
      breakoutLookback: 20,
      atrStopMultiple: 2.5,
      trendMaPeriod: 50,
      leverage: 5,
      stopLossPct: 0.12,
      positionPct: 0.6,
    },
    universe: ['BTCUSDT'],
    timeframe: '4h',
  };
  const strategies: Strategy[] = [
    movingAverage,
    meanReversion,
    breakout,
    atrBreakout,
  ];
  const scenario: Scenario = {
    id: 'sc1', name: '多头挤压', dimension: 'sentiment', sourceSkill: 'sentiment-analyst',
    narrative: '资金费率极值后瀑布', severity: 3,
    shock: { kind: 'squeeze', magnitude: 0.3, durationBars: 20, volMult: 2, seed: 1 },
  };
  const metrics: Metrics = { pnlPct: -0.4, maxDrawdownPct: 0.6, liquidated: true, numTrades: 3, equityCurve: [1, 0.6] };
  const card: Scorecard = {
    strategyId: movingAverage.id, scenarioSetId: 'tx42/ho100042',
    perStyle: {
      conservative: { style: 'conservative', riskScore: 20, survived: false, worstDrawdownPct: 0.6, meanPnlPct: -0.4 },
      aggressive: { style: 'aggressive', riskScore: 55, survived: true, worstDrawdownPct: 0.6, meanPnlPct: -0.4 },
      trend: { style: 'trend', riskScore: 40, survived: false, worstDrawdownPct: 0.6, meanPnlPct: -0.4 },
    },
    evaluations: [{
      scenarioId: scenario.id, scenarioName: scenario.name, dimension: scenario.dimension,
      sourceSkill: scenario.sourceSkill, severity: scenario.severity, shock: scenario.shock,
      metrics, cause: 'liquidation', damageScore: 1060, narrative: scenario.narrative,
    }],
    deaths: [{ scenarioId: scenario.id, scenarioName: scenario.name, dimension: 'sentiment', cause: 'liquidation', metrics, narrative: scenario.narrative }],
    prescription: { changes: {}, rationale: '', patchedStrategy: movingAverage },
    tradeoff: { robustnessGain: 0, returnCost: 0 },
  };
  assert.equal(card.deaths[0].cause, 'liquidation');
  assert.equal(scenario.shock.kind, 'squeeze');
  assert.deepEqual(
    strategies.map(strategy => strategy.archetype),
    [
      'ma-cross',
      'rsi-bollinger-mean-reversion',
      'breakout-confirmation',
      'atr-trend-breakout',
    ],
  );
  assert.equal(signalPeriod(movingAverage), 8);
  assert.equal(signalPeriod(meanReversion), 14);
  assert.equal(signalPeriod(breakout), 24);
  assert.equal(signalPeriod(atrBreakout), 14);
  assert.equal(meanReversion.params.trendFilterPeriod, 50);
  assert.equal(meanReversion.params.trendFilterThreshold, 0.03);
});

test('StrategyValidationError preserves stable API-facing details', () => {
  const error = new StrategyValidationError(
    'MULTI_SYMBOL_UNSUPPORTED',
    'exactly one symbol is required',
    'strategy.universe',
  );

  assert.equal(error.name, 'StrategyValidationError');
  assert.equal(error.code, 'MULTI_SYMBOL_UNSUPPORTED');
  assert.equal(error.field, 'strategy.universe');
  assert.match(error.message, /exactly one symbol/i);
});

import type {
  AnyStrategyDefinition,
  DiagnoseRequest,
  DiagnosisView,
  StrategyDraft,
} from '../api/types.ts';

export const capabilityFixture: readonly AnyStrategyDefinition[] = [{
  archetype: 'ma-cross',
  displayName: 'Moving Average Crossover',
  description: 'Trend-following moving-average crossover.',
  parameters: [
    {
      key: 'fastMA',
      label: 'Fast MA',
      description: 'Fast moving-average period.',
      kind: 'integer',
      minimum: 2,
      defaultValue: 8,
    },
    {
      key: 'slowMA',
      label: 'Slow MA',
      description: 'Slow moving-average period.',
      kind: 'integer',
      minimum: 3,
      defaultValue: 30,
    },
    {
      key: 'leverage',
      label: 'Leverage',
      description: 'Position leverage.',
      kind: 'number',
      minimum: 1,
      maximum: 20,
      defaultValue: 10,
    },
    {
      key: 'stopLossPct',
      label: 'Stop loss',
      description: 'Stop-loss fraction.',
      kind: 'number',
      minimum: 0,
      maximum: 0.99,
      exclusiveMinimum: true,
      defaultValue: 0.5,
    },
    {
      key: 'positionPct',
      label: 'Position size',
      description: 'Position fraction.',
      kind: 'number',
      minimum: 0,
      maximum: 1,
      exclusiveMinimum: true,
      defaultValue: 1,
    },
  ],
  example: {
    id: 'ma-example',
    name: 'MA example',
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
}];

export const draftFixture: StrategyDraft = {
  strategy: {
    id: 'draft-ma',
    name: 'Draft MA',
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
  source: 'rules',
  confidence: 0.9,
  assumptions: [{
    field: 'strategy.params.positionPct',
    value: 1,
    reason: 'registered-default',
  }],
  warnings: [],
};

export const requestFixture: DiagnoseRequest = {
  strategy: draftFixture.strategy,
  style: 'conservative',
  seed: 42,
  candidates: 6,
};

export const diagnosisFixture = {
  scorecard: {
    strategyId: 'draft-ma',
    scenarioSetId: 'tx42/ho100042',
    perStyle: {
      conservative: {
        style: 'conservative',
        riskScore: 42,
        survived: false,
        worstDrawdownPct: 0.42,
        meanPnlPct: -0.1,
      },
      aggressive: {
        style: 'aggressive',
        riskScore: 55,
        survived: false,
        worstDrawdownPct: 0.42,
        meanPnlPct: -0.1,
      },
      trend: {
        style: 'trend',
        riskScore: 50,
        survived: false,
        worstDrawdownPct: 0.42,
        meanPnlPct: -0.1,
      },
    },
    evaluations: [
      'sentiment',
      'macro',
      'market-intel',
      'news',
      'technical',
    ].map((dimension, index) => ({
      scenarioId: `scenario-${index}`,
      scenarioName: `${dimension} stress`,
      dimension,
      sourceSkill: `${dimension}-skill`,
      severity: index + 1,
      shock: {
        kind: 'crash',
        magnitude: 0.2,
        durationBars: 20,
        volMult: 1.5,
        seed: index,
      },
      metrics: {
        pnlPct: -0.1 * index,
        maxDrawdownPct: 0.2 + index * 0.05,
        liquidated: index === 4,
        numTrades: index + 2,
        equityCurve: [1, 0.9, 0.8],
      },
      cause: index === 4 ? 'liquidation' : 'drawdown-breach',
      damageScore: 50 + index * 10,
      narrative: `${dimension} narrative`,
    })),
    deaths: [],
    prescription: {
      changes: {
        leverage: 5,
        stopLossPct: 0.1,
      },
      rationale: 'Lower leverage and tighten the stop loss.',
      patchedStrategy: {
        ...draftFixture.strategy,
        params: {
          ...draftFixture.strategy.params,
          leverage: 5,
          stopLossPct: 0.1,
        },
      },
    },
    tradeoff: {
      robustnessGain: 12,
      returnCost: -0.02,
    },
  },
  summary: {
    riskScore: 42,
    worstDrawdownPct: 0.42,
    totalTrades: 27,
    robustnessGain: 12,
    returnDelta: -0.02,
  },
  deployment: {
    score: 58,
    status: 'watch',
    headline: 'Publish only after manual review',
    gates: [
      {
        key: 'liquidation-free',
        label: 'No liquidation in treatment',
        passed: false,
        value: '1 liquidation',
      },
      {
        key: 'drawdown-budget',
        label: 'Worst drawdown under 35%',
        passed: false,
        value: '42.0%',
      },
      {
        key: 'survival-rate',
        label: 'At least 80% scenarios survived',
        passed: true,
        value: '80.0%',
      },
      {
        key: 'held-out-robustness',
        label: 'Held-out robustness improved',
        passed: true,
        value: '+12',
      },
      {
        key: 'return-tradeoff',
        label: 'Held-out return cost within 15%',
        passed: true,
        value: '-2.0%',
      },
    ],
    blockers: [
      'No liquidation in treatment: 1 liquidation',
      'Worst drawdown under 35%: 42.0%',
    ],
  },
  charts: {
    treatmentEquity: [
      { dimension: 'sentiment', equity: [1, 0.9, 1.1] },
      { dimension: 'macro', equity: [1, 0.8, 0.85] },
      { dimension: 'market-intel', equity: [1, 0.7, 0.75] },
      { dimension: 'news', equity: [1, 0.6, 0.65] },
      { dimension: 'technical', equity: [1, 0.5, 0.55] },
    ],
    heldOutComparison: [
      {
        dimension: 'sentiment',
        original: [1, 0.8, 0.9],
        patched: [1, 0.9, 1.02],
      },
      {
        dimension: 'technical',
        original: [1, 0.5, 0.6],
        patched: [1, 0.75, 0.88],
      },
    ],
    defaultHeldOutDimension: 'technical',
    riskRadar: [
      { dimension: 'sentiment', value: 30 },
      { dimension: 'macro', value: 40 },
      { dimension: 'market-intel', value: 50 },
      { dimension: 'news', value: 60 },
      { dimension: 'technical', value: 70 },
    ],
    parameterChanges: [
      { key: 'leverage', label: 'Leverage', before: 10, after: 5 },
      { key: 'stopLossPct', label: 'Stop loss', before: 0.5, after: 0.1 },
    ],
    scenarioTimeline: [
      {
        dimension: 'technical',
        scenarioName: 'Technical whipsaw',
        damageScore: 90,
        cause: 'liquidation',
        pnlPct: -0.9,
        maxDrawdownPct: 0.99,
      },
      {
        dimension: 'news',
        scenarioName: 'News gap',
        damageScore: 70,
        cause: 'drawdown-breach',
        pnlPct: -0.4,
        maxDrawdownPct: 0.5,
      },
    ],
  },
} as unknown as DiagnosisView;

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

export const diagnosisFixture = {} as DiagnosisView;

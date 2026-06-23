import type {
  FactorDefinition,
  FactorLibraryView,
  MultiFactorFrameworkView,
  NotebookCatalogView,
} from '../platform/contracts.ts';

export const FACTORS: readonly FactorDefinition[] = Object.freeze([
  {
    id: 'trend.ma-slope',
    group: 'trend',
    name: 'Moving-average slope',
    description: 'Measures directional persistence from moving-average change.',
    scenarioUse: 'technical',
    defaultWeight: 0.14,
  },
  {
    id: 'trend.adx-drift',
    group: 'trend',
    name: 'ADX drift',
    description: 'Detects whether trend strength is rising or fading.',
    scenarioUse: 'technical',
    defaultWeight: 0.1,
  },
  {
    id: 'mean-reversion.bollinger-z',
    group: 'mean-reversion',
    name: 'Bollinger z-score',
    description: 'Measures distance from the rolling mean in volatility units.',
    scenarioUse: 'technical',
    defaultWeight: 0.12,
  },
  {
    id: 'volatility.realized-shift',
    group: 'volatility',
    name: 'Realized volatility shift',
    description: 'Compares current volatility with the trailing regime.',
    scenarioUse: 'cross-dimension',
    defaultWeight: 0.12,
  },
  {
    id: 'liquidity.stablecoin-flow',
    group: 'liquidity',
    name: 'Stablecoin liquidity flow',
    description: 'Tracks whether available crypto liquidity is expanding.',
    scenarioUse: 'market-intel',
    defaultWeight: 0.12,
  },
  {
    id: 'sentiment.crowding',
    group: 'sentiment',
    name: 'Position crowding',
    description: 'Flags one-sided long or short participation.',
    scenarioUse: 'sentiment',
    defaultWeight: 0.14,
  },
  {
    id: 'macro.risk-pressure',
    group: 'macro',
    name: 'Macro risk pressure',
    description: 'Combines rates, dollar strength, credit spread, and VIX pressure.',
    scenarioUse: 'macro',
    defaultWeight: 0.14,
  },
  {
    id: 'news.catalyst-density',
    group: 'news',
    name: 'Catalyst density',
    description: 'Scores headline concentration and high-impact event exposure.',
    scenarioUse: 'news',
    defaultWeight: 0.12,
  },
]);

export function getFactorLibrary(): FactorLibraryView {
  return {
    factors: [...FACTORS],
    frameworkVersion: 'factor-library-v1',
  };
}

export function getNotebookCatalog(): NotebookCatalogView {
  return {
    templates: [
      {
        id: 'strategy-diagnosis-lab',
        title: 'Strategy Diagnosis Lab',
        cells: [
          {
            kind: 'markdown',
            title: 'Research question',
            body: 'Define the market, timeframe, execution assumptions, and target risk style.',
          },
          {
            kind: 'query',
            title: 'Dataset selection',
            body: 'Choose symbol, timeframe, candle count, optional date window, and data source.',
          },
          {
            kind: 'diagnosis',
            title: 'Run adversarial diagnosis',
            body: 'Execute five-dimensional diagnosis with held-out validation.',
          },
          {
            kind: 'export',
            title: 'Export evidence',
            body: 'Save JSON, Markdown, dashboard, and decision snapshot artifacts.',
          },
        ],
      },
      {
        id: 'multi-factor-review',
        title: 'Multi-Factor Review',
        cells: [
          {
            kind: 'markdown',
            title: 'Hypothesis',
            body: 'State which factor groups should explain the strategy edge.',
          },
          {
            kind: 'query',
            title: 'Factor map',
            body: 'Load trend, volatility, liquidity, sentiment, macro, and news factors.',
          },
          {
            kind: 'diagnosis',
            title: 'Stress attribution',
            body: 'Compare factor groups against death scenarios and prescription changes.',
          },
          {
            kind: 'export',
            title: 'Reviewer handoff',
            body: 'Export the factor-backed strategy review for judges or teammates.',
          },
        ],
      },
    ],
  };
}

export function getMultiFactorFramework(): MultiFactorFrameworkView {
  return {
    version: 'multi-factor-framework-v1',
    stages: [
      'dataset-selection',
      'factor-normalization',
      'strategy-diagnosis',
      'stress-attribution',
      'repair-validation',
      'evidence-export',
    ],
    factorGroups: [
      'trend',
      'mean-reversion',
      'volatility',
      'liquidity',
      'sentiment',
      'macro',
      'news',
    ],
    outputs: [
      'factor exposure map',
      'five-dimension diagnosis',
      'execution quality dashboard',
      'strategy model review',
      'submission-ready report',
    ],
    safeguards: [
      'no arbitrary hosted code execution',
      'no private exchange orders',
      'dataset fingerprints before production use',
      'held-out validation before publication',
    ],
  };
}

import type {
  Strategy,
  StrategyArchetype,
} from '../contracts.ts';
import type {
  DraftAssumption,
  DraftWarning,
  StrategyDraft,
} from '../platform/contracts.ts';
import { parseStrategy } from '../strategy/parse.ts';
import { strategyRegistry } from '../strategy/registry.ts';
import { buildDefaultStrategy } from './defaults.ts';
import { DescriptionParseError } from './errors.ts';

const MA_TERMS = [
  /\bma\b/i,
  /moving average/i,
  /crossover/i,
  /trend following/i,
  /均线/,
  /交叉/,
  /趋势跟随/,
];
const RSI_TERMS = [/\brsi\b/i, /relative strength/i, /相对强弱/];
const BOLLINGER_TERMS = [
  /bollinger/i,
  /mean reversion/i,
  /overbought/i,
  /oversold/i,
  /布林/,
  /均值回归/,
  /超买/,
  /超卖/,
];
const FORBIDDEN_TERMS = [
  /\bgrid\b/i,
  /网格/,
  /martingale/i,
  /马丁/,
  /arbitrage/i,
  /套利/,
  /custom (?:code|strategy)/i,
  /execute .*code/i,
  /trading bot/i,
  /生成代码/,
  /执行代码/,
];

function matchedCount(
  description: string,
  patterns: readonly RegExp[],
): number {
  return patterns.reduce(
    (count, pattern) => count + Number(pattern.test(description)),
    0,
  );
}

function firstNumber(
  description: string,
  patterns: readonly RegExp[],
): number | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(description);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }
  return undefined;
}

function extractMarket(description: string): {
  symbol?: string;
  timeframe?: string;
} {
  const pair = /\b([a-z0-9]{2,10})\s*\/?\s*usdt\b/i.exec(description);
  const standalone = /\b(btc|eth|sol)\b/i.exec(description);
  const symbol = pair
    ? `${pair[1].toUpperCase()}USDT`
    : standalone
      ? `${standalone[1].toUpperCase()}USDT`
      : undefined;

  let timeframe: string | undefined;
  if (/\b1h\b/i.test(description) || /一小时/.test(description)) {
    timeframe = '1h';
  } else if (/\b4h\b/i.test(description) || /四小时/.test(description)) {
    timeframe = '4h';
  } else if (/\b1d\b/i.test(description) || /日线/.test(description)) {
    timeframe = '1d';
  }
  return { symbol, timeframe };
}

function assignExplicit(
  params: Record<string, number>,
  explicitFields: Set<string>,
  key: string,
  value: number | undefined,
): void {
  if (value === undefined) {
    return;
  }
  params[key] = value;
  explicitFields.add(`strategy.params.${key}`);
}

function extractCommonParams(
  description: string,
  params: Record<string, number>,
  explicitFields: Set<string>,
): void {
  assignExplicit(params, explicitFields, 'leverage', firstNumber(
    description,
    [
      /(\d+(?:\.\d+)?)\s*x\s*leverage/i,
      /(\d+(?:\.\d+)?)\s*倍杠杆/,
    ],
  ));
  const stopLoss = firstNumber(description, [
    /(\d+(?:\.\d+)?)\s*%\s*stop[- ]?loss/i,
    /stop[- ]?loss\s*(\d+(?:\.\d+)?)\s*%/i,
    /止损\s*(\d+(?:\.\d+)?)\s*%/,
  ]);
  assignExplicit(
    params,
    explicitFields,
    'stopLossPct',
    stopLoss === undefined ? undefined : stopLoss / 100,
  );
  const position = firstNumber(description, [
    /(\d+(?:\.\d+)?)\s*%\s*position/i,
    /position\s*(\d+(?:\.\d+)?)\s*%/i,
    /仓位\s*(\d+(?:\.\d+)?)\s*%/,
  ]);
  assignExplicit(
    params,
    explicitFields,
    'positionPct',
    position === undefined ? undefined : position / 100,
  );
}

function extractMaParams(
  description: string,
  params: Record<string, number>,
  explicitFields: Set<string>,
): void {
  assignExplicit(params, explicitFields, 'fastMA', firstNumber(
    description,
    [
      /fast\s*(?:ma|moving average)(?:\s*period)?\s*[:=]?\s*(\d+)/i,
      /快(?:线|均线)\s*[:：=]?\s*(\d+)/,
    ],
  ));
  assignExplicit(params, explicitFields, 'slowMA', firstNumber(
    description,
    [
      /slow\s*(?:ma|moving average)(?:\s*period)?\s*[:=]?\s*(\d+)/i,
      /慢(?:线|均线)\s*[:：=]?\s*(\d+)/,
    ],
  ));
}

function extractRsiParams(
  description: string,
  params: Record<string, number>,
  explicitFields: Set<string>,
): void {
  assignExplicit(params, explicitFields, 'rsiPeriod', firstNumber(
    description,
    [/\brsi(?:\s*period)?\s*[:=]?\s*(\d+)/i, /RSI\s*周期\s*(\d+)/i],
  ));
  assignExplicit(params, explicitFields, 'bollingerPeriod', firstNumber(
    description,
    [
      /bollinger(?:\s*bands?)?(?:\s*period)?\s*[:=]?\s*(\d+)/i,
      /布林(?:带)?(?:\s*周期)?\s*[:：=]?\s*(\d+)/,
    ],
  ));
  assignExplicit(params, explicitFields, 'bollingerStdDev', firstNumber(
    description,
    [
      /(\d+(?:\.\d+)?)\s*(?:standard deviations?|std(?:dev)?)/i,
      /(\d+(?:\.\d+)?)\s*倍标准差/,
    ],
  ));
  assignExplicit(params, explicitFields, 'rsiOversold', firstNumber(
    description,
    [/(?:oversold|超卖)\s*[:：=]?\s*(\d+(?:\.\d+)?)/i],
  ));
  assignExplicit(params, explicitFields, 'rsiOverbought', firstNumber(
    description,
    [/(?:overbought|超买)\s*[:：=]?\s*(\d+(?:\.\d+)?)/i],
  ));
  assignExplicit(params, explicitFields, 'trendFilterPeriod', firstNumber(
    description,
    [
      /trend\s*filter(?:\s*period)?\s*[:=]?\s*(\d+)/i,
      /趋势过滤(?:周期)?\s*[:：=]?\s*(\d+)/,
    ],
  ));
  const threshold = firstNumber(description, [
    /(\d+(?:\.\d+)?)\s*%\s*threshold/i,
    /偏离阈值\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*%/,
  ]);
  assignExplicit(
    params,
    explicitFields,
    'trendFilterThreshold',
    threshold === undefined ? undefined : threshold / 100,
  );
}

function buildAssumptions(
  strategy: Strategy,
  explicitFields: ReadonlySet<string>,
): DraftAssumption[] {
  const definition = strategyRegistry.getDefinition(strategy.archetype);
  const params = strategy.params as unknown as Record<string, number>;
  const assumptions: DraftAssumption[] = [];
  if (!explicitFields.has('strategy.universe.0')) {
    assumptions.push({
      field: 'strategy.universe.0',
      value: strategy.universe[0],
      reason: 'market-default',
    });
  }
  if (!explicitFields.has('strategy.timeframe')) {
    assumptions.push({
      field: 'strategy.timeframe',
      value: strategy.timeframe,
      reason: 'market-default',
    });
  }
  for (const parameter of definition.parameters) {
    const field = `strategy.params.${parameter.key}`;
    if (!explicitFields.has(field)) {
      assumptions.push({
        field,
        value: params[parameter.key],
        reason: 'registered-default',
      });
    }
  }
  return assumptions;
}

export function parseWithRules(description: string): StrategyDraft {
  const normalized = description.trim().toLowerCase();
  if (FORBIDDEN_TERMS.some(pattern => pattern.test(normalized))) {
    throw new DescriptionParseError(
      'UNSUPPORTED_STRATEGY_DESCRIPTION',
      'Custom code and unsupported execution strategies are not accepted.',
      false,
    );
  }

  const matchedMaTerms = matchedCount(normalized, MA_TERMS);
  const matchesMa = matchedMaTerms > 0;
  const matchesRsi = matchedCount(normalized, RSI_TERMS) > 0
    && matchedCount(normalized, BOLLINGER_TERMS) > 0;
  if (matchesMa && matchesRsi) {
    throw new DescriptionParseError(
      'AMBIGUOUS_DESCRIPTION',
      'Describe either MA crossover or RSI Bollinger, not both.',
      false,
    );
  }
  if (!matchesMa && !matchesRsi) {
    throw new DescriptionParseError(
      'UNSUPPORTED_STRATEGY_DESCRIPTION',
      'The description does not match a registered strategy.',
      true,
    );
  }

  const archetype: StrategyArchetype = matchesMa
    ? 'ma-cross'
    : 'rsi-bollinger-mean-reversion';
  const market = extractMarket(normalized);
  const defaultStrategy = buildDefaultStrategy(archetype, market);
  const params = {
    ...defaultStrategy.params,
  } as unknown as Record<string, number>;
  const explicitFields = new Set<string>();
  if (market.symbol) {
    explicitFields.add('strategy.universe.0');
  }
  if (market.timeframe) {
    explicitFields.add('strategy.timeframe');
  }

  extractCommonParams(normalized, params, explicitFields);
  if (archetype === 'ma-cross') {
    extractMaParams(normalized, params, explicitFields);
  } else {
    extractRsiParams(normalized, params, explicitFields);
  }

  const strategy = parseStrategy({
    ...defaultStrategy,
    params,
  });
  const recognitionConfidence = archetype === 'ma-cross'
    ? (matchedMaTerms >= 2 ? 0.78 : 0.68)
    : 0.80;
  const confidence = Math.min(
    0.98,
    recognitionConfidence + explicitFields.size * 0.02,
  );
  const warnings: DraftWarning[] = confidence < 0.75
    ? [{
        code: 'LOW_CONFIDENCE',
        message: 'Review all defaulted fields before diagnosis.',
      }]
    : [];

  return {
    strategy,
    source: 'rules',
    confidence,
    assumptions: buildAssumptions(strategy, explicitFields),
    warnings,
  };
}

import type {
  AtrTrendBreakoutParams,
  DeathCause,
  DecisionContext,
  StrategyAdapter,
  StrategyDecision,
  StrategyDefinition,
} from '../../contracts.ts';
import { freezeStrategyDefinition } from '../definition.ts';
import { simpleMovingAverage } from '../indicators.ts';

const PARAM_LABELS: Record<keyof AtrTrendBreakoutParams, string> = {
  atrPeriod: 'ATR period',
  breakoutLookback: 'Breakout lookback',
  atrStopMultiple: 'ATR stop multiple',
  trendMaPeriod: 'Trend MA period',
  leverage: 'Leverage',
  stopLossPct: 'Stop loss',
  positionPct: 'Position size',
};

function fail(message: string): never {
  throw new Error(`invalid strategy: ${message}`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${field} must be a finite number`);
  }
  return value;
}

function parseParams(value: unknown): AtrTrendBreakoutParams {
  const params = object(value, 'params');
  const atrPeriod = finiteNumber(params.atrPeriod, 'params.atrPeriod');
  const breakoutLookback = finiteNumber(
    params.breakoutLookback,
    'params.breakoutLookback',
  );
  const atrStopMultiple = finiteNumber(
    params.atrStopMultiple,
    'params.atrStopMultiple',
  );
  const trendMaPeriod = finiteNumber(
    params.trendMaPeriod,
    'params.trendMaPeriod',
  );
  const leverage = finiteNumber(params.leverage, 'params.leverage');
  const stopLossPct = finiteNumber(params.stopLossPct, 'params.stopLossPct');
  const positionPct = finiteNumber(params.positionPct, 'params.positionPct');

  if (!Number.isInteger(atrPeriod) || atrPeriod < 2) {
    fail('params.atrPeriod must be an integer greater than or equal to 2');
  }
  if (!Number.isInteger(breakoutLookback) || breakoutLookback < 5) {
    fail('params.breakoutLookback must be an integer greater than or equal to 5');
  }
  if (atrStopMultiple <= 0 || atrStopMultiple > 10) {
    fail('params.atrStopMultiple must be in (0, 10]');
  }
  if (!Number.isInteger(trendMaPeriod) || trendMaPeriod < 2) {
    fail('params.trendMaPeriod must be an integer greater than or equal to 2');
  }
  if (leverage < 1) {
    fail('params.leverage must be greater than or equal to 1');
  }
  if (stopLossPct <= 0 || stopLossPct > 0.99) {
    fail('params.stopLossPct must be in (0, 0.99]');
  }
  if (positionPct <= 0 || positionPct > 1) {
    fail('params.positionPct must be in (0, 1]');
  }

  return {
    atrPeriod,
    breakoutLookback,
    atrStopMultiple,
    trendMaPeriod,
    leverage,
    stopLossPct,
    positionPct,
  };
}

function highest(
  prices: readonly number[],
  startInclusive: number,
  endInclusive: number,
): number {
  let value = Number.NEGATIVE_INFINITY;
  for (let index = startInclusive; index <= endInclusive; index++) {
    value = Math.max(value, prices[index]);
  }
  return value;
}

function lowest(
  prices: readonly number[],
  startInclusive: number,
  endInclusive: number,
): number {
  let value = Number.POSITIVE_INFINITY;
  for (let index = startInclusive; index <= endInclusive; index++) {
    value = Math.min(value, prices[index]);
  }
  return value;
}

function averageTrueRangePct(
  prices: readonly number[],
  period: number,
  index: number,
): number | null {
  if (index < period || index >= prices.length) {
    return null;
  }
  let total = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor++) {
    total += Math.abs(prices[cursor] / prices[cursor - 1] - 1);
  }
  return total / period;
}

function decide(
  params: AtrTrendBreakoutParams,
  context: DecisionContext,
): StrategyDecision {
  const warmup = Math.max(
    params.atrPeriod,
    params.breakoutLookback,
    params.trendMaPeriod,
  );
  if (context.index < warmup) {
    return 'hold';
  }

  const trendAverage = simpleMovingAverage(
    context.prices,
    params.trendMaPeriod,
    context.index,
  );
  const atrPct = averageTrueRangePct(
    context.prices,
    params.atrPeriod,
    context.index,
  );
  if (trendAverage === null || atrPct === null) {
    return 'hold';
  }

  const close = context.prices[context.index];
  const atrStopPct = atrPct * params.atrStopMultiple;
  if (context.position === 1) {
    return close < trendAverage
      || close <= context.entryPrice * (1 - atrStopPct)
      ? 'flat'
      : 'hold';
  }
  if (context.position === -1) {
    return close > trendAverage
      || close >= context.entryPrice * (1 + atrStopPct)
      ? 'flat'
      : 'hold';
  }

  const rangeStart = context.index - params.breakoutLookback;
  const rangeEnd = context.index - 1;
  const high = highest(context.prices, rangeStart, rangeEnd);
  const low = lowest(context.prices, rangeStart, rangeEnd);
  if (close > high && close > trendAverage) {
    return 'long';
  }
  if (close < low && close < trendAverage) {
    return 'short';
  }
  return 'hold';
}

function targetedPatch(
  params: AtrTrendBreakoutParams,
  causes: readonly DeathCause[],
): {
  patch: Partial<AtrTrendBreakoutParams>;
  rationale: string[];
} {
  const patch: Partial<AtrTrendBreakoutParams> = {};
  const rationale: string[] = [];
  const uniqueCauses = new Set(causes);

  if (uniqueCauses.has('liquidation')) {
    const leverage = Math.max(1, Math.round(params.leverage / 2));
    patch.leverage = leverage;
    patch.stopLossPct = Math.min(
      params.stopLossPct,
      Number((0.8 / leverage / 2).toFixed(3)),
    );
    rationale.push(
      'Liquidation -> reduce leverage and pull the stop inside half the liquidation line',
    );
  }

  if (uniqueCauses.has('drawdown-breach')) {
    patch.positionPct = Number((params.positionPct * 0.7).toFixed(2));
    patch.atrStopMultiple = Math.min(
      10,
      Number((params.atrStopMultiple * 1.15).toFixed(2)),
    );
    rationale.push(
      'Drawdown breach -> reduce exposure and give ATR stops more room',
    );
  }

  if (uniqueCauses.has('stop-loss-bleed')) {
    patch.breakoutLookback = Math.round(params.breakoutLookback * 1.25);
    patch.atrStopMultiple = Math.min(
      10,
      Number(((patch.atrStopMultiple ?? params.atrStopMultiple) * 1.2).toFixed(2)),
    );
    rationale.push(
      'Stop-loss bleed -> require a longer breakout base and wider ATR invalidation',
    );
  }

  return { patch, rationale };
}

function targetedFields(
  causes: ReadonlySet<DeathCause>,
): readonly (keyof AtrTrendBreakoutParams)[] {
  const fields = new Set<keyof AtrTrendBreakoutParams>();
  if (causes.has('liquidation')) {
    fields.add('leverage');
    fields.add('stopLossPct');
  }
  if (causes.has('drawdown-breach')) {
    fields.add('positionPct');
    fields.add('atrStopMultiple');
  }
  if (causes.has('stop-loss-bleed')) {
    fields.add('breakoutLookback');
    fields.add('atrStopMultiple');
  }
  return [...fields];
}

function jitterParams(
  params: AtrTrendBreakoutParams,
  random: () => number,
  fields: readonly (keyof AtrTrendBreakoutParams)[],
): AtrTrendBreakoutParams {
  const selected = new Set(fields);
  const jitter = (value: number) => value * (0.8 + random() * 0.4);

  return {
    atrPeriod: selected.has('atrPeriod')
      ? Math.max(2, Math.round(jitter(params.atrPeriod)))
      : params.atrPeriod,
    breakoutLookback: selected.has('breakoutLookback')
      ? Math.max(5, Math.round(jitter(params.breakoutLookback)))
      : params.breakoutLookback,
    atrStopMultiple: selected.has('atrStopMultiple')
      ? Math.min(
        10,
        Math.max(0.25, Number(jitter(params.atrStopMultiple).toFixed(2))),
      )
      : params.atrStopMultiple,
    trendMaPeriod: selected.has('trendMaPeriod')
      ? Math.max(2, Math.round(jitter(params.trendMaPeriod)))
      : params.trendMaPeriod,
    leverage: selected.has('leverage')
      ? Math.max(1, Math.round(jitter(params.leverage)))
      : params.leverage,
    stopLossPct: selected.has('stopLossPct')
      ? Math.min(
        0.99,
        Math.max(0.01, Number(jitter(params.stopLossPct).toFixed(3))),
      )
      : params.stopLossPct,
    positionPct: selected.has('positionPct')
      ? Math.min(
        1,
        Math.max(0.1, Number(jitter(params.positionPct).toFixed(2))),
      )
      : params.positionPct,
  };
}

const definition = freezeStrategyDefinition({
  archetype: 'atr-trend-breakout',
  displayName: 'ATR Trend Breakout',
  description:
    'Volatility-aware trend breakout strategy using ATR-sized invalidation and a moving-average trend filter.',
  parameters: [
    {
      key: 'atrPeriod',
      label: PARAM_LABELS.atrPeriod,
      description: 'Bars used to estimate recent average true range.',
      kind: 'integer',
      minimum: 2,
      defaultValue: 14,
    },
    {
      key: 'breakoutLookback',
      label: PARAM_LABELS.breakoutLookback,
      description: 'Bars used to define the prior high/low breakout range.',
      kind: 'integer',
      minimum: 5,
      defaultValue: 20,
    },
    {
      key: 'atrStopMultiple',
      label: PARAM_LABELS.atrStopMultiple,
      description: 'ATR multiple used as the strategy-level invalidation stop.',
      kind: 'number',
      minimum: 0,
      maximum: 10,
      exclusiveMinimum: true,
      defaultValue: 2.5,
    },
    {
      key: 'trendMaPeriod',
      label: PARAM_LABELS.trendMaPeriod,
      description: 'Moving-average period used to confirm the breakout trend.',
      kind: 'integer',
      minimum: 2,
      defaultValue: 50,
    },
    {
      key: 'leverage',
      label: PARAM_LABELS.leverage,
      description: 'Position leverage multiplier.',
      kind: 'number',
      minimum: 1,
      defaultValue: 5,
    },
    {
      key: 'stopLossPct',
      label: PARAM_LABELS.stopLossPct,
      description: 'Backtest engine stop-loss distance as a decimal fraction.',
      kind: 'number',
      minimum: 0,
      maximum: 0.99,
      exclusiveMinimum: true,
      defaultValue: 0.12,
    },
    {
      key: 'positionPct',
      label: PARAM_LABELS.positionPct,
      description: 'Share of equity allocated to one position.',
      kind: 'number',
      minimum: 0,
      maximum: 1,
      exclusiveMinimum: true,
      defaultValue: 0.6,
    },
  ],
  example: {
    id: 'atr-breakout-001',
    name: 'BTC ATR trend breakout',
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
  },
} satisfies StrategyDefinition<'atr-trend-breakout'>);

export const atrTrendBreakoutAdapter:
  StrategyAdapter<'atr-trend-breakout'> = {
    archetype: 'atr-trend-breakout',
    definition,
    parseParams,
    decide,
    targetedPatch,
    targetedFields,
    jitterParams,
    paramLabel(key) {
      return PARAM_LABELS[key];
    },
  };

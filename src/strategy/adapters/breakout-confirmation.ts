import type {
  BreakoutConfirmationParams,
  DeathCause,
  DecisionContext,
  StrategyAdapter,
  StrategyDecision,
  StrategyDefinition,
} from '../../contracts.ts';
import { freezeStrategyDefinition } from '../definition.ts';
import { simpleMovingAverage } from '../indicators.ts';

const PARAM_LABELS: Record<keyof BreakoutConfirmationParams, string> = {
  breakoutLookback: 'Breakout lookback',
  confirmationBars: 'Confirmation bars',
  exitLookback: 'Exit lookback',
  volatilityLookback: 'Volatility lookback',
  minBreakoutPct: 'Minimum breakout',
  minVolatilityPct: 'Minimum volatility',
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

function parseParams(value: unknown): BreakoutConfirmationParams {
  const params = object(value, 'params');
  const breakoutLookback = finiteNumber(
    params.breakoutLookback,
    'params.breakoutLookback',
  );
  const confirmationBars = finiteNumber(
    params.confirmationBars,
    'params.confirmationBars',
  );
  const exitLookback = finiteNumber(params.exitLookback, 'params.exitLookback');
  const volatilityLookback = finiteNumber(
    params.volatilityLookback,
    'params.volatilityLookback',
  );
  const minBreakoutPct = finiteNumber(
    params.minBreakoutPct,
    'params.minBreakoutPct',
  );
  const minVolatilityPct = finiteNumber(
    params.minVolatilityPct,
    'params.minVolatilityPct',
  );
  const leverage = finiteNumber(params.leverage, 'params.leverage');
  const stopLossPct = finiteNumber(params.stopLossPct, 'params.stopLossPct');
  const positionPct = finiteNumber(params.positionPct, 'params.positionPct');

  if (!Number.isInteger(breakoutLookback) || breakoutLookback < 5) {
    fail('params.breakoutLookback must be an integer greater than or equal to 5');
  }
  if (!Number.isInteger(confirmationBars) || confirmationBars < 1) {
    fail('params.confirmationBars must be an integer greater than or equal to 1');
  }
  if (!Number.isInteger(exitLookback) || exitLookback < 2) {
    fail('params.exitLookback must be an integer greater than or equal to 2');
  }
  if (exitLookback >= breakoutLookback) {
    fail('params.exitLookback must be less than params.breakoutLookback');
  }
  if (!Number.isInteger(volatilityLookback) || volatilityLookback < 3) {
    fail(
      'params.volatilityLookback must be an integer greater than or equal to 3',
    );
  }
  if (minBreakoutPct <= 0 || minBreakoutPct > 0.25) {
    fail('params.minBreakoutPct must be in (0, 0.25]');
  }
  if (minVolatilityPct < 0 || minVolatilityPct > 0.2) {
    fail('params.minVolatilityPct must be in [0, 0.2]');
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
    breakoutLookback,
    confirmationBars,
    exitLookback,
    volatilityLookback,
    minBreakoutPct,
    minVolatilityPct,
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

function averageAbsoluteReturn(
  prices: readonly number[],
  index: number,
  lookback: number,
): number | null {
  if (index < lookback) {
    return null;
  }
  let total = 0;
  for (let cursor = index - lookback + 1; cursor <= index; cursor++) {
    total += Math.abs(prices[cursor] / prices[cursor - 1] - 1);
  }
  return total / lookback;
}

function confirmedAbove(
  prices: readonly number[],
  index: number,
  bars: number,
  threshold: number,
): boolean {
  for (let cursor = index - bars + 1; cursor <= index; cursor++) {
    if (prices[cursor] <= threshold) {
      return false;
    }
  }
  return true;
}

function confirmedBelow(
  prices: readonly number[],
  index: number,
  bars: number,
  threshold: number,
): boolean {
  for (let cursor = index - bars + 1; cursor <= index; cursor++) {
    if (prices[cursor] >= threshold) {
      return false;
    }
  }
  return true;
}

function decide(
  params: BreakoutConfirmationParams,
  context: DecisionContext,
): StrategyDecision {
  const warmup = Math.max(
    params.breakoutLookback + params.confirmationBars,
    params.volatilityLookback + 1,
    params.exitLookback,
  );
  if (context.index < warmup) {
    return 'hold';
  }

  const exitAverage = simpleMovingAverage(
    context.prices,
    params.exitLookback,
    context.index,
  );
  if (exitAverage === null) {
    return 'hold';
  }
  const close = context.prices[context.index];
  if (context.position === 1) {
    return close < exitAverage ? 'flat' : 'hold';
  }
  if (context.position === -1) {
    return close > exitAverage ? 'flat' : 'hold';
  }

  const rangeEnd = context.index - params.confirmationBars;
  const rangeStart = rangeEnd - params.breakoutLookback + 1;
  const high = highest(context.prices, rangeStart, rangeEnd);
  const low = lowest(context.prices, rangeStart, rangeEnd);
  const volatility = averageAbsoluteReturn(
    context.prices,
    context.index,
    params.volatilityLookback,
  );
  if (volatility === null || volatility < params.minVolatilityPct) {
    return 'hold';
  }

  const longThreshold = high * (1 + params.minBreakoutPct);
  const shortThreshold = low * (1 - params.minBreakoutPct);
  if (
    confirmedAbove(
      context.prices,
      context.index,
      params.confirmationBars,
      longThreshold,
    )
  ) {
    return 'long';
  }
  if (
    confirmedBelow(
      context.prices,
      context.index,
      params.confirmationBars,
      shortThreshold,
    )
  ) {
    return 'short';
  }
  return 'hold';
}

function targetedPatch(
  params: BreakoutConfirmationParams,
  causes: readonly DeathCause[],
): {
  patch: Partial<BreakoutConfirmationParams>;
  rationale: string[];
} {
  const patch: Partial<BreakoutConfirmationParams> = {};
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
    patch.exitLookback = Math.max(2, Math.round(params.exitLookback * 0.8));
    rationale.push(
      'Drawdown breach -> reduce exposure and shorten the invalidation exit',
    );
  }

  if (uniqueCauses.has('stop-loss-bleed')) {
    patch.breakoutLookback = Math.round(params.breakoutLookback * 1.25);
    patch.confirmationBars = Math.min(8, params.confirmationBars + 1);
    patch.minBreakoutPct = Math.min(
      0.25,
      Number((params.minBreakoutPct * 1.25).toFixed(4)),
    );
    patch.minVolatilityPct = Math.min(
      0.2,
      Number((params.minVolatilityPct * 1.15).toFixed(4)),
    );
    rationale.push(
      'Stop-loss bleed -> demand a wider, better-confirmed breakout before entry',
    );
  }

  return { patch, rationale };
}

function targetedFields(
  causes: ReadonlySet<DeathCause>,
): readonly (keyof BreakoutConfirmationParams)[] {
  const fields = new Set<keyof BreakoutConfirmationParams>();
  if (causes.has('liquidation')) {
    fields.add('leverage');
    fields.add('stopLossPct');
  }
  if (causes.has('drawdown-breach')) {
    fields.add('positionPct');
    fields.add('exitLookback');
  }
  if (causes.has('stop-loss-bleed')) {
    fields.add('breakoutLookback');
    fields.add('confirmationBars');
    fields.add('minBreakoutPct');
    fields.add('minVolatilityPct');
  }
  return [...fields];
}

function jitterParams(
  params: BreakoutConfirmationParams,
  random: () => number,
  fields: readonly (keyof BreakoutConfirmationParams)[],
): BreakoutConfirmationParams {
  const selected = new Set(fields);
  const jitter = (value: number) => value * (0.8 + random() * 0.4);
  const breakoutLookback = selected.has('breakoutLookback')
    ? Math.max(5, Math.round(jitter(params.breakoutLookback)))
    : params.breakoutLookback;
  const exitLookback = selected.has('exitLookback')
    ? Math.max(
      2,
      Math.min(breakoutLookback - 1, Math.round(jitter(params.exitLookback))),
    )
    : Math.min(params.exitLookback, breakoutLookback - 1);

  return {
    breakoutLookback,
    confirmationBars: selected.has('confirmationBars')
      ? Math.min(8, Math.max(1, Math.round(jitter(params.confirmationBars))))
      : params.confirmationBars,
    exitLookback,
    volatilityLookback: selected.has('volatilityLookback')
      ? Math.max(3, Math.round(jitter(params.volatilityLookback)))
      : params.volatilityLookback,
    minBreakoutPct: selected.has('minBreakoutPct')
      ? Math.min(
        0.25,
        Math.max(0.001, Number(jitter(params.minBreakoutPct).toFixed(4))),
      )
      : params.minBreakoutPct,
    minVolatilityPct: selected.has('minVolatilityPct')
      ? Math.min(
        0.2,
        Math.max(0, Number(jitter(params.minVolatilityPct).toFixed(4))),
      )
      : params.minVolatilityPct,
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
  archetype: 'breakout-confirmation',
  displayName: 'Breakout Confirmation',
  description:
    'Trend-breakout strategy that waits for confirmed range expansion and exits when the breakout fails.',
  parameters: [
    {
      key: 'breakoutLookback',
      label: PARAM_LABELS.breakoutLookback,
      description: 'Bars used to define the pre-breakout range.',
      kind: 'integer',
      minimum: 5,
      defaultValue: 24,
    },
    {
      key: 'confirmationBars',
      label: PARAM_LABELS.confirmationBars,
      description: 'Consecutive bars required beyond the breakout threshold.',
      kind: 'integer',
      minimum: 1,
      maximum: 8,
      defaultValue: 2,
    },
    {
      key: 'exitLookback',
      label: PARAM_LABELS.exitLookback,
      description: 'Short moving-average period used for breakout invalidation.',
      kind: 'integer',
      minimum: 2,
      defaultValue: 8,
    },
    {
      key: 'volatilityLookback',
      label: PARAM_LABELS.volatilityLookback,
      description: 'Bars used to measure realized movement before entry.',
      kind: 'integer',
      minimum: 3,
      defaultValue: 12,
    },
    {
      key: 'minBreakoutPct',
      label: PARAM_LABELS.minBreakoutPct,
      description: 'Minimum distance beyond the prior range required to enter.',
      kind: 'number',
      minimum: 0,
      maximum: 0.25,
      exclusiveMinimum: true,
      defaultValue: 0.012,
    },
    {
      key: 'minVolatilityPct',
      label: PARAM_LABELS.minVolatilityPct,
      description: 'Minimum average absolute return needed to accept a signal.',
      kind: 'number',
      minimum: 0,
      maximum: 0.2,
      defaultValue: 0.002,
    },
    {
      key: 'leverage',
      label: PARAM_LABELS.leverage,
      description: 'Position leverage multiplier.',
      kind: 'number',
      minimum: 1,
      defaultValue: 4,
    },
    {
      key: 'stopLossPct',
      label: PARAM_LABELS.stopLossPct,
      description: 'Stop-loss distance as a decimal fraction.',
      kind: 'number',
      minimum: 0,
      maximum: 0.99,
      exclusiveMinimum: true,
      defaultValue: 0.08,
    },
    {
      key: 'positionPct',
      label: PARAM_LABELS.positionPct,
      description: 'Share of equity allocated to one position.',
      kind: 'number',
      minimum: 0,
      maximum: 1,
      exclusiveMinimum: true,
      defaultValue: 0.55,
    },
  ],
  example: {
    id: 'breakout-confirmation-001',
    name: 'BTC confirmed breakout',
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
  },
} satisfies StrategyDefinition<'breakout-confirmation'>);

export const breakoutConfirmationAdapter:
  StrategyAdapter<'breakout-confirmation'> = {
    archetype: 'breakout-confirmation',
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

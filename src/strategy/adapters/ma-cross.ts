import type {
  DeathCause,
  DecisionContext,
  MaCrossParams,
  StrategyAdapter,
  StrategyDecision,
} from '../../contracts.ts';
import {
  jitterParams,
  targetedPatch,
} from '../../prescribe/mutations.ts';

const PARAM_LABELS: Record<keyof MaCrossParams, string> = {
  fastMA: '快均线',
  slowMA: '慢均线',
  leverage: '杠杆',
  stopLossPct: '止损比例',
  positionPct: '仓位比例',
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

function parseParams(value: unknown): MaCrossParams {
  const params = object(value, 'params');
  const fastMA = finiteNumber(params.fastMA, 'params.fastMA');
  const slowMA = finiteNumber(params.slowMA, 'params.slowMA');
  const leverage = finiteNumber(params.leverage, 'params.leverage');
  const stopLossPct = finiteNumber(params.stopLossPct, 'params.stopLossPct');
  const positionPct = finiteNumber(params.positionPct, 'params.positionPct');

  if (!Number.isInteger(fastMA) || fastMA < 2) {
    fail('params.fastMA must be an integer greater than or equal to 2');
  }
  if (!Number.isInteger(slowMA) || slowMA <= fastMA) {
    fail('params.slowMA must be an integer greater than params.fastMA');
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

  return { fastMA, slowMA, leverage, stopLossPct, positionPct };
}

function simpleMovingAverage(
  prices: readonly number[],
  period: number,
  index: number,
): number | null {
  if (index + 1 < period) {
    return null;
  }

  let sum = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor++) {
    sum += prices[cursor];
  }
  return sum / period;
}

function decide(
  params: MaCrossParams,
  context: DecisionContext,
): StrategyDecision {
  const fastAverage = simpleMovingAverage(
    context.prices,
    params.fastMA,
    context.index,
  );
  const slowAverage = simpleMovingAverage(
    context.prices,
    params.slowMA,
    context.index,
  );
  if (fastAverage === null || slowAverage === null) {
    return 'hold';
  }
  if (fastAverage > slowAverage) {
    return 'long';
  }
  if (fastAverage < slowAverage) {
    return 'short';
  }
  return 'hold';
}

function targetedFields(
  causes: ReadonlySet<DeathCause>,
): readonly (keyof MaCrossParams)[] {
  const fields = new Set<keyof MaCrossParams>();
  if (causes.has('liquidation')) {
    fields.add('leverage');
    fields.add('stopLossPct');
  }
  if (causes.has('drawdown-breach')) {
    fields.add('positionPct');
  }
  if (causes.has('stop-loss-bleed')) {
    fields.add('fastMA');
    fields.add('slowMA');
  }
  return [...fields];
}

export const maCrossAdapter: StrategyAdapter<'ma-cross'> = {
  archetype: 'ma-cross',
  parseParams,
  decide,
  targetedPatch(params, causes) {
    return targetedPatch(params, [...causes]);
  },
  targetedFields,
  jitterParams,
  paramLabel(key) {
    return PARAM_LABELS[key];
  },
};

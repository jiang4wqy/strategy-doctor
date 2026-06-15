import type {
  DeathCause,
  DecisionContext,
  MaCrossParams,
  StrategyAdapter,
  StrategyDefinition,
  StrategyDecision,
} from '../../contracts.ts';
import { freezeStrategyDefinition } from '../definition.ts';

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

function targetedPatch(
  params: MaCrossParams,
  causes: readonly DeathCause[],
): {
  patch: Partial<MaCrossParams>;
  rationale: string[];
} {
  const patch: Partial<MaCrossParams> = {};
  const rationale: string[] = [];
  const uniqueCauses = new Set(causes);

  if (uniqueCauses.has('liquidation')) {
    const leverage = Math.max(1, Math.round(params.leverage / 2));
    patch.leverage = leverage;
    patch.stopLossPct = Math.min(
      params.stopLossPct,
      Number((0.8 / leverage / 2).toFixed(3)),
    );
    rationale.push('清算死因 → 降低杠杆并将止损收紧到爆仓线一半以内');
  }

  if (uniqueCauses.has('drawdown-breach')) {
    patch.positionPct = Number((params.positionPct * 0.7).toFixed(2));
    rationale.push('回撤击穿 → 降低仓位暴露');
  }

  if (uniqueCauses.has('stop-loss-bleed')) {
    patch.fastMA = Math.round(params.fastMA * 1.5);
    patch.slowMA = Math.round(params.slowMA * 1.5);
    rationale.push('震荡反复止损放血 → 均线周期放慢 1.5 倍过滤噪音');
  }

  return { patch, rationale };
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

function jitterParams(
  params: MaCrossParams,
  random: () => number,
  fields: readonly (keyof MaCrossParams)[],
): MaCrossParams {
  const selected = new Set(fields);
  const jitter = (value: number) => value * (0.8 + random() * 0.4);
  const fastMA = selected.has('fastMA')
    ? Math.max(2, Math.round(jitter(params.fastMA)))
    : params.fastMA;
  const slowMA = selected.has('slowMA')
    ? Math.max(fastMA + 2, Math.round(jitter(params.slowMA)))
    : params.slowMA;

  return {
    fastMA,
    slowMA,
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
  archetype: 'ma-cross',
  displayName: 'Moving Average Crossover',
  description: 'Trend-following strategy using fast and slow moving averages.',
  parameters: [
    {
      key: 'fastMA',
      label: PARAM_LABELS.fastMA,
      description: 'Fast moving-average period in bars.',
      kind: 'integer',
      minimum: 2,
      defaultValue: 8,
    },
    {
      key: 'slowMA',
      label: PARAM_LABELS.slowMA,
      description: 'Slow moving-average period; must exceed fastMA.',
      kind: 'integer',
      minimum: 3,
      defaultValue: 30,
    },
    {
      key: 'leverage',
      label: PARAM_LABELS.leverage,
      description: 'Position leverage multiplier.',
      kind: 'number',
      minimum: 1,
      defaultValue: 10,
    },
    {
      key: 'stopLossPct',
      label: PARAM_LABELS.stopLossPct,
      description: 'Stop-loss distance as a decimal fraction.',
      kind: 'number',
      minimum: 0,
      maximum: 0.99,
      exclusiveMinimum: true,
      defaultValue: 0.5,
    },
    {
      key: 'positionPct',
      label: PARAM_LABELS.positionPct,
      description: 'Share of equity allocated to one position.',
      kind: 'number',
      minimum: 0,
      maximum: 1,
      exclusiveMinimum: true,
      defaultValue: 1,
    },
  ],
  example: {
    id: 'tf-001',
    name: '高杠杆趋势跟随',
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
} satisfies StrategyDefinition<'ma-cross'>);

export const maCrossAdapter: StrategyAdapter<'ma-cross'> = {
  archetype: 'ma-cross',
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

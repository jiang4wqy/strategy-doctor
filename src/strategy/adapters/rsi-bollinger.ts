import type {
  DeathCause,
  DecisionContext,
  RsiBollingerParams,
  StrategyAdapter,
  StrategyDefinition,
  StrategyDecision,
} from '../../contracts.ts';
import { freezeStrategyDefinition } from '../definition.ts';
import {
  populationStandardDeviation,
  simpleMovingAverage,
  wilderRsi,
} from '../indicators.ts';

const PARAM_LABELS: Record<keyof RsiBollingerParams, string> = {
  rsiPeriod: 'RSI 周期',
  rsiOversold: 'RSI 超卖阈值',
  rsiOverbought: 'RSI 超买阈值',
  bollingerPeriod: '布林带周期',
  bollingerStdDev: '布林带标准差倍数',
  trendFilterPeriod: '趋势过滤周期',
  trendFilterThreshold: '趋势偏离阈值',
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

function parseParams(value: unknown): RsiBollingerParams {
  const params = object(value, 'params');
  const rsiPeriod = finiteNumber(params.rsiPeriod, 'params.rsiPeriod');
  const rsiOversold = finiteNumber(
    params.rsiOversold,
    'params.rsiOversold',
  );
  const rsiOverbought = finiteNumber(
    params.rsiOverbought,
    'params.rsiOverbought',
  );
  const bollingerPeriod = finiteNumber(
    params.bollingerPeriod,
    'params.bollingerPeriod',
  );
  const bollingerStdDev = finiteNumber(
    params.bollingerStdDev,
    'params.bollingerStdDev',
  );
  const trendFilterPeriod = finiteNumber(
    params.trendFilterPeriod,
    'params.trendFilterPeriod',
  );
  const trendFilterThreshold = finiteNumber(
    params.trendFilterThreshold,
    'params.trendFilterThreshold',
  );
  const leverage = finiteNumber(params.leverage, 'params.leverage');
  const stopLossPct = finiteNumber(
    params.stopLossPct,
    'params.stopLossPct',
  );
  const positionPct = finiteNumber(params.positionPct, 'params.positionPct');

  if (!Number.isInteger(rsiPeriod) || rsiPeriod < 2) {
    fail('params.rsiPeriod must be an integer greater than or equal to 2');
  }
  if (rsiOversold <= 0 || rsiOversold >= 50) {
    fail('params.rsiOversold must be in (0, 50)');
  }
  if (rsiOverbought <= 50 || rsiOverbought >= 100) {
    fail('params.rsiOverbought must be in (50, 100)');
  }
  if (!Number.isInteger(bollingerPeriod) || bollingerPeriod < 2) {
    fail(
      'params.bollingerPeriod must be an integer greater than or equal to 2',
    );
  }
  if (bollingerStdDev <= 0 || bollingerStdDev > 5) {
    fail('params.bollingerStdDev must be in (0, 5]');
  }
  if (
    !Number.isInteger(trendFilterPeriod)
    || trendFilterPeriod <= bollingerPeriod
  ) {
    fail(
      'params.trendFilterPeriod must be an integer greater than params.bollingerPeriod',
    );
  }
  if (trendFilterThreshold <= 0 || trendFilterThreshold > 0.5) {
    fail('params.trendFilterThreshold must be in (0, 0.5]');
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
    rsiPeriod,
    rsiOversold,
    rsiOverbought,
    bollingerPeriod,
    bollingerStdDev,
    trendFilterPeriod,
    trendFilterThreshold,
    leverage,
    stopLossPct,
    positionPct,
  };
}

function decide(
  params: RsiBollingerParams,
  context: DecisionContext,
): StrategyDecision {
  const middle = simpleMovingAverage(
    context.prices,
    params.bollingerPeriod,
    context.index,
  );
  const standardDeviation = populationStandardDeviation(
    context.prices,
    params.bollingerPeriod,
    context.index,
  );
  const rsi = wilderRsi(
    context.prices,
    params.rsiPeriod,
    context.index,
  );
  const trendAverage = simpleMovingAverage(
    context.prices,
    params.trendFilterPeriod,
    context.index,
  );
  if (
    middle === null
    || standardDeviation === null
    || rsi === null
    || trendAverage === null
  ) {
    return 'hold';
  }

  const close = context.prices[context.index];
  const upperBand = middle + standardDeviation * params.bollingerStdDev;
  const lowerBand = middle - standardDeviation * params.bollingerStdDev;

  if (context.position === 1) {
    return close >= middle || rsi >= 50 ? 'flat' : 'hold';
  }
  if (context.position === -1) {
    return close <= middle || rsi <= 50 ? 'flat' : 'hold';
  }

  const trendDeviation = close / trendAverage - 1;
  const strongUptrend = trendDeviation > params.trendFilterThreshold;
  const strongDowntrend = trendDeviation < -params.trendFilterThreshold;

  if (
    close <= lowerBand
    && rsi <= params.rsiOversold
    && !strongDowntrend
  ) {
    return 'long';
  }
  if (
    close >= upperBand
    && rsi >= params.rsiOverbought
    && !strongUptrend
  ) {
    return 'short';
  }
  return 'hold';
}

function targetedPatch(
  params: RsiBollingerParams,
  causes: readonly DeathCause[],
): {
  patch: Partial<RsiBollingerParams>;
  rationale: string[];
} {
  const patch: Partial<RsiBollingerParams> = {};
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
    patch.bollingerStdDev = Math.min(
      5,
      Number((params.bollingerStdDev * 1.15).toFixed(3)),
    );
    patch.rsiOversold = Math.max(1, params.rsiOversold - 3);
    patch.rsiOverbought = Math.min(99, params.rsiOverbought + 3);
    patch.trendFilterThreshold = Math.max(
      0.001,
      Number((params.trendFilterThreshold * 0.85).toFixed(4)),
    );
    rationale.push(
      '反复止损放血 → 放宽布林带与 RSI 极值，并加强趋势过滤',
    );
  }

  return { patch, rationale };
}

function targetedFields(
  causes: ReadonlySet<DeathCause>,
): readonly (keyof RsiBollingerParams)[] {
  const fields = new Set<keyof RsiBollingerParams>();
  if (causes.has('liquidation')) {
    fields.add('leverage');
    fields.add('stopLossPct');
  }
  if (causes.has('drawdown-breach')) {
    fields.add('positionPct');
  }
  if (causes.has('stop-loss-bleed')) {
    fields.add('bollingerStdDev');
    fields.add('rsiOversold');
    fields.add('rsiOverbought');
    fields.add('trendFilterThreshold');
  }
  return [...fields];
}

function jitterParams(
  params: RsiBollingerParams,
  random: () => number,
  fields: readonly (keyof RsiBollingerParams)[],
): RsiBollingerParams {
  const selected = new Set(fields);
  const jitter = (value: number) => value * (0.8 + random() * 0.4);

  const rsiPeriod = selected.has('rsiPeriod')
    ? Math.max(2, Math.round(jitter(params.rsiPeriod)))
    : params.rsiPeriod;
  const rsiOversold = selected.has('rsiOversold')
    ? Math.min(49, Math.max(1, Number(jitter(params.rsiOversold).toFixed(2))))
    : params.rsiOversold;
  const rsiOverbought = selected.has('rsiOverbought')
    ? Math.min(
      99,
      Math.max(51, Number(jitter(params.rsiOverbought).toFixed(2))),
    )
    : params.rsiOverbought;

  const jitteredBollingerPeriod = selected.has('bollingerPeriod')
    ? Math.max(2, Math.round(jitter(params.bollingerPeriod)))
    : params.bollingerPeriod;
  const bollingerPeriod = selected.has('trendFilterPeriod')
    ? jitteredBollingerPeriod
    : Math.min(params.trendFilterPeriod - 1, jitteredBollingerPeriod);
  const trendFilterPeriod = selected.has('trendFilterPeriod')
    ? Math.max(
      bollingerPeriod + 1,
      Math.round(jitter(params.trendFilterPeriod)),
    )
    : params.trendFilterPeriod;

  return {
    rsiPeriod,
    rsiOversold,
    rsiOverbought,
    bollingerPeriod,
    bollingerStdDev: selected.has('bollingerStdDev')
      ? Math.min(
        5,
        Math.max(0.1, Number(jitter(params.bollingerStdDev).toFixed(3))),
      )
      : params.bollingerStdDev,
    trendFilterPeriod,
    trendFilterThreshold: selected.has('trendFilterThreshold')
      ? Math.min(
        0.5,
        Math.max(
          0.001,
          Number(jitter(params.trendFilterThreshold).toFixed(4)),
        ),
      )
      : params.trendFilterThreshold,
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
    archetype: 'rsi-bollinger-mean-reversion',
    displayName: 'RSI + Bollinger Mean Reversion',
    description:
      'Mean-reversion strategy with RSI, Bollinger Bands, and a trend filter.',
    parameters: [
      {
        key: 'rsiPeriod',
        label: PARAM_LABELS.rsiPeriod,
        description: 'Wilder RSI lookback period.',
        kind: 'integer',
        minimum: 2,
        defaultValue: 10,
      },
      {
        key: 'rsiOversold',
        label: PARAM_LABELS.rsiOversold,
        description: 'RSI threshold for oversold entries.',
        kind: 'number',
        minimum: 0,
        maximum: 50,
        exclusiveMinimum: true,
        exclusiveMaximum: true,
        defaultValue: 30,
      },
      {
        key: 'rsiOverbought',
        label: PARAM_LABELS.rsiOverbought,
        description: 'RSI threshold for overbought entries.',
        kind: 'number',
        minimum: 50,
        maximum: 100,
        exclusiveMinimum: true,
        exclusiveMaximum: true,
        defaultValue: 70,
      },
      {
        key: 'bollingerPeriod',
        label: PARAM_LABELS.bollingerPeriod,
        description: 'Bollinger moving-average period.',
        kind: 'integer',
        minimum: 2,
        defaultValue: 14,
      },
      {
        key: 'bollingerStdDev',
        label: PARAM_LABELS.bollingerStdDev,
        description: 'Bollinger standard-deviation multiplier.',
        kind: 'number',
        minimum: 0,
        maximum: 5,
        exclusiveMinimum: true,
        defaultValue: 1.75,
      },
      {
        key: 'trendFilterPeriod',
        label: PARAM_LABELS.trendFilterPeriod,
        description: 'Trend moving-average period.',
        kind: 'integer',
        minimum: 3,
        defaultValue: 30,
      },
      {
        key: 'trendFilterThreshold',
        label: PARAM_LABELS.trendFilterThreshold,
        description: 'Maximum trend deviation allowed for countertrend entry.',
        kind: 'number',
        minimum: 0,
        maximum: 0.5,
        exclusiveMinimum: true,
        defaultValue: 0.05,
      },
      {
        key: 'leverage',
        label: PARAM_LABELS.leverage,
        description: 'Position leverage multiplier.',
        kind: 'number',
        minimum: 1,
        defaultValue: 3,
      },
      {
        key: 'stopLossPct',
        label: PARAM_LABELS.stopLossPct,
        description: 'Stop-loss distance as a decimal fraction.',
        kind: 'number',
        minimum: 0,
        maximum: 0.99,
        exclusiveMinimum: true,
        defaultValue: 0.05,
      },
      {
        key: 'positionPct',
        label: PARAM_LABELS.positionPct,
        description: 'Share of equity allocated to one position.',
        kind: 'number',
        minimum: 0,
        maximum: 1,
        exclusiveMinimum: true,
        defaultValue: 0.5,
      },
    ],
    example: {
      id: 'rsi-bollinger-001',
      name: 'RSI Bollinger 趋势过滤均值回归',
      archetype: 'rsi-bollinger-mean-reversion',
      params: {
        rsiPeriod: 10,
        rsiOversold: 30,
        rsiOverbought: 70,
        bollingerPeriod: 14,
        bollingerStdDev: 1.75,
        trendFilterPeriod: 30,
        trendFilterThreshold: 0.05,
        leverage: 3,
        stopLossPct: 0.05,
        positionPct: 0.5,
      },
      universe: ['BTCUSDT'],
      timeframe: '4h',
    },
  } satisfies StrategyDefinition<'rsi-bollinger-mean-reversion'>);

export const rsiBollingerAdapter:
  StrategyAdapter<'rsi-bollinger-mean-reversion'> = {
    archetype: 'rsi-bollinger-mean-reversion',
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

import type { DeathCause, StrategyParams } from '../contracts.ts';

export function targetedPatch(
  params: StrategyParams,
  causes: DeathCause[],
): {
  patch: Partial<StrategyParams>;
  rationale: string[];
} {
  const patch: Partial<StrategyParams> = {};
  const rationale: string[] = [];
  const uniqueCauses = new Set(causes);

  if (uniqueCauses.has('liquidation')) {
    patch.leverage = Math.max(1, Math.round(params.leverage / 2));
    patch.stopLossPct = Math.min(
      params.stopLossPct,
      Number((0.8 / patch.leverage / 2).toFixed(3)),
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

export function jitterParams(
  params: StrategyParams,
  random: () => number,
  fields: readonly (keyof StrategyParams)[] = [
    'fastMA',
    'slowMA',
    'leverage',
    'stopLossPct',
    'positionPct',
  ],
): StrategyParams {
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

export function diffParams(
  before: StrategyParams,
  after: StrategyParams,
): Partial<StrategyParams> {
  const changes: Partial<StrategyParams> = {};
  for (const key of Object.keys(after) as (keyof StrategyParams)[]) {
    if (before[key] !== after[key]) {
      changes[key] = after[key];
    }
  }
  return changes;
}

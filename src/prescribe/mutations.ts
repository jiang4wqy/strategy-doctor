import type { DeathCause, MaCrossParams } from '../contracts.ts';

export function targetedPatch(
  params: MaCrossParams,
  causes: DeathCause[],
): {
  patch: Partial<MaCrossParams>;
  rationale: string[];
} {
  const patch: Partial<MaCrossParams> = {};
  const rationale: string[] = [];
  const uniqueCauses = new Set(causes);

  if (uniqueCauses.has('liquidation')) {
    patch.leverage = Math.max(1, Math.round(params.leverage / 2));
    patch.stopLossPct = Math.min(
      params.stopLossPct,
      Number((0.8 / patch.leverage / 2).toFixed(3)),
    );
    rationale.push('Liquidation failure -> reduce leverage and move the stop inside half of the liquidation distance');
  }

  if (uniqueCauses.has('drawdown-breach')) {
    patch.positionPct = Number((params.positionPct * 0.7).toFixed(2));
    rationale.push('Drawdown breach -> reduce position exposure');
  }

  if (uniqueCauses.has('stop-loss-bleed')) {
    patch.fastMA = Math.round(params.fastMA * 1.5);
    patch.slowMA = Math.round(params.slowMA * 1.5);
    rationale.push('Repeated stop-loss bleed -> slow both moving averages by 1.5x to filter noise');
  }

  return { patch, rationale };
}

export function jitterParams(
  params: MaCrossParams,
  random: () => number,
  fields: readonly (keyof MaCrossParams)[] = [
    'fastMA',
    'slowMA',
    'leverage',
    'stopLossPct',
    'positionPct',
  ],
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

export function diffParams<P extends object>(
  before: P,
  after: P,
): Partial<P> {
  const changes: Partial<P> = {};
  for (const key of Object.keys(after) as (keyof P)[]) {
    if (before[key] !== after[key]) {
      changes[key] = after[key];
    }
  }
  return changes;
}

import type { Scenario } from '../contracts.ts';

export interface MacroSnapshot {
  sourceSkill: 'macro-analyst';
  symbol: string;
  observedAt: string;
  fedFundsUpperPct: number;
  fedFundsLowerPct: number;
  treasury2yPct: number;
  treasury10yPct: number;
  yieldSpread10y2yPct: number;
  breakeven10yPct: number;
  highYieldSpreadPct: number;
  dxy: number;
  vix: number;
  btc90dCorrelation: {
    dxy: number;
    nasdaq100: number;
    vix: number;
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireNumber(
  record: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number {
  const value = record[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${field} must be a finite number between ${min} and ${max}`);
  }
  return value;
}

export function parseMacroSnapshot(value: unknown): MacroSnapshot {
  const record = requireRecord(value, 'macro snapshot');
  const sourceSkill = requireString(record, 'sourceSkill');
  if (sourceSkill !== 'macro-analyst') {
    throw new TypeError('sourceSkill must be macro-analyst');
  }

  const observedAt = requireString(record, 'observedAt');
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new TypeError('observedAt must be a valid date-time');
  }

  const fedFundsUpperPct = requireNumber(record, 'fedFundsUpperPct', 0, 25);
  const fedFundsLowerPct = requireNumber(record, 'fedFundsLowerPct', 0, 25);
  if (fedFundsLowerPct > fedFundsUpperPct) {
    throw new RangeError('fedFundsLowerPct must not exceed fedFundsUpperPct');
  }

  const correlation = requireRecord(
    record.btc90dCorrelation,
    'btc90dCorrelation',
  );

  return {
    sourceSkill,
    symbol: requireString(record, 'symbol'),
    observedAt,
    fedFundsUpperPct,
    fedFundsLowerPct,
    treasury2yPct: requireNumber(record, 'treasury2yPct', -5, 25),
    treasury10yPct: requireNumber(record, 'treasury10yPct', -5, 25),
    yieldSpread10y2yPct: requireNumber(record, 'yieldSpread10y2yPct', -10, 10),
    breakeven10yPct: requireNumber(record, 'breakeven10yPct', -5, 20),
    highYieldSpreadPct: requireNumber(record, 'highYieldSpreadPct', 0, 50),
    dxy: requireNumber(record, 'dxy', 40, 200),
    vix: requireNumber(record, 'vix', 0, 100),
    btc90dCorrelation: {
      dxy: requireNumber(correlation, 'dxy', -1, 1),
      nasdaq100: requireNumber(correlation, 'nasdaq100', -1, 1),
      vix: requireNumber(correlation, 'vix', -1, 1),
    },
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function buildMacroScenario(snapshot: MacroSnapshot, seed: number): Scenario {
  const fundingPressure = clamp01((snapshot.fedFundsUpperPct - 1) / 9);
  const longRatePressure = clamp01((snapshot.treasury10yPct - 1.5) / 10.5);
  const inversionPressure = clamp01(-snapshot.yieldSpread10y2yPct / 2);
  const inflationPressure = clamp01((snapshot.breakeven10yPct - 1.8) / 4.2);
  const creditPressure = clamp01((snapshot.highYieldSpreadPct - 1.5) / 10.5);
  const dollarPressure = clamp01((snapshot.dxy - 85) / 45);
  const volatilityPressure = clamp01((snapshot.vix - 10) / 60);
  const risk = clamp01(
    fundingPressure * 0.15
    + longRatePressure * 0.15
    + inversionPressure * 0.1
    + inflationPressure * 0.1
    + creditPressure * 0.2
    + dollarPressure * 0.1
    + volatilityPressure * 0.2,
  );
  const kind = risk >= 0.6
    || snapshot.vix >= 35
    || snapshot.highYieldSpreadPct >= 6
    ? 'crash'
    : 'grind';

  return {
    id: `macro-${snapshot.symbol.toLowerCase()}-${seed}`,
    name: `Macro ${kind}: rates and liquidity pressure`,
    dimension: 'macro',
    sourceSkill: 'macro-analyst',
    sourceObservedAt: snapshot.observedAt,
    narrative: `联邦基金利率 ${snapshot.fedFundsLowerPct.toFixed(2)}%-${snapshot.fedFundsUpperPct.toFixed(2)}%，10Y 美债收益率 ${snapshot.treasury10yPct.toFixed(2)}%，高收益债利差 ${snapshot.highYieldSpreadPct.toFixed(2)}%，DXY ${snapshot.dxy.toFixed(2)}，VIX ${snapshot.vix.toFixed(2)}；这些信号映射为确定性的 ${kind} 压力路径。`,
    severity: 1 + Math.round(risk * 4),
    shock: {
      kind,
      magnitude: round6(0.08 + risk * 0.32),
      durationBars: kind === 'crash'
        ? 24 + Math.round(risk * 48)
        : 96 + Math.round(risk * 96),
      volMult: round6(1 + risk * 2),
      seed,
    },
  };
}

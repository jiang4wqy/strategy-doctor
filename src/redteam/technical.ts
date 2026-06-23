import type { Scenario } from '../contracts.ts';

export interface TechnicalSnapshot {
  sourceSkill: 'technical-analysis';
  symbol: string;
  timeframe: string;
  observedAt: string;
  candlesCount: number;
  adx: number;
  diPlus: number;
  diMinus: number;
  dmiCrosses20: number;
  bollBandwidth: number;
  rsi: number;
  rsiCenterCrosses20: number;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('technical snapshot must be an object');
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

function requireInteger(
  record: Record<string, unknown>,
  field: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const value = requireNumber(record, field, min, max);
  if (!Number.isInteger(value)) {
    throw new TypeError(`${field} must be an integer`);
  }
  return value;
}

export function parseTechnicalSnapshot(value: unknown): TechnicalSnapshot {
  const record = requireRecord(value);
  const sourceSkill = requireString(record, 'sourceSkill');
  if (sourceSkill !== 'technical-analysis') {
    throw new TypeError('sourceSkill must be technical-analysis');
  }

  const observedAt = requireString(record, 'observedAt');
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new TypeError('observedAt must be a valid date-time');
  }

  return {
    sourceSkill,
    symbol: requireString(record, 'symbol'),
    timeframe: requireString(record, 'timeframe'),
    observedAt,
    candlesCount: requireInteger(record, 'candlesCount', 20),
    adx: requireNumber(record, 'adx', 0, 100),
    diPlus: requireNumber(record, 'diPlus', 0, 100),
    diMinus: requireNumber(record, 'diMinus', 0, 100),
    dmiCrosses20: requireInteger(record, 'dmiCrosses20', 0, 19),
    bollBandwidth: requireNumber(record, 'bollBandwidth', 0, 1),
    rsi: requireNumber(record, 'rsi', 0, 100),
    rsiCenterCrosses20: requireInteger(record, 'rsiCenterCrosses20', 0, 19),
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function buildTechnicalScenario(
  snapshot: TechnicalSnapshot,
  seed: number,
): Scenario {
  const trendFragility = clamp01((50 - snapshot.adx) / 50);
  const directionConflict = 1 - clamp01(
    Math.abs(snapshot.diPlus - snapshot.diMinus) / 50,
  );
  const switching = (
    clamp01(snapshot.dmiCrosses20 / 6)
    + clamp01(snapshot.rsiCenterCrosses20 / 8)
  ) / 2;
  const bandCompression = clamp01((0.08 - snapshot.bollBandwidth) / 0.06);
  const risk = clamp01(
    trendFragility * 0.35
    + directionConflict * 0.25
    + switching * 0.25
    + bandCompression * 0.15,
  );

  return {
    id: `technical-${snapshot.symbol.toLowerCase()}-${snapshot.timeframe}-${seed}`,
    name: 'Technical whipsaw: false-breakout grinder',
    dimension: 'technical',
    sourceSkill: 'technical-analysis',
    sourceObservedAt: snapshot.observedAt,
    narrative: `ADX ${snapshot.adx.toFixed(1)}, ${snapshot.dmiCrosses20} DMI switches over the last 20 candles, ${snapshot.rsiCenterCrosses20} RSI midline crosses, and Bollinger bandwidth ${(snapshot.bollBandwidth * 100).toFixed(1)}%. The scenario creates repeated false breakouts to test chase-and-reversal losses in trend strategies.`,
    severity: 1 + Math.round(risk * 4),
    shock: {
      kind: 'whipsaw',
      magnitude: round6(0.15 + risk * 0.25),
      durationBars: 40 + Math.round(risk * 60),
      volMult: round6(1 + risk),
      seed,
    },
  };
}

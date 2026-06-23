import type { Scenario } from '../contracts.ts';

export interface SentimentSnapshot {
  sourceSkill: 'sentiment-analyst';
  symbol: string;
  observedAt: string;
  fearGreed: number;
  retailLongShare: number;
  topTraderLongShare: number;
  takerBuySellRatio: number;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('sentiment snapshot must be an object');
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

export function parseSentimentSnapshot(value: unknown): SentimentSnapshot {
  const record = requireRecord(value);
  const sourceSkill = requireString(record, 'sourceSkill');
  if (sourceSkill !== 'sentiment-analyst') {
    throw new TypeError('sourceSkill must be sentiment-analyst');
  }

  const observedAt = requireString(record, 'observedAt');
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new TypeError('observedAt must be a valid date-time');
  }

  return {
    sourceSkill,
    symbol: requireString(record, 'symbol'),
    observedAt,
    fearGreed: requireNumber(record, 'fearGreed', 0, 100),
    retailLongShare: requireNumber(record, 'retailLongShare', 0, 1),
    topTraderLongShare: requireNumber(record, 'topTraderLongShare', 0, 1),
    takerBuySellRatio: requireNumber(record, 'takerBuySellRatio', 0, 1),
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function buildSentimentScenario(snapshot: SentimentSnapshot, seed: number): Scenario {
  const crowdLongShare = (snapshot.retailLongShare + snapshot.topTraderLongShare) / 2;
  const crowding = Math.max(
    Math.abs(snapshot.retailLongShare - 0.5),
    Math.abs(snapshot.topTraderLongShare - 0.5),
  ) * 2;
  const moodExtremity = Math.abs(snapshot.fearGreed - 50) / 50;
  const longsCrowded = crowdLongShare >= 0.5;
  const opposingPressure = longsCrowded
    ? Math.max(0, (0.5 - snapshot.takerBuySellRatio) * 2)
    : Math.max(0, (snapshot.takerBuySellRatio - 0.5) * 2);
  const risk = clamp01(crowding * 0.45 + moodExtremity * 0.35 + opposingPressure * 0.2);
  const crowdedSide = longsCrowded ? 'long crowding' : 'short crowding';
  const reversal = longsCrowded
    ? 'a squeeze upward that traps late longs before a fast selloff'
    : 'a flush downward that traps late shorts before a fast rebound';

  return {
    id: `sentiment-${snapshot.symbol.toLowerCase()}-${seed}`,
    name: `Sentiment squeeze: ${crowdedSide}`,
    dimension: 'sentiment',
    sourceSkill: 'sentiment-analyst',
    sourceObservedAt: snapshot.observedAt,
    narrative: `${crowdedSide}; fear-greed index ${snapshot.fearGreed}; taker buy share ${(snapshot.takerBuySellRatio * 100).toFixed(1)}%. The scenario simulates ${reversal}, testing liquidation risk in leveraged trend strategies.`,
    severity: 1 + Math.round(risk * 4),
    shock: {
      kind: 'squeeze',
      magnitude: round6(0.15 + risk * 0.3),
      durationBars: 24 + Math.round(risk * 48),
      volMult: round6(1.5 + risk * 1.5),
      seed,
    },
  };
}

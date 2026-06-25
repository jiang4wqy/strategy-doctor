import type { Scenario } from '../contracts.ts';

export interface MarketIntelSnapshot {
  sourceSkill: 'market-intel';
  symbol: string;
  observedAt: string;
  globalMarketCapUsd: number;
  btcDominancePct: number;
  marketCapChange24hPct: number;
  stablecoinSupplyUsd: number;
  stablecoinChange1dPct: number;
  stablecoinChange7dPct: number;
  stablecoinChange30dPct: number;
  topTraderLongShare: number;
  openInterestStartBtc: number;
  openInterestEndBtc: number;
  openInterestChangePct: number;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('market intelligence snapshot must be an object');
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

export function parseMarketIntelSnapshot(value: unknown): MarketIntelSnapshot {
  const record = requireRecord(value);
  const sourceSkill = requireString(record, 'sourceSkill');
  if (sourceSkill !== 'market-intel') {
    throw new TypeError('sourceSkill must be market-intel');
  }

  const observedAt = requireString(record, 'observedAt');
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new TypeError('observedAt must be a valid date-time');
  }

  return {
    sourceSkill,
    symbol: requireString(record, 'symbol'),
    observedAt,
    globalMarketCapUsd: requireNumber(record, 'globalMarketCapUsd', 1, 1e16),
    btcDominancePct: requireNumber(record, 'btcDominancePct', 0, 100),
    marketCapChange24hPct: requireNumber(record, 'marketCapChange24hPct', -100, 100),
    stablecoinSupplyUsd: requireNumber(record, 'stablecoinSupplyUsd', 1, 1e15),
    stablecoinChange1dPct: requireNumber(record, 'stablecoinChange1dPct', -100, 100),
    stablecoinChange7dPct: requireNumber(record, 'stablecoinChange7dPct', -100, 100),
    stablecoinChange30dPct: requireNumber(record, 'stablecoinChange30dPct', -100, 100),
    topTraderLongShare: requireNumber(record, 'topTraderLongShare', 0, 1),
    openInterestStartBtc: requireNumber(record, 'openInterestStartBtc', 1, 1e9),
    openInterestEndBtc: requireNumber(record, 'openInterestEndBtc', 1, 1e9),
    openInterestChangePct: requireNumber(record, 'openInterestChangePct', -100, 100),
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function buildMarketIntelScenario(
  snapshot: MarketIntelSnapshot,
  seed: number,
): Scenario {
  const marketLoss = clamp01(-snapshot.marketCapChange24hPct / 20);
  const stablecoinContraction = (
    clamp01(-snapshot.stablecoinChange1dPct / 10)
    + clamp01(-snapshot.stablecoinChange7dPct / 20)
    + clamp01(-snapshot.stablecoinChange30dPct / 30)
  ) / 3;
  const openInterestStress = clamp01(-snapshot.openInterestChangePct / 30);
  const crowding = clamp01(Math.abs(snapshot.topTraderLongShare - 0.5) * 2);
  const concentration = clamp01((snapshot.btcDominancePct - 45) / 30);
  const risk = clamp01(
    marketLoss * 0.3
    + stablecoinContraction * 0.25
    + openInterestStress * 0.2
    + crowding * 0.15
    + concentration * 0.1,
  );

  return {
    id: `market-intel-${snapshot.symbol.toLowerCase()}-${seed}`,
    name: 'Market structure liquidity crash',
    dimension: 'market-intel',
    sourceSkill: 'market-intel',
    sourceObservedAt: snapshot.observedAt,
    narrative: `Crypto market cap changed ${snapshot.marketCapChange24hPct.toFixed(2)}% over 24h, stablecoin supply changed ${snapshot.stablecoinChange30dPct.toFixed(2)}% over 30d, BTC open interest changed ${snapshot.openInterestChangePct.toFixed(2)}%, and top-trader long share is ${(snapshot.topTraderLongShare * 100).toFixed(1)}%.`,
    severity: 1 + Math.round(risk * 4),
    shock: {
      kind: 'crash',
      magnitude: round6(0.12 + risk * 0.28),
      durationBars: 18 + Math.round(risk * 54),
      volMult: round6(1.2 + risk * 1.8),
      seed,
    },
  };
}

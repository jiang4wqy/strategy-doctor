import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarketIntelScenario,
  parseMarketIntelSnapshot,
  type MarketIntelSnapshot,
} from '../../src/redteam/market-intel.ts';

const validSnapshot: MarketIntelSnapshot = {
  sourceSkill: 'market-intel',
  symbol: 'BTCUSDT',
  observedAt: '2026-06-13T03:27:49.7341566Z',
  globalMarketCapUsd: 2_260_390_169_701.0386,
  btcDominancePct: 56.439481,
  marketCapChange24hPct: 0.102495,
  stablecoinSupplyUsd: 314_229_249_865.7503,
  stablecoinChange1dPct: 0.135154,
  stablecoinChange7dPct: -0.275908,
  stablecoinChange30dPct: -1.886184,
  topTraderLongShare: 0.5445,
  openInterestStartBtc: 98_217.07,
  openInterestEndBtc: 98_278.776,
  openInterestChangePct: 0.062826,
};

test('parseMarketIntelSnapshot accepts a valid normalized snapshot', () => {
  assert.deepEqual(parseMarketIntelSnapshot(validSnapshot), validSnapshot);
});

test('parseMarketIntelSnapshot rejects missing fields and invalid source skill', () => {
  const { globalMarketCapUsd: _marketCap, ...missingMarketCap } = validSnapshot;
  assert.throws(() => parseMarketIntelSnapshot(missingMarketCap), /globalMarketCapUsd/);
  assert.throws(
    () => parseMarketIntelSnapshot({ ...validSnapshot, sourceSkill: 'macro-analyst' }),
    /sourceSkill/,
  );
});

test('parseMarketIntelSnapshot rejects invalid dates and numeric ranges', () => {
  assert.throws(
    () => parseMarketIntelSnapshot({ ...validSnapshot, observedAt: 'invalid' }),
    /observedAt/,
  );
  assert.throws(
    () => parseMarketIntelSnapshot({ ...validSnapshot, stablecoinSupplyUsd: Number.POSITIVE_INFINITY }),
    /stablecoinSupplyUsd/,
  );
  assert.throws(
    () => parseMarketIntelSnapshot({ ...validSnapshot, btcDominancePct: 101 }),
    /btcDominancePct/,
  );
  assert.throws(
    () => parseMarketIntelSnapshot({ ...validSnapshot, topTraderLongShare: -0.01 }),
    /topTraderLongShare/,
  );
});

test('buildMarketIntelScenario is deterministic and emits a bounded crash', () => {
  const first = buildMarketIntelScenario(validSnapshot, 99);
  const second = buildMarketIntelScenario(validSnapshot, 99);

  assert.deepEqual(first, second);
  assert.equal(first.dimension, 'market-intel');
  assert.equal(first.sourceSkill, 'market-intel');
  assert.equal(first.shock.kind, 'crash');
  assert.equal(first.shock.seed, 99);
  assert.ok(first.severity >= 1 && first.severity <= 5);
  assert.ok(first.shock.magnitude >= 0.12 && first.shock.magnitude <= 0.4);
  assert.ok(first.shock.durationBars >= 18 && first.shock.durationBars <= 72);
  assert.ok(first.shock.volMult >= 1.2 && first.shock.volMult <= 3);
});

test('buildMarketIntelScenario increases stress for shrinking liquidity and leverage', () => {
  const healthy = buildMarketIntelScenario({
    ...validSnapshot,
    marketCapChange24hPct: 10,
    stablecoinChange1dPct: 3,
    stablecoinChange7dPct: 8,
    stablecoinChange30dPct: 15,
    topTraderLongShare: 0.5,
    openInterestChangePct: 10,
    btcDominancePct: 45,
  }, 3);
  const stressed = buildMarketIntelScenario({
    ...validSnapshot,
    marketCapChange24hPct: -20,
    stablecoinChange1dPct: -10,
    stablecoinChange7dPct: -20,
    stablecoinChange30dPct: -30,
    topTraderLongShare: 0.9,
    openInterestChangePct: -30,
    btcDominancePct: 75,
  }, 3);

  assert.ok(stressed.severity > healthy.severity);
  assert.ok(stressed.shock.magnitude > healthy.shock.magnitude);
  assert.ok(stressed.shock.volMult > healthy.shock.volMult);
});

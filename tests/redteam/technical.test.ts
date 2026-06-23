import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTechnicalScenario,
  parseTechnicalSnapshot,
  type TechnicalSnapshot,
} from '../../src/redteam/technical.ts';

const validSnapshot: TechnicalSnapshot = {
  sourceSkill: 'technical-analysis',
  symbol: 'BTCUSDT',
  timeframe: '4h',
  observedAt: '2026-06-12T14:40:55.521890Z',
  candlesCount: 200,
  adx: 26.850877,
  diPlus: 25.415234,
  diMinus: 12.03064,
  dmiCrosses20: 2,
  bollBandwidth: 0.056969,
  rsi: 55.966743,
  rsiCenterCrosses20: 3,
};

test('parseTechnicalSnapshot accepts a valid indicator summary', () => {
  assert.deepEqual(parseTechnicalSnapshot(validSnapshot), validSnapshot);
});

test('parseTechnicalSnapshot rejects missing fields and invalid source skill', () => {
  const { adx: _adx, ...missingAdx } = validSnapshot;
  assert.throws(() => parseTechnicalSnapshot(missingAdx), /adx/);
  assert.throws(
    () => parseTechnicalSnapshot({
      ...validSnapshot,
      sourceSkill: 'sentiment-analyst',
    }),
    /sourceSkill/,
  );
});

test('parseTechnicalSnapshot rejects invalid time and numeric ranges', () => {
  assert.throws(
    () => parseTechnicalSnapshot({ ...validSnapshot, observedAt: 'invalid' }),
    /observedAt/,
  );
  assert.throws(
    () => parseTechnicalSnapshot({ ...validSnapshot, candlesCount: 19 }),
    /candlesCount/,
  );
  assert.throws(
    () => parseTechnicalSnapshot({ ...validSnapshot, adx: 101 }),
    /adx/,
  );
  assert.throws(
    () => parseTechnicalSnapshot({ ...validSnapshot, bollBandwidth: -0.01 }),
    /bollBandwidth/,
  );
  assert.throws(
    () => parseTechnicalSnapshot({ ...validSnapshot, rsi: Number.NaN }),
    /rsi/,
  );
  assert.throws(
    () => parseTechnicalSnapshot({ ...validSnapshot, dmiCrosses20: 20 }),
    /dmiCrosses20/,
  );
});

test('buildTechnicalScenario is deterministic and emits a bounded whipsaw shock', () => {
  const first = buildTechnicalScenario(validSnapshot, 99);
  const second = buildTechnicalScenario(validSnapshot, 99);

  assert.deepEqual(first, second);
  assert.equal(first.dimension, 'technical');
  assert.equal(first.sourceSkill, 'technical-analysis');
  assert.equal(first.shock.kind, 'whipsaw');
  assert.equal(first.shock.seed, 99);
  assert.ok(first.severity >= 1 && first.severity <= 5);
  assert.ok(first.shock.magnitude >= 0.15 && first.shock.magnitude <= 0.4);
  assert.ok(first.shock.durationBars >= 40 && first.shock.durationBars <= 100);
  assert.ok(first.shock.volMult >= 1 && first.shock.volMult <= 2);
  assert.match(first.narrative, /false breakouts/);
});

test('buildTechnicalScenario maps stable trend and maximum chop to endpoints', () => {
  const stableTrend = buildTechnicalScenario({
    ...validSnapshot,
    adx: 50,
    diPlus: 50,
    diMinus: 0,
    dmiCrosses20: 0,
    bollBandwidth: 0.08,
    rsiCenterCrosses20: 0,
  }, 1);
  const maximumChop = buildTechnicalScenario({
    ...validSnapshot,
    adx: 0,
    diPlus: 20,
    diMinus: 20,
    dmiCrosses20: 19,
    bollBandwidth: 0.02,
    rsiCenterCrosses20: 19,
  }, 1);

  assert.equal(stableTrend.severity, 1);
  assert.equal(stableTrend.shock.magnitude, 0.15);
  assert.equal(stableTrend.shock.durationBars, 40);
  assert.equal(stableTrend.shock.volMult, 1);
  assert.equal(maximumChop.severity, 5);
  assert.equal(maximumChop.shock.magnitude, 0.4);
  assert.equal(maximumChop.shock.durationBars, 100);
  assert.equal(maximumChop.shock.volMult, 2);
});

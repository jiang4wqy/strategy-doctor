import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMacroScenario,
  parseMacroSnapshot,
  type MacroSnapshot,
} from '../../src/redteam/macro.ts';

const validSnapshot: MacroSnapshot = {
  sourceSkill: 'macro-analyst',
  symbol: 'BTCUSDT',
  observedAt: '2026-06-13T03:27:49.7341566Z',
  fedFundsUpperPct: 3.75,
  fedFundsLowerPct: 3.5,
  treasury2yPct: 4.05,
  treasury10yPct: 4.45,
  yieldSpread10y2yPct: 0.39,
  breakeven10yPct: 2.31,
  highYieldSpreadPct: 2.78,
  dxy: 99.806999,
  vix: 17.68,
  btc90dCorrelation: {
    dxy: -0.2114,
    nasdaq100: 0.4745,
    vix: -0.447,
  },
};

test('parseMacroSnapshot accepts a valid normalized snapshot', () => {
  assert.deepEqual(parseMacroSnapshot(validSnapshot), validSnapshot);
});

test('parseMacroSnapshot rejects missing fields and invalid source skill', () => {
  const { vix: _vix, ...missingVix } = validSnapshot;
  assert.throws(() => parseMacroSnapshot(missingVix), /vix/);
  assert.throws(
    () => parseMacroSnapshot({ ...validSnapshot, sourceSkill: 'market-intel' }),
    /sourceSkill/,
  );
});

test('parseMacroSnapshot rejects invalid dates and non-finite or out-of-range values', () => {
  assert.throws(
    () => parseMacroSnapshot({ ...validSnapshot, observedAt: 'invalid' }),
    /observedAt/,
  );
  assert.throws(
    () => parseMacroSnapshot({ ...validSnapshot, vix: Number.NaN }),
    /vix/,
  );
  assert.throws(
    () => parseMacroSnapshot({
      ...validSnapshot,
      btc90dCorrelation: { ...validSnapshot.btc90dCorrelation, dxy: -1.01 },
    }),
    /dxy/,
  );
  assert.throws(
    () => parseMacroSnapshot({
      ...validSnapshot,
      fedFundsLowerPct: 4,
      fedFundsUpperPct: 3.75,
    }),
    /fedFundsLowerPct/,
  );
});

test('buildMacroScenario is deterministic and emits a bounded grind or crash', () => {
  const first = buildMacroScenario(validSnapshot, 42);
  const second = buildMacroScenario(validSnapshot, 42);

  assert.deepEqual(first, second);
  assert.equal(first.dimension, 'macro');
  assert.equal(first.sourceSkill, 'macro-analyst');
  assert.ok(first.shock.kind === 'grind' || first.shock.kind === 'crash');
  assert.equal(first.shock.seed, 42);
  assert.ok(first.severity >= 1 && first.severity <= 5);
  assert.ok(first.shock.magnitude >= 0.08 && first.shock.magnitude <= 0.4);
  assert.ok(first.shock.durationBars >= 24 && first.shock.durationBars <= 192);
  assert.ok(first.shock.volMult >= 1 && first.shock.volMult <= 3);
});

test('buildMacroScenario maps low stress to grind and severe stress to crash', () => {
  const calm = buildMacroScenario({
    ...validSnapshot,
    fedFundsUpperPct: 1,
    fedFundsLowerPct: 0.75,
    treasury2yPct: 1,
    treasury10yPct: 1.5,
    yieldSpread10y2yPct: 0.5,
    breakeven10yPct: 1.8,
    highYieldSpreadPct: 1.5,
    dxy: 85,
    vix: 10,
  }, 7);
  const severe = buildMacroScenario({
    ...validSnapshot,
    fedFundsUpperPct: 10,
    fedFundsLowerPct: 9.75,
    treasury2yPct: 10,
    treasury10yPct: 12,
    yieldSpread10y2yPct: -2,
    breakeven10yPct: 6,
    highYieldSpreadPct: 12,
    dxy: 130,
    vix: 70,
  }, 7);

  assert.equal(calm.shock.kind, 'grind');
  assert.equal(severe.shock.kind, 'crash');
  assert.ok(severe.severity > calm.severity);
  assert.ok(severe.shock.magnitude > calm.shock.magnitude);
});

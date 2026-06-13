import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/backtest/path.ts';
import type { MaCrossParams } from '../../src/contracts.ts';
import {
  diffParams,
  jitterParams,
  targetedPatch,
} from '../../src/prescribe/mutations.ts';

const base: MaCrossParams = {
  fastMA: 8,
  slowMA: 30,
  leverage: 10,
  stopLossPct: 0.5,
  positionPct: 1,
};

test('liquidation halves leverage and moves stop loss inside half the liquidation line', () => {
  const { patch, rationale } = targetedPatch(base, ['liquidation']);

  assert.equal(patch.leverage, 5);
  assert.ok(patch.stopLossPct! <= 0.8 / 5 / 2);
  assert.ok(rationale.some(reason => reason.includes('杠杆')));
});

test('drawdown breach reduces position size by thirty percent', () => {
  const { patch } = targetedPatch(base, ['drawdown-breach']);
  assert.equal(patch.positionPct, 0.7);
});

test('stop-loss bleed slows both moving averages', () => {
  const { patch } = targetedPatch(base, ['stop-loss-bleed']);
  assert.equal(patch.fastMA, 12);
  assert.equal(patch.slowMA, 45);
});

test('multiple death causes combine their targeted patches', () => {
  const { patch } = targetedPatch(
    base,
    ['liquidation', 'drawdown-breach', 'stop-loss-bleed'],
  );

  assert.equal(patch.leverage, 5);
  assert.equal(patch.positionPct, 0.7);
  assert.equal(patch.fastMA, 12);
  assert.equal(patch.slowMA, 45);
});

test('survived results do not produce a patch', () => {
  assert.deepEqual(targetedPatch(base, ['survived']), {
    patch: {},
    rationale: [],
  });
});

test('jitterParams is deterministic and preserves parameter invariants', () => {
  const first = jitterParams(base, mulberry32(7));
  const second = jitterParams(base, mulberry32(7));

  assert.deepEqual(first, second);
  assert.ok(first.fastMA >= 2);
  assert.ok(first.slowMA > first.fastMA);
  assert.ok(first.leverage >= 1);
  assert.ok(first.stopLossPct > 0 && first.stopLossPct < 1);
  assert.ok(first.positionPct > 0 && first.positionPct <= 1);
});

test('jitterParams can restrict search to death-related parameters', () => {
  const jittered = jitterParams(base, mulberry32(7), [
    'leverage',
    'stopLossPct',
  ]);

  assert.equal(jittered.fastMA, base.fastMA);
  assert.equal(jittered.slowMA, base.slowMA);
  assert.equal(jittered.positionPct, base.positionPct);
});

test('diffParams reports only changed values', () => {
  assert.deepEqual(
    diffParams(base, { ...base, leverage: 5 }),
    { leverage: 5 },
  );
});

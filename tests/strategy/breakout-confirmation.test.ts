import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/backtest/path.ts';
import type { BreakoutConfirmationParams } from '../../src/contracts.ts';
import {
  breakoutConfirmationAdapter,
} from '../../src/strategy/adapters/breakout-confirmation.ts';

const params: BreakoutConfirmationParams = {
  breakoutLookback: 5,
  confirmationBars: 2,
  exitLookback: 3,
  volatilityLookback: 3,
  minBreakoutPct: 0.01,
  minVolatilityPct: 0.001,
  leverage: 4,
  stopLossPct: 0.08,
  positionPct: 0.55,
};

test('breakout confirmation adapter validates parameter invariants', () => {
  assert.deepEqual(breakoutConfirmationAdapter.parseParams(params), params);

  for (const patch of [
    { breakoutLookback: 4 },
    { confirmationBars: 0 },
    { exitLookback: 5 },
    { volatilityLookback: 2 },
    { minBreakoutPct: 0 },
    { minBreakoutPct: 0.3 },
    { minVolatilityPct: -0.01 },
    { minVolatilityPct: 0.3 },
    { leverage: 0 },
    { stopLossPct: 0 },
    { positionPct: 1.1 },
  ]) {
    assert.throws(
      () => breakoutConfirmationAdapter.parseParams({ ...params, ...patch }),
      /invalid strategy/i,
    );
  }
});

test('breakout confirmation waits for confirmed range expansion', () => {
  const prices = [
    100, 100.2, 100.1, 100.3, 100.2,
    100.1, 101.8, 102.2,
  ];

  assert.equal(breakoutConfirmationAdapter.decide(params, {
    prices,
    index: 6,
    position: 0,
    entryPrice: 0,
  }), 'hold');
  assert.equal(breakoutConfirmationAdapter.decide(params, {
    prices,
    index: 7,
    position: 0,
    entryPrice: 0,
  }), 'long');
});

test('breakout confirmation supports short breakouts and invalidation exits', () => {
  const prices = [
    100, 99.8, 100.1, 99.9, 100,
    99.7, 98.5, 98.2, 99.8,
  ];

  assert.equal(breakoutConfirmationAdapter.decide(params, {
    prices,
    index: 7,
    position: 0,
    entryPrice: 0,
  }), 'short');
  assert.equal(breakoutConfirmationAdapter.decide(params, {
    prices,
    index: 8,
    position: -1,
    entryPrice: 98.2,
  }), 'flat');
});

test('breakout confirmation exposes scoped prescription policy', () => {
  assert.deepEqual(
    breakoutConfirmationAdapter.targetedFields(
      new Set(['liquidation', 'stop-loss-bleed']),
    ),
    [
      'leverage',
      'stopLossPct',
      'breakoutLookback',
      'confirmationBars',
      'minBreakoutPct',
      'minVolatilityPct',
    ],
  );

  const patch = breakoutConfirmationAdapter.targetedPatch(params, [
    'liquidation',
    'drawdown-breach',
    'stop-loss-bleed',
  ]);
  assert.deepEqual(patch.patch, {
    leverage: 2,
    stopLossPct: 0.08,
    positionPct: 0.39,
    exitLookback: 2,
    breakoutLookback: 6,
    confirmationBars: 3,
    minBreakoutPct: 0.0125,
    minVolatilityPct: 0.0011,
  });
  assert.equal(
    breakoutConfirmationAdapter.paramLabel('minBreakoutPct'),
    'Minimum breakout',
  );

  const first = breakoutConfirmationAdapter.jitterParams(
    params,
    mulberry32(42),
    ['breakoutLookback', 'exitLookback', 'minBreakoutPct', 'leverage'],
  );
  const second = breakoutConfirmationAdapter.jitterParams(
    params,
    mulberry32(42),
    ['breakoutLookback', 'exitLookback', 'minBreakoutPct', 'leverage'],
  );
  assert.deepEqual(first, second);
  assert.doesNotThrow(() => breakoutConfirmationAdapter.parseParams(first));
  assert.equal(first.confirmationBars, params.confirmationBars);
});

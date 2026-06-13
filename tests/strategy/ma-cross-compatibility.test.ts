import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/backtest/path.ts';
import type {
  DeathCause,
  MaCrossParams,
} from '../../src/contracts.ts';
import {
  jitterParams as legacyJitterParams,
  targetedPatch as legacyTargetedPatch,
} from '../../src/prescribe/mutations.ts';
import { maCrossAdapter } from '../../src/strategy/adapters/ma-cross.ts';

const params: MaCrossParams = {
  fastMA: 8,
  slowMA: 30,
  leverage: 10,
  stopLossPct: 0.5,
  positionPct: 1,
};

test('MA adapter policy matches the legacy prescription policy during migration', () => {
  const causeSets: DeathCause[][] = [
    ['survived'],
    ['liquidation'],
    ['drawdown-breach'],
    ['stop-loss-bleed'],
    ['liquidation', 'drawdown-breach', 'stop-loss-bleed'],
  ];

  for (const causes of causeSets) {
    assert.deepEqual(
      maCrossAdapter.targetedPatch(params, causes),
      legacyTargetedPatch(params, causes),
    );
  }

  const fieldSets: (keyof MaCrossParams)[][] = [
    ['leverage', 'stopLossPct'],
    ['positionPct'],
    ['fastMA', 'slowMA'],
    ['fastMA', 'slowMA', 'leverage', 'stopLossPct', 'positionPct'],
  ];

  for (const fields of fieldSets) {
    assert.deepEqual(
      maCrossAdapter.jitterParams(params, mulberry32(17), fields),
      legacyJitterParams(params, mulberry32(17), fields),
    );
  }
});

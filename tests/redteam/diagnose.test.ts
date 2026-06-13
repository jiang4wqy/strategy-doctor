import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDeath } from '../../src/redteam/diagnose.ts';
import type { Metrics } from '../../src/contracts.ts';

const metrics = (overrides: Partial<Metrics>): Metrics => ({
  pnlPct: 0,
  maxDrawdownPct: 0,
  liquidated: false,
  numTrades: 1,
  equityCurve: [1],
  ...overrides,
});

test('classifyDeath prioritizes liquidation', () => {
  assert.equal(
    classifyDeath(metrics({
      liquidated: true,
      maxDrawdownPct: 0.9,
      pnlPct: -0.9,
      numTrades: 20,
    })),
    'liquidation',
  );
});

test('classifyDeath detects a drawdown breach', () => {
  assert.equal(
    classifyDeath(metrics({ maxDrawdownPct: 0.55 })),
    'drawdown-breach',
  );
});

test('classifyDeath detects repeated stop-loss bleed', () => {
  assert.equal(
    classifyDeath(metrics({
      pnlPct: -0.2,
      maxDrawdownPct: 0.25,
      numTrades: 9,
    })),
    'stop-loss-bleed',
  );
});

test('classifyDeath returns survived for limited damage', () => {
  assert.equal(
    classifyDeath(metrics({
      pnlPct: -0.05,
      maxDrawdownPct: 0.1,
      numTrades: 3,
    })),
    'survived',
  );
});

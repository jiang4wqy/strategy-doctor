import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFactorLibrary,
  getMultiFactorFramework,
  getNotebookCatalog,
} from '../../src/research/factor-library.ts';
import { trackPaperSignal } from '../../src/research/paper-signal.ts';
import type { Strategy } from '../../src/contracts.ts';

const strategy = {
  id: 'paper-ma',
  name: 'Paper MA',
  archetype: 'ma-cross',
  params: {
    fastMA: 2,
    slowMA: 4,
    leverage: 2,
    stopLossPct: 0.1,
    positionPct: 0.5,
  },
  execution: {
    feeRatePct: 0.001,
    slippagePct: 0.001,
  },
  universe: ['BTCUSDT'],
  timeframe: '1h',
} satisfies Strategy;

test('factor library exposes auditable factor groups', () => {
  const library = getFactorLibrary();

  assert.ok(library.factors.length >= 8);
  assert.ok(library.factors.some(factor => factor.group === 'sentiment'));
  assert.equal(library.frameworkVersion, 'factor-library-v1');
});

test('notebook catalog and multi-factor framework are reviewer-ready', () => {
  const notebooks = getNotebookCatalog();
  const framework = getMultiFactorFramework();

  assert.ok(notebooks.templates.some(template => template.id === 'multi-factor-review'));
  assert.ok(framework.factorGroups.includes('liquidity'));
  assert.ok(framework.outputs.includes('strategy model review'));
});

test('paper signal tracker returns read-only execution state', () => {
  const signal = trackPaperSignal({
    strategy,
    prices: [100, 101, 102, 103, 104, 105],
  }, '2026-06-23T00:00:00.000Z');

  assert.equal(signal.strategyId, 'paper-ma');
  assert.equal(signal.symbol, 'BTCUSDT');
  assert.ok(['long', 'short', 'flat', 'hold'].includes(signal.latestSignal));
  assert.ok(signal.paperEquity > 0);
  assert.ok(signal.notes.every(note => !note.toLowerCase().includes('order placed')));
});

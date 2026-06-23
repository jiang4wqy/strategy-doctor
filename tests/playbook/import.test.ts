import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StrategyDraft } from '../../src/platform/contracts.ts';
import {
  importPlaybookStrategy,
  PlaybookImportError,
} from '../../src/playbook/import.ts';

const strategy = {
  id: 'pb-ma-cross',
  name: 'Playbook MA Cross',
  archetype: 'ma-cross' as const,
  params: {
    fastMA: 8,
    slowMA: 30,
    leverage: 10,
    stopLossPct: 0.5,
    positionPct: 1,
  },
  universe: ['BTCUSDT'],
  timeframe: '1h' as const,
};

const draft: StrategyDraft = {
  strategy,
  source: 'rules',
  confidence: 0.9,
  assumptions: [],
  warnings: [],
};

test('imports a structured Playbook strategy without calling the parser', async () => {
  const parsed = await importPlaybookStrategy({
    playbookId: 'agent-001',
    name: 'Trend Defense Agent',
    strategy,
  }, async () => {
    throw new Error('parser should not run for structured strategies');
  });

  assert.equal(parsed.source, 'strategy-json');
  assert.equal(parsed.playbookId, 'agent-001');
  assert.equal(parsed.playbookName, 'Trend Defense Agent');
  assert.equal(parsed.strategy.archetype, 'ma-cross');
});

test('imports a stringified nested Playbook strategy payload', async () => {
  const parsed = await importPlaybookStrategy({
    playbook: {
      id: 'agent-002',
      title: 'Stringified Export',
      strategyJson: JSON.stringify(strategy),
    },
  }, async () => {
    throw new Error('parser should not run for structured strategies');
  });

  assert.equal(parsed.source, 'strategy-json');
  assert.equal(parsed.playbookId, 'agent-002');
  assert.equal(parsed.playbookName, 'Stringified Export');
  assert.deepEqual(parsed.strategy.universe, ['BTCUSDT']);
});

test('falls back to natural-language Playbook descriptions', async () => {
  const parsed = await importPlaybookStrategy({
    agentId: 'agent-003',
    title: 'Description Agent',
    prompt: 'BTC moving average crossover with strict stop loss',
  }, async description => {
    assert.match(description, /moving average/i);
    return draft;
  });

  assert.equal(parsed.source, 'description');
  assert.equal(parsed.description, 'BTC moving average crossover with strict stop loss');
  assert.equal(parsed.strategy.name, 'Playbook MA Cross');
});

test('rejects Playbook payloads without a strategy or description', async () => {
  await assert.rejects(
    () => importPlaybookStrategy({ name: 'empty' }, async () => draft),
    PlaybookImportError,
  );
});

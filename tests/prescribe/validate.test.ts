import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type { Scenario, Strategy } from '../../src/contracts.ts';
import { validateOnHeldOut } from '../../src/prescribe/validate.ts';
import {
  buildSentimentScenario,
  parseSentimentSnapshot,
} from '../../src/redteam/sentiment.ts';
import {
  buildTechnicalScenario,
  parseTechnicalSnapshot,
} from '../../src/redteam/technical.ts';
import { getProfile } from '../../src/scoring/styles.ts';

const loadJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

const original = loadJson('../../examples/trend-follower.json') as Strategy;
const patched: Strategy = {
  ...original,
  id: `${original.id}-rx`,
  params: {
    ...original.params,
    leverage: 5,
    stopLossPct: 0.08,
    positionPct: 0.7,
  },
};

const scenarioSets = (): {
  treatment: Scenario[];
  heldOut: Scenario[];
} => {
  const sentiment = parseSentimentSnapshot(
    loadJson('../../examples/sentiment-btc.snapshot.json'),
  );
  const technical = parseTechnicalSnapshot(
    loadJson('../../examples/technical-btc-4h.snapshot.json'),
  );

  return {
    treatment: [
      buildSentimentScenario(sentiment, 42),
      buildTechnicalScenario(technical, 99),
    ],
    heldOut: [
      buildSentimentScenario(sentiment, 100042),
      buildTechnicalScenario(technical, 100099),
    ],
  };
};

test('validateOnHeldOut returns a finite honest tradeoff on separate seeds', async () => {
  const { treatment, heldOut } = scenarioSets();
  const tradeoff = await validateOnHeldOut(
    original,
    patched,
    treatment,
    heldOut,
    new MockBacktester(),
    getProfile('conservative'),
  );

  assert.ok(Number.isFinite(tradeoff.robustnessGain));
  assert.ok(Number.isFinite(tradeoff.returnCost));
  assert.ok(
    tradeoff.robustnessGain >= 0,
    `expected non-negative robustness gain, received ${tradeoff.robustnessGain}`,
  );
});

test('validateOnHeldOut rejects any treatment and held-out seed overlap', async () => {
  const { treatment } = scenarioSets();

  await assert.rejects(
    validateOnHeldOut(
      original,
      patched,
      treatment,
      [treatment[0]],
      new MockBacktester(),
      getProfile('conservative'),
    ),
    /seed/,
  );
});

test('validateOnHeldOut rejects empty treatment or held-out sets', async () => {
  const { treatment, heldOut } = scenarioSets();

  await assert.rejects(
    validateOnHeldOut(
      original,
      patched,
      [],
      heldOut,
      new MockBacktester(),
      getProfile('conservative'),
    ),
    /treatment/,
  );
  await assert.rejects(
    validateOnHeldOut(
      original,
      patched,
      treatment,
      [],
      new MockBacktester(),
      getProfile('conservative'),
    ),
    /held-out/,
  );
});

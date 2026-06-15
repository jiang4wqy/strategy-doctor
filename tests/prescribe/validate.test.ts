import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type {
  MaCrossStrategy,
  Scenario,
} from '../../src/contracts.ts';
import {
  validateOnHeldOut,
  validateOnHeldOutDetailed,
} from '../../src/prescribe/validate.ts';
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

const original = loadJson(
  '../../examples/trend-follower.json',
) as MaCrossStrategy;
const patched: MaCrossStrategy = {
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

test('validateOnHeldOutDetailed preserves metrics and legacy tradeoff behavior', async () => {
  const { treatment, heldOut } = scenarioSets();
  const detailed = await validateOnHeldOutDetailed(
    original,
    patched,
    treatment,
    heldOut,
    new MockBacktester(),
    getProfile('conservative'),
  );
  const legacy = await validateOnHeldOut(
    original,
    patched,
    treatment,
    heldOut,
    new MockBacktester(),
    getProfile('conservative'),
  );

  assert.equal(detailed.originalMetrics.length, heldOut.length);
  assert.equal(detailed.patchedMetrics.length, heldOut.length);
  assert.ok(
    detailed.originalMetrics.every(metrics => metrics.equityCurve.length > 0),
  );
  assert.ok(
    detailed.patchedMetrics.every(metrics => metrics.equityCurve.length > 0),
  );
  assert.deepEqual(detailed.tradeoff, legacy);
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

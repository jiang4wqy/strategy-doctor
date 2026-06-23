import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSentimentScenario,
  parseSentimentSnapshot,
  type SentimentSnapshot,
} from '../../src/redteam/sentiment.ts';

const validSnapshot: SentimentSnapshot = {
  sourceSkill: 'sentiment-analyst',
  symbol: 'BTCUSDT',
  observedAt: '2026-06-12T14:21:50.123Z',
  fearGreed: 12,
  retailLongShare: 0.5987,
  topTraderLongShare: 0.6193,
  takerBuySellRatio: 0.51229,
};

test('parseSentimentSnapshot accepts a valid normalized snapshot', () => {
  assert.deepEqual(parseSentimentSnapshot(validSnapshot), validSnapshot);
});

test('parseSentimentSnapshot rejects missing required fields', () => {
  const { fearGreed: _fearGreed, ...missingFearGreed } = validSnapshot;
  assert.throws(() => parseSentimentSnapshot(missingFearGreed), /fearGreed/);
});

test('parseSentimentSnapshot rejects an invalid observation time', () => {
  assert.throws(
    () => parseSentimentSnapshot({ ...validSnapshot, observedAt: 'not-a-date' }),
    /observedAt/,
  );
});

test('parseSentimentSnapshot rejects out-of-range normalized values', () => {
  assert.throws(
    () => parseSentimentSnapshot({ ...validSnapshot, fearGreed: 101 }),
    /fearGreed/,
  );
  assert.throws(
    () => parseSentimentSnapshot({ ...validSnapshot, retailLongShare: -0.01 }),
    /retailLongShare/,
  );
  assert.throws(
    () => parseSentimentSnapshot({ ...validSnapshot, topTraderLongShare: 1.01 }),
    /topTraderLongShare/,
  );
  assert.throws(
    () => parseSentimentSnapshot({ ...validSnapshot, takerBuySellRatio: 1.01 }),
    /takerBuySellRatio/,
  );
});

test('parseSentimentSnapshot rejects non-finite numeric values', () => {
  assert.throws(
    () => parseSentimentSnapshot({ ...validSnapshot, fearGreed: Number.NaN }),
    /fearGreed/,
  );
  assert.throws(
    () => parseSentimentSnapshot({ ...validSnapshot, retailLongShare: Number.POSITIVE_INFINITY }),
    /retailLongShare/,
  );
});

test('buildSentimentScenario is deterministic and respects scenario bounds', () => {
  const first = buildSentimentScenario(validSnapshot, 42);
  const second = buildSentimentScenario(validSnapshot, 42);

  assert.deepEqual(first, second);
  assert.equal(first.dimension, 'sentiment');
  assert.equal(first.sourceSkill, 'sentiment-analyst');
  assert.equal(first.shock.kind, 'squeeze');
  assert.equal(first.shock.seed, 42);
  assert.ok(first.severity >= 1 && first.severity <= 5);
  assert.ok(first.shock.magnitude >= 0.15 && first.shock.magnitude <= 0.45);
  assert.ok(first.shock.volMult >= 1.5 && first.shock.volMult <= 3);
});

test('buildSentimentScenario distinguishes long-crowded and short-crowded narratives', () => {
  const longCrowded = buildSentimentScenario({
    ...validSnapshot,
    retailLongShare: 0.8,
    topTraderLongShare: 0.75,
  }, 1);
  const shortCrowded = buildSentimentScenario({
    ...validSnapshot,
    retailLongShare: 0.2,
    topTraderLongShare: 0.25,
  }, 1);

  assert.match(longCrowded.narrative, /long crowding/);
  assert.match(shortCrowded.narrative, /short crowding/);
  assert.notEqual(longCrowded.narrative, shortCrowded.narrative);
});

test('buildSentimentScenario maps minimum and maximum risk to bounded endpoints', () => {
  const neutral = buildSentimentScenario({
    ...validSnapshot,
    fearGreed: 50,
    retailLongShare: 0.5,
    topTraderLongShare: 0.5,
    takerBuySellRatio: 0.5,
  }, 7);
  const extreme = buildSentimentScenario({
    ...validSnapshot,
    fearGreed: 0,
    retailLongShare: 1,
    topTraderLongShare: 1,
    takerBuySellRatio: 0,
  }, 7);

  assert.equal(neutral.shock.magnitude, 0.15);
  assert.equal(neutral.shock.volMult, 1.5);
  assert.equal(neutral.severity, 1);
  assert.equal(extreme.shock.magnitude, 0.45);
  assert.equal(extreme.shock.volMult, 3);
  assert.equal(extreme.severity, 5);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNewsScenario,
  parseNewsSnapshot,
  type NewsSnapshot,
} from '../../src/redteam/news.ts';

const validSnapshot: NewsSnapshot = {
  sourceSkill: 'news-briefing',
  symbol: 'BTCUSDT',
  observedAt: '2026-06-13T03:27:49.7341566Z',
  items: [
    {
      title: 'Inflation surprise increases rate pressure',
      publishedAt: '2026-06-12T16:25:00Z',
      url: 'https://example.com/inflation',
      riskTags: ['negative', 'macro', 'high-impact'],
    },
    {
      title: 'Digital asset bill advances',
      publishedAt: '2026-06-12T12:00:00Z',
      url: 'https://example.com/regulation',
      riskTags: ['positive', 'regulatory'],
    },
  ],
  riskSignals: {
    negativeHeadlineShare: 0.5,
    highImpactShare: 0.5,
    regulatoryShare: 0.5,
    macroShockShare: 0.5,
  },
};

test('parseNewsSnapshot accepts valid metadata and aggregate risk signals', () => {
  assert.deepEqual(parseNewsSnapshot(validSnapshot), validSnapshot);
});

test('parseNewsSnapshot rejects invalid source, item counts, and missing metadata', () => {
  assert.throws(
    () => parseNewsSnapshot({ ...validSnapshot, sourceSkill: 'market-intel' }),
    /sourceSkill/,
  );
  assert.throws(
    () => parseNewsSnapshot({ ...validSnapshot, items: [] }),
    /items/,
  );
  assert.throws(
    () => parseNewsSnapshot({
      ...validSnapshot,
      items: Array.from({ length: 13 }, (_, index) => ({
        ...validSnapshot.items[0],
        title: `headline ${index}`,
      })),
    }),
    /items/,
  );
  assert.throws(
    () => parseNewsSnapshot({
      ...validSnapshot,
      items: [{ ...validSnapshot.items[0], title: '' }],
    }),
    /title/,
  );
});

test('parseNewsSnapshot rejects invalid times, URLs, tags, and risk ranges', () => {
  assert.throws(
    () => parseNewsSnapshot({ ...validSnapshot, observedAt: 'invalid' }),
    /observedAt/,
  );
  assert.throws(
    () => parseNewsSnapshot({
      ...validSnapshot,
      items: [{ ...validSnapshot.items[0], publishedAt: '2026-06-14T00:00:00Z' }],
    }),
    /publishedAt/,
  );
  assert.throws(
    () => parseNewsSnapshot({
      ...validSnapshot,
      items: [{ ...validSnapshot.items[0], url: 'not-a-url' }],
    }),
    /url/,
  );
  assert.throws(
    () => parseNewsSnapshot({
      ...validSnapshot,
      items: [{ ...validSnapshot.items[0], riskTags: ['unknown'] }],
    }),
    /riskTags/,
  );
  assert.throws(
    () => parseNewsSnapshot({
      ...validSnapshot,
      riskSignals: { ...validSnapshot.riskSignals, negativeHeadlineShare: 1.1 },
    }),
    /negativeHeadlineShare/,
  );
});

test('buildNewsScenario is deterministic and emits a bounded gap', () => {
  const first = buildNewsScenario(validSnapshot, 123);
  const second = buildNewsScenario(validSnapshot, 123);

  assert.deepEqual(first, second);
  assert.equal(first.dimension, 'news');
  assert.equal(first.sourceSkill, 'news-briefing');
  assert.equal(first.shock.kind, 'gap');
  assert.equal(first.shock.seed, 123);
  assert.ok(first.severity >= 1 && first.severity <= 5);
  assert.ok(first.shock.magnitude >= 0.08 && first.shock.magnitude <= 0.35);
  assert.ok(first.shock.durationBars >= 1 && first.shock.durationBars <= 12);
  assert.ok(first.shock.volMult >= 1.2 && first.shock.volMult <= 3);
});

test('buildNewsScenario maps aggregate headline risk to shock intensity', () => {
  const quiet = buildNewsScenario({
    ...validSnapshot,
    riskSignals: {
      negativeHeadlineShare: 0,
      highImpactShare: 0,
      regulatoryShare: 0,
      macroShockShare: 0,
    },
  }, 5);
  const crisis = buildNewsScenario({
    ...validSnapshot,
    riskSignals: {
      negativeHeadlineShare: 1,
      highImpactShare: 1,
      regulatoryShare: 1,
      macroShockShare: 1,
    },
  }, 5);

  assert.equal(quiet.severity, 1);
  assert.equal(quiet.shock.magnitude, 0.08);
  assert.equal(crisis.severity, 5);
  assert.equal(crisis.shock.magnitude, 0.35);
  assert.ok(crisis.shock.volMult > quiet.shock.volMult);
});

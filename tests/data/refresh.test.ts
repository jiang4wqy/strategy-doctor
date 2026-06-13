import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpToolCaller } from '../../src/backtest/bitget.ts';
import {
  collectSnapshotBundle,
  computeTechnicalSnapshot,
  refreshSnapshots,
} from '../../src/data/refresh.ts';
import {
  buildBaseScenarioSet,
} from '../../src/data/snapshots.ts';
import { parseCandles, type Candle } from '../../src/backtest/bitget.ts';

const candles: Candle[] = Array.from({ length: 200 }, (_, index) => {
  const open = 50_000 + index * 20 + Math.sin(index / 3) * 200;
  const close = open + Math.sin(index) * 100;
  return {
    timestamp: 1_781_000_000_000 + index * 14_400_000,
    open,
    high: Math.max(open, close) + 50,
    low: Math.min(open, close) - 50,
    close,
    volume: 1000 + index,
  };
});

const responses = new Map<string, unknown>([
  ['rates_yields:rates_snapshot', {
    fed_funds_target_upper: { value: '3.75' },
    fed_funds_target_lower: { value: '3.5' },
    t2y: { value: '4.05' },
    t10y: { value: '4.45' },
    spread_10y2y: { value: '0.4' },
    breakeven_10y: { value: '2.3' },
    hy_spread: { value: '2.8' },
  }],
  ['global_assets:dxy', { price: 99.75 }],
  ['global_assets:vix', { price: 17.68 }],
  ['cross_asset:correlation', {
    correlations: {
      dxy: { rolling_corr: -0.3 },
      ndx: { rolling_corr: 0.5 },
      vix: { rolling_corr: -0.4 },
    },
  }],
  ['sentiment_index:current', { value: '13' }],
  ['derivatives_sentiment:long_short', [
    { longAccount: '0.61', timestamp: 2 },
  ]],
  ['derivatives_sentiment:top_position', [
    { longAccount: '0.54', timestamp: 2 },
  ]],
  ['derivatives_sentiment:taker_ratio', [
    { buySellRatio: '2', buyVol: '200', sellVol: '100', timestamp: 2 },
  ]],
  ['derivatives_sentiment:open_interest', [
    { sumOpenInterest: '100000', timestamp: 1 },
    { sumOpenInterest: '97000', timestamp: 2 },
  ]],
  ['crypto_market:global', {
    data: {
      total_market_cap: { usd: 2_000_000_000_000 },
      market_cap_percentage: { btc: 56 },
      market_cap_change_percentage_24h_usd: -2,
    },
  }],
  ['defi_analytics:stablecoins', {
    peggedAssets: [
      {
        pegType: 'peggedUSD',
        circulating: { peggedUSD: 100 },
        circulatingPrevDay: { peggedUSD: 90 },
        circulatingPrevWeek: { peggedUSD: 80 },
        circulatingPrevMonth: { peggedUSD: 70 },
      },
      {
        pegType: 'peggedUSD',
        circulating: { peggedUSD: 50 },
        circulatingPrevDay: { peggedUSD: 50 },
        circulatingPrevWeek: { peggedUSD: 50 },
        circulatingPrevMonth: { peggedUSD: 50 },
      },
      {
        pegType: 'peggedEUR',
        circulating: { peggedEUR: 999 },
      },
      {
        pegType: 'peggedUSD',
        circulating: { peggedUSD: 10 },
        circulatingPrevDay: {},
        circulatingPrevWeek: {},
        circulatingPrevMonth: {},
      },
    ],
  }],
  ['news_feed:latest', [{
    feed: 'coincenter',
    items: [
      {
        title: 'Digital asset tax rule raises regulatory risk',
        link: 'https://example.test/regulation',
        published: '2026-06-12T10:00:00Z',
        summary: 'must not be persisted',
      },
      {
        title: 'Bitcoin ETF demand shows institutional strength',
        link: 'https://example.test/market',
        published: '2026-06-12T09:00:00Z',
        summary: 'must not be persisted',
      },
      {
        title: 'Missing link is skipped',
        link: '',
        published: '2026-06-12T08:00:00Z',
      },
    ],
  }]],
  ['crypto_derivatives:klines', candles],
]);

class FixtureClient implements McpToolCaller {
  private readonly failKey?: string;

  constructor(failKey?: string) {
    this.failKey = failKey;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const action = String(args.action);
    const suffix = name === 'global_assets'
      ? String(args.symbol) === 'DX-Y.NYB' ? 'dxy' : 'vix'
      : action;
    const key = `${name}:${suffix}`;
    if (key === this.failKey) {
      throw new Error('fixture failure');
    }
    if (!responses.has(key)) {
      throw new Error(`missing fixture: ${key}`);
    }
    return responses.get(key);
  }
}

test('computeTechnicalSnapshot derives bounded indicators from 200 candles', () => {
  const snapshot = computeTechnicalSnapshot(
    parseCandles(candles),
    '2026-06-13T00:00:00Z',
  );

  assert.equal(snapshot.sourceSkill, 'technical-analysis');
  assert.equal(snapshot.candlesCount, 200);
  assert.ok(snapshot.rsi >= 0 && snapshot.rsi <= 100);
  assert.ok(snapshot.adx >= 0 && snapshot.adx <= 100);
  assert.ok(snapshot.bollBandwidth >= 0 && snapshot.bollBandwidth <= 1);
  assert.ok(Number.isInteger(snapshot.dmiCrosses20));
  assert.ok(Number.isInteger(snapshot.rsiCenterCrosses20));
});

test('collectSnapshotBundle normalizes all five public data dimensions', async () => {
  const bundle = await collectSnapshotBundle(
    new FixtureClient(),
    new Date('2026-06-13T00:00:00Z'),
  );

  assert.equal(bundle.sentiment.takerBuySellRatio, 2 / 3);
  assert.equal(bundle.marketIntel.stablecoinSupplyUsd, 160);
  assert.equal(bundle.marketIntel.openInterestChangePct, -3);
  assert.equal(bundle.news.items.length, 2);
  assert.ok(bundle.news.items[0].riskTags.includes('regulatory'));
  assert.equal('summary' in bundle.news.items[0], false);
  assert.equal(buildBaseScenarioSet(bundle, 42).length, 5);
});

test('refreshSnapshots writes a complete validated set with no temporary files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-snapshots-'));
  await refreshSnapshots(
    new FixtureClient(),
    directory,
    new Date('2026-06-13T00:00:00Z'),
  );

  assert.deepEqual(readdirSync(directory).sort(), [
    'macro-btc.snapshot.json',
    'market-intel-btc.snapshot.json',
    'news-btc.snapshot.json',
    'sentiment-btc.snapshot.json',
    'technical-btc-4h.snapshot.json',
  ]);
  const news = JSON.parse(
    readFileSync(join(directory, 'news-btc.snapshot.json'), 'utf8'),
  ) as { items: unknown[] };
  assert.equal(news.items.length, 2);
});

test('refreshSnapshots leaves the target untouched when collection fails', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-snapshots-'));

  await assert.rejects(
    refreshSnapshots(
      new FixtureClient('crypto_market:global'),
      directory,
      new Date('2026-06-13T00:00:00Z'),
    ),
    /fixture failure/,
  );
  assert.deepEqual(readdirSync(directory), []);
});

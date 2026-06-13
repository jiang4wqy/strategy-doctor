import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  parseCandles,
  type Candle,
  type McpToolCaller,
} from '../backtest/bitget.ts';
import {
  parseMacroSnapshot,
  type MacroSnapshot,
} from '../redteam/macro.ts';
import {
  parseMarketIntelSnapshot,
  type MarketIntelSnapshot,
} from '../redteam/market-intel.ts';
import {
  parseNewsSnapshot,
  type NewsItem,
  type NewsRiskTag,
  type NewsSnapshot,
} from '../redteam/news.ts';
import {
  parseSentimentSnapshot,
  type SentimentSnapshot,
} from '../redteam/sentiment.ts';
import {
  parseTechnicalSnapshot,
  type TechnicalSnapshot,
} from '../redteam/technical.ts';
import type { SnapshotBundle } from './snapshots.ts';

const round6 = (value: number): number =>
  Math.round(value * 1_000_000) / 1_000_000;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function number(value: unknown, label: string): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw new Error(`${label} must be a finite number`);
  }
  return parsed;
}

function nested(
  value: unknown,
  path: string[],
  label = path.join('.'),
): number {
  let current = value;
  for (const field of path) {
    current = record(current, label)[field];
  }
  return number(current, label);
}

function optionalNested(
  value: unknown,
  path: string[],
  fallback: number,
): number {
  let current = value;
  for (const field of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return fallback;
    }
    const next = (current as Record<string, unknown>)[field];
    if (next === undefined || next === null) {
      return fallback;
    }
    current = next;
  }
  return number(current, path.join('.'));
}

function latest(value: unknown, label: string): Record<string, unknown> {
  const values = array(value, label).map(candidate => record(candidate, label));
  if (values.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  return values.reduce((selected, candidate) => (
    number(candidate.timestamp ?? 0, `${label}.timestamp`)
      >= number(selected.timestamp ?? 0, `${label}.timestamp`)
      ? candidate
      : selected
  ));
}

function percentChange(current: number, previous: number): number {
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

function stablecoinTotals(value: unknown): {
  current: number;
  day: number;
  week: number;
  month: number;
} {
  const assets = array(record(value, 'stablecoins').peggedAssets, 'peggedAssets');
  return assets.reduce<{
    current: number;
    day: number;
    week: number;
    month: number;
  }>((totals, candidate) => {
    const asset = record(candidate, 'pegged asset');
    if (asset.pegType !== 'peggedUSD') {
      return totals;
    }
    const current = nested(asset, ['circulating', 'peggedUSD']);
    totals.current += current;
    totals.day += optionalNested(
      asset,
      ['circulatingPrevDay', 'peggedUSD'],
      current,
    );
    totals.week += optionalNested(
      asset,
      ['circulatingPrevWeek', 'peggedUSD'],
      current,
    );
    totals.month += optionalNested(
      asset,
      ['circulatingPrevMonth', 'peggedUSD'],
      current,
    );
    return totals;
  }, { current: 0, day: 0, week: 0, month: 0 });
}

function crosses(values: number[], center = 0): number {
  const recent = values.slice(-20);
  let count = 0;
  for (let index = 1; index < recent.length; index++) {
    const previous = Math.sign(recent[index - 1] - center);
    const current = Math.sign(recent[index] - center);
    if (previous !== 0 && current !== 0 && previous !== current) {
      count++;
    }
  }
  return count;
}

function rsiSeries(closes: number[], period = 14): number[] {
  const values: number[] = [];
  for (let index = period; index < closes.length; index++) {
    let gains = 0;
    let losses = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor++) {
      const change = closes[cursor] - closes[cursor - 1];
      gains += Math.max(0, change);
      losses += Math.max(0, -change);
    }
    if (losses === 0) {
      values.push(gains === 0 ? 50 : 100);
    } else {
      const relativeStrength = gains / losses;
      values.push(100 - 100 / (1 + relativeStrength));
    }
  }
  return values;
}

function dmiSeries(candles: Candle[], period = 14): {
  plus: number[];
  minus: number[];
  dx: number[];
} {
  const plus: number[] = [];
  const minus: number[] = [];
  const dx: number[] = [];
  for (let index = period; index < candles.length; index++) {
    let trueRange = 0;
    let plusMovement = 0;
    let minusMovement = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor++) {
      const current = candles[cursor];
      const previous = candles[cursor - 1];
      trueRange += Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      );
      const up = current.high - previous.high;
      const down = previous.low - current.low;
      plusMovement += up > down && up > 0 ? up : 0;
      minusMovement += down > up && down > 0 ? down : 0;
    }
    const plusValue = trueRange === 0 ? 0 : plusMovement / trueRange * 100;
    const minusValue = trueRange === 0 ? 0 : minusMovement / trueRange * 100;
    plus.push(plusValue);
    minus.push(minusValue);
    const total = plusValue + minusValue;
    dx.push(total === 0 ? 0 : Math.abs(plusValue - minusValue) / total * 100);
  }
  return { plus, minus, dx };
}

export function computeTechnicalSnapshot(
  candles: Candle[],
  observedAt: string,
): TechnicalSnapshot {
  const validated = parseCandles(candles);
  if (validated.length < 200) {
    throw new Error('technical snapshot requires at least 200 candles');
  }
  const closes = validated.map(candle => candle.close);
  const rsi = rsiSeries(closes);
  const dmi = dmiSeries(validated);
  const last20 = closes.slice(-20);
  const mean = last20.reduce((sum, value) => sum + value, 0) / last20.length;
  const variance = last20.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / last20.length;
  const bandwidth = mean === 0 ? 0 : 4 * Math.sqrt(variance) / mean;
  const adxWindow = dmi.dx.slice(-14);
  const adx = adxWindow.reduce((sum, value) => sum + value, 0)
    / adxWindow.length;

  return parseTechnicalSnapshot({
    sourceSkill: 'technical-analysis',
    symbol: 'BTCUSDT',
    timeframe: '4h',
    observedAt,
    candlesCount: validated.length,
    adx: round6(clamp(adx, 0, 100)),
    diPlus: round6(clamp(dmi.plus.at(-1) ?? 0, 0, 100)),
    diMinus: round6(clamp(dmi.minus.at(-1) ?? 0, 0, 100)),
    dmiCrosses20: crosses(
      dmi.plus.map((value, index) => value - dmi.minus[index]),
    ),
    bollBandwidth: round6(clamp(bandwidth, 0, 1)),
    rsi: round6(clamp(rsi.at(-1) ?? 50, 0, 100)),
    rsiCenterCrosses20: crosses(rsi, 50),
  });
}

function riskTags(title: string): NewsRiskTag[] {
  const lower = title.toLowerCase();
  const tags = new Set<NewsRiskTag>();
  const includes = (...words: string[]) => words.some(word => lower.includes(word));
  if (includes('risk', 'bearish', 'fall', 'shrank', 'hack', 'fraud', 'ban', 'conflict', 'war')) {
    tags.add('negative');
  } else if (includes('strength', 'growth', 'approval', 'demand')) {
    tags.add('positive');
  } else {
    tags.add('neutral');
  }
  if (includes('rule', 'regulation', 'tax', 'aml', 'fincen', 'sec ')) {
    tags.add('regulatory');
  }
  if (includes('gdp', 'economy', 'inflation', 'rate', 'federal reserve', 'fed ')) {
    tags.add('macro');
  }
  if (includes('bank', 'institution', 'corporate', 'etf')) {
    tags.add('institutional');
  }
  if (includes('war', 'iran', 'sanction', 'geopolit', 'conflict')) {
    tags.add('geopolitical');
  }
  if (includes('bitcoin', 'btc', 'ethereum', 'eth ', 'crypto', 'stablecoin')) {
    tags.add('market');
  }
  if (
    tags.has('negative')
    || tags.has('regulatory')
    || tags.has('macro')
    || tags.has('geopolitical')
  ) {
    tags.add('high-impact');
  }
  return [...tags];
}

function newsSnapshot(
  value: unknown,
  observedAt: string,
): NewsSnapshot {
  const observedTime = Date.parse(observedAt);
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const feedValue of array(value, 'news feeds')) {
    const feed = record(feedValue, 'news feed');
    for (const itemValue of array(feed.items ?? [], 'news items')) {
      const item = record(itemValue, 'news item');
      if (
        typeof item.title !== 'string'
        || typeof item.link !== 'string'
        || typeof item.published !== 'string'
      ) {
        continue;
      }
      let url: URL;
      try {
        url = new URL(item.link);
      } catch {
        continue;
      }
      const publishedTime = Date.parse(item.published);
      if (
        !['http:', 'https:'].includes(url.protocol)
        || !Number.isFinite(publishedTime)
        || publishedTime > observedTime
      ) {
        continue;
      }
      const key = `${item.title}|${url.href}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({
        title: item.title.trim().slice(0, 240),
        publishedAt: new Date(publishedTime).toISOString(),
        url: url.href,
        riskTags: riskTags(item.title),
      });
    }
  }
  items.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  const selected = items.slice(0, 12);
  if (selected.length === 0) {
    throw new Error('news refresh returned no usable article metadata');
  }
  const share = (tag: NewsRiskTag): number =>
    selected.filter(item => item.riskTags.includes(tag)).length / selected.length;
  return parseNewsSnapshot({
    sourceSkill: 'news-briefing',
    symbol: 'BTCUSDT',
    observedAt,
    items: selected,
    riskSignals: {
      negativeHeadlineShare: share('negative'),
      highImpactShare: share('high-impact'),
      regulatoryShare: share('regulatory'),
      macroShockShare: share('macro'),
    },
  });
}

export async function collectSnapshotBundle(
  client: McpToolCaller,
  now = new Date(),
): Promise<SnapshotBundle> {
  const observedAt = now.toISOString();
  const [
    ratesValue,
    dxyValue,
    vixValue,
    correlationValue,
    fearGreedValue,
    retailValue,
    topPositionValue,
    takerValue,
    openInterestValue,
    globalValue,
    stablecoinsValue,
    newsValue,
    candlesValue,
  ] = await Promise.all([
    client.callTool('rates_yields', { action: 'rates_snapshot' }),
    client.callTool('global_assets', { action: 'price', symbol: 'DX-Y.NYB' }),
    client.callTool('global_assets', { action: 'price', symbol: '^VIX' }),
    client.callTool('cross_asset', {
      action: 'correlation',
      base: 'btc',
      targets: 'dxy,ndx,vix',
      period: '90d',
      window: 30,
    }),
    client.callTool('sentiment_index', { action: 'current' }),
    client.callTool('derivatives_sentiment', {
      action: 'long_short',
      symbol: 'BTCUSDT',
      period: '4h',
      limit: 7,
    }),
    client.callTool('derivatives_sentiment', {
      action: 'top_position',
      symbol: 'BTCUSDT',
      period: '4h',
      limit: 7,
    }),
    client.callTool('derivatives_sentiment', {
      action: 'taker_ratio',
      symbol: 'BTCUSDT',
      period: '4h',
      limit: 7,
    }),
    client.callTool('derivatives_sentiment', {
      action: 'open_interest',
      symbol: 'BTCUSDT',
      period: '4h',
      limit: 7,
    }),
    client.callTool('crypto_market', { action: 'global' }),
    client.callTool('defi_analytics', { action: 'stablecoins', limit: 100 }),
    client.callTool('news_feed', {
      action: 'latest',
      feeds: 'cointelegraph,decrypt,blockworks,cnbc,fed,coincenter',
      limit: 2,
    }),
    client.callTool('crypto_derivatives', {
      action: 'klines',
      exchange: 'bitget',
      symbol: 'BTC/USDT',
      timeframe: '4h',
      limit: 200,
    }),
  ]);

  const rates = record(ratesValue, 'rates');
  const correlations = record(
    record(correlationValue, 'correlations response').correlations,
    'correlations',
  );
  const correlation = (key: string): number =>
    nested(correlations, [key, 'rolling_corr']);
  const macro: MacroSnapshot = parseMacroSnapshot({
    sourceSkill: 'macro-analyst',
    symbol: 'BTCUSDT',
    observedAt,
    fedFundsUpperPct: nested(rates, ['fed_funds_target_upper', 'value']),
    fedFundsLowerPct: nested(rates, ['fed_funds_target_lower', 'value']),
    treasury2yPct: nested(rates, ['t2y', 'value']),
    treasury10yPct: nested(rates, ['t10y', 'value']),
    yieldSpread10y2yPct: nested(rates, ['spread_10y2y', 'value']),
    breakeven10yPct: nested(rates, ['breakeven_10y', 'value']),
    highYieldSpreadPct: nested(rates, ['hy_spread', 'value']),
    dxy: nested(dxyValue, ['price']),
    vix: nested(vixValue, ['price']),
    btc90dCorrelation: {
      dxy: correlation('dxy'),
      nasdaq100: correlation('ndx'),
      vix: correlation('vix'),
    },
  });

  const retail = latest(retailValue, 'long_short');
  const topPosition = latest(topPositionValue, 'top_position');
  const taker = latest(takerValue, 'taker_ratio');
  const buyVolume = number(taker.buyVol, 'buyVol');
  const sellVolume = number(taker.sellVol, 'sellVol');
  const takerBuyShare = buyVolume + sellVolume === 0
    ? number(taker.buySellRatio, 'buySellRatio')
      / (1 + number(taker.buySellRatio, 'buySellRatio'))
    : buyVolume / (buyVolume + sellVolume);
  const sentiment: SentimentSnapshot = parseSentimentSnapshot({
    sourceSkill: 'sentiment-analyst',
    symbol: 'BTCUSDT',
    observedAt,
    fearGreed: nested(fearGreedValue, ['value']),
    retailLongShare: number(retail.longAccount, 'longAccount'),
    topTraderLongShare: number(topPosition.longAccount, 'longAccount'),
    takerBuySellRatio: takerBuyShare,
  });

  const global = record(record(globalValue, 'global market').data, 'global data');
  const stablecoins = stablecoinTotals(stablecoinsValue);
  const openInterest = array(openInterestValue, 'open interest')
    .map(value => record(value, 'open interest entry'))
    .sort(
      (left, right) =>
        number(left.timestamp, 'open interest timestamp')
        - number(right.timestamp, 'open interest timestamp'),
    );
  if (openInterest.length < 2) {
    throw new Error('open interest requires at least two observations');
  }
  const openInterestStart = number(
    openInterest[0].sumOpenInterest,
    'openInterestStart',
  );
  const openInterestEnd = number(
    openInterest.at(-1)!.sumOpenInterest,
    'openInterestEnd',
  );
  const marketIntel: MarketIntelSnapshot = parseMarketIntelSnapshot({
    sourceSkill: 'market-intel',
    symbol: 'BTCUSDT',
    observedAt,
    globalMarketCapUsd: nested(global, ['total_market_cap', 'usd']),
    btcDominancePct: nested(global, ['market_cap_percentage', 'btc']),
    marketCapChange24hPct: number(
      global.market_cap_change_percentage_24h_usd,
      'marketCapChange24hPct',
    ),
    stablecoinSupplyUsd: stablecoins.current,
    stablecoinChange1dPct: percentChange(stablecoins.current, stablecoins.day),
    stablecoinChange7dPct: percentChange(stablecoins.current, stablecoins.week),
    stablecoinChange30dPct: percentChange(stablecoins.current, stablecoins.month),
    topTraderLongShare: number(topPosition.longAccount, 'topTraderLongShare'),
    openInterestStartBtc: openInterestStart,
    openInterestEndBtc: openInterestEnd,
    openInterestChangePct: percentChange(openInterestEnd, openInterestStart),
  });

  return {
    macro,
    marketIntel,
    news: newsSnapshot(newsValue, observedAt),
    sentiment,
    technical: computeTechnicalSnapshot(parseCandles(candlesValue), observedAt),
  };
}

const SNAPSHOT_FILES = {
  macro: 'macro-btc.snapshot.json',
  marketIntel: 'market-intel-btc.snapshot.json',
  news: 'news-btc.snapshot.json',
  sentiment: 'sentiment-btc.snapshot.json',
  technical: 'technical-btc-4h.snapshot.json',
} as const;

function validatedBundle(bundle: SnapshotBundle): SnapshotBundle {
  return {
    macro: parseMacroSnapshot(bundle.macro),
    marketIntel: parseMarketIntelSnapshot(bundle.marketIntel),
    news: parseNewsSnapshot(bundle.news),
    sentiment: parseSentimentSnapshot(bundle.sentiment),
    technical: parseTechnicalSnapshot(bundle.technical),
  };
}

export async function refreshSnapshots(
  client: McpToolCaller,
  directory: string,
  now = new Date(),
): Promise<SnapshotBundle> {
  const bundle = validatedBundle(await collectSnapshotBundle(client, now));
  mkdirSync(directory, { recursive: true });
  const entries = Object.entries(SNAPSHOT_FILES) as Array<
    [keyof SnapshotBundle, string]
  >;
  const backups = new Map<string, string | undefined>();
  const temporaryFiles: string[] = [];

  try {
    for (const [key, filename] of entries) {
      const target = join(directory, filename);
      const temporary = `${target}.tmp-${process.pid}`;
      backups.set(
        target,
        existsSync(target) ? readFileSync(target, 'utf8') : undefined,
      );
      writeFileSync(
        temporary,
        `${JSON.stringify(bundle[key], null, 2)}\n`,
        'utf8',
      );
      temporaryFiles.push(temporary);
    }
    for (const [, filename] of entries) {
      const target = join(directory, filename);
      renameSync(`${target}.tmp-${process.pid}`, target);
    }
  } catch (error) {
    for (const [target, backup] of backups) {
      if (backup === undefined) {
        rmSync(target, { force: true });
      } else {
        writeFileSync(target, backup, 'utf8');
      }
    }
    throw error;
  } finally {
    for (const temporary of temporaryFiles) {
      rmSync(temporary, { force: true });
    }
  }
  return bundle;
}

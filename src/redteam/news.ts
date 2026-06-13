import type { Scenario } from '../contracts.ts';

export type NewsRiskTag =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'macro'
  | 'regulatory'
  | 'institutional'
  | 'geopolitical'
  | 'market'
  | 'high-impact';

export interface NewsItem {
  title: string;
  publishedAt: string;
  url: string;
  riskTags: NewsRiskTag[];
}

export interface NewsSnapshot {
  sourceSkill: 'news-briefing';
  symbol: string;
  observedAt: string;
  items: NewsItem[];
  riskSignals: {
    negativeHeadlineShare: number;
    highImpactShare: number;
    regulatoryShare: number;
    macroShockShare: number;
  };
}

const NEWS_RISK_TAGS = new Set<NewsRiskTag>([
  'positive',
  'negative',
  'neutral',
  'macro',
  'regulatory',
  'institutional',
  'geopolitical',
  'market',
  'high-impact',
]);

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireShare(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be a finite number between 0 and 1`);
  }
  return value;
}

function parseNewsItem(value: unknown, observedAt: number): NewsItem {
  const record = requireRecord(value, 'news item');
  const publishedAt = requireString(record, 'publishedAt');
  const publishedTime = Date.parse(publishedAt);
  if (!Number.isFinite(publishedTime) || publishedTime > observedAt) {
    throw new TypeError('publishedAt must be a valid date-time at or before observedAt');
  }

  const url = requireString(record, 'url');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new TypeError('url must be a valid HTTP or HTTPS URL');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new TypeError('url must be a valid HTTP or HTTPS URL');
  }

  if (!Array.isArray(record.riskTags) || record.riskTags.length === 0) {
    throw new TypeError('riskTags must be a non-empty array');
  }
  const riskTags = record.riskTags.map((tag) => {
    if (typeof tag !== 'string' || !NEWS_RISK_TAGS.has(tag as NewsRiskTag)) {
      throw new TypeError('riskTags contains an unsupported tag');
    }
    return tag as NewsRiskTag;
  });

  return {
    title: requireString(record, 'title'),
    publishedAt,
    url,
    riskTags,
  };
}

export function parseNewsSnapshot(value: unknown): NewsSnapshot {
  const record = requireRecord(value, 'news snapshot');
  const sourceSkill = requireString(record, 'sourceSkill');
  if (sourceSkill !== 'news-briefing') {
    throw new TypeError('sourceSkill must be news-briefing');
  }

  const observedAt = requireString(record, 'observedAt');
  const observedTime = Date.parse(observedAt);
  if (!Number.isFinite(observedTime)) {
    throw new TypeError('observedAt must be a valid date-time');
  }

  if (!Array.isArray(record.items) || record.items.length < 1 || record.items.length > 12) {
    throw new RangeError('items must contain between 1 and 12 entries');
  }
  const riskSignals = requireRecord(record.riskSignals, 'riskSignals');

  return {
    sourceSkill,
    symbol: requireString(record, 'symbol'),
    observedAt,
    items: record.items.map(item => parseNewsItem(item, observedTime)),
    riskSignals: {
      negativeHeadlineShare: requireShare(riskSignals, 'negativeHeadlineShare'),
      highImpactShare: requireShare(riskSignals, 'highImpactShare'),
      regulatoryShare: requireShare(riskSignals, 'regulatoryShare'),
      macroShockShare: requireShare(riskSignals, 'macroShockShare'),
    },
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function buildNewsScenario(snapshot: NewsSnapshot, seed: number): Scenario {
  const signals = snapshot.riskSignals;
  const risk = clamp01(
    signals.negativeHeadlineShare * 0.4
    + signals.highImpactShare * 0.3
    + signals.regulatoryShare * 0.15
    + signals.macroShockShare * 0.15,
  );

  return {
    id: `news-${snapshot.symbol.toLowerCase()}-${seed}`,
    name: 'News catalyst gap',
    dimension: 'news',
    sourceSkill: 'news-briefing',
    sourceObservedAt: snapshot.observedAt,
    narrative: `${snapshot.items.length} 条冻结新闻中，负面占比 ${(signals.negativeHeadlineShare * 100).toFixed(1)}%，高影响占比 ${(signals.highImpactShare * 100).toFixed(1)}%，监管相关占比 ${(signals.regulatoryShare * 100).toFixed(1)}%；场景模拟突发消息形成的跳空风险。`,
    severity: 1 + Math.round(risk * 4),
    shock: {
      kind: 'gap',
      magnitude: round6(0.08 + risk * 0.27),
      durationBars: 1 + Math.round(risk * 11),
      volMult: round6(1.2 + risk * 1.8),
      seed,
    },
  };
}

import { readFileSync } from 'node:fs';
import type { Scenario } from '../contracts.ts';
import {
  buildMacroScenario,
  parseMacroSnapshot,
  type MacroSnapshot,
} from '../redteam/macro.ts';
import {
  buildMarketIntelScenario,
  parseMarketIntelSnapshot,
  type MarketIntelSnapshot,
} from '../redteam/market-intel.ts';
import {
  buildNewsScenario,
  parseNewsSnapshot,
  type NewsSnapshot,
} from '../redteam/news.ts';
import {
  buildSentimentScenario,
  parseSentimentSnapshot,
  type SentimentSnapshot,
} from '../redteam/sentiment.ts';
import {
  buildTechnicalScenario,
  parseTechnicalSnapshot,
  type TechnicalSnapshot,
} from '../redteam/technical.ts';

export interface SnapshotBundle {
  macro: MacroSnapshot;
  marketIntel: MarketIntelSnapshot;
  news: NewsSnapshot;
  sentiment: SentimentSnapshot;
  technical: TechnicalSnapshot;
}

function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, 'utf8'));
}

export function loadDefaultSnapshotBundle(): SnapshotBundle {
  return {
    macro: parseMacroSnapshot(
      readJson(new URL('../../examples/macro-btc.snapshot.json', import.meta.url)),
    ),
    marketIntel: parseMarketIntelSnapshot(
      readJson(
        new URL(
          '../../examples/market-intel-btc.snapshot.json',
          import.meta.url,
        ),
      ),
    ),
    news: parseNewsSnapshot(
      readJson(new URL('../../examples/news-btc.snapshot.json', import.meta.url)),
    ),
    sentiment: parseSentimentSnapshot(
      readJson(
        new URL('../../examples/sentiment-btc.snapshot.json', import.meta.url),
      ),
    ),
    technical: parseTechnicalSnapshot(
      readJson(
        new URL(
          '../../examples/technical-btc-4h.snapshot.json',
          import.meta.url,
        ),
      ),
    ),
  };
}

export function buildBaseScenarioSet(
  bundle: SnapshotBundle,
  seed: number,
): Scenario[] {
  return [
    buildMacroScenario(bundle.macro, seed),
    buildMarketIntelScenario(bundle.marketIntel, seed),
    buildNewsScenario(bundle.news, seed),
    buildSentimentScenario(bundle.sentiment, seed),
    buildTechnicalScenario(bundle.technical, seed),
  ];
}

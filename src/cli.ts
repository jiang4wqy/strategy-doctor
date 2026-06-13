import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type {
  Scenario,
  Strategy,
  StyleName,
} from './contracts.ts';
import { MockBacktester } from './backtest/mock.ts';
import { runDoctor } from './pipeline/doctor.ts';
import {
  buildMacroScenario,
  parseMacroSnapshot,
} from './redteam/macro.ts';
import {
  buildMarketIntelScenario,
  parseMarketIntelSnapshot,
} from './redteam/market-intel.ts';
import {
  buildNewsScenario,
  parseNewsSnapshot,
} from './redteam/news.ts';
import {
  buildSentimentScenario,
  parseSentimentSnapshot,
} from './redteam/sentiment.ts';
import {
  buildTechnicalScenario,
  parseTechnicalSnapshot,
} from './redteam/technical.ts';
import { renderScorecard } from './report/render.ts';

const STYLE_NAMES = new Set<StyleName>([
  'conservative',
  'aggressive',
  'trend',
]);

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
}

function readJson(path: string | URL): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseStyle(value: string): StyleName {
  if (!STYLE_NAMES.has(value as StyleName)) {
    throw new Error(`unknown style: ${value}`);
  }
  return value as StyleName;
}

function parseSeed(value: string): number {
  const seed = Number(value);
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`seed must be a safe integer: ${value}`);
  }
  return seed;
}

export function buildScenarioSet(seed: number): Scenario[] {
  const macro = parseMacroSnapshot(
    readJson(new URL('../examples/macro-btc.snapshot.json', import.meta.url)),
  );
  const marketIntel = parseMarketIntelSnapshot(
    readJson(
      new URL('../examples/market-intel-btc.snapshot.json', import.meta.url),
    ),
  );
  const news = parseNewsSnapshot(
    readJson(new URL('../examples/news-btc.snapshot.json', import.meta.url)),
  );
  const sentiment = parseSentimentSnapshot(
    readJson(new URL('../examples/sentiment-btc.snapshot.json', import.meta.url)),
  );
  const technical = parseTechnicalSnapshot(
    readJson(
      new URL('../examples/technical-btc-4h.snapshot.json', import.meta.url),
    ),
  );

  return [
    buildMacroScenario(macro, seed),
    buildMarketIntelScenario(marketIntel, seed),
    buildNewsScenario(news, seed),
    buildSentimentScenario(sentiment, seed),
    buildTechnicalScenario(technical, seed),
  ];
}

async function main(): Promise<void> {
  const strategyPath = process.argv[2];
  if (!strategyPath) {
    throw new Error(
      '用法: node src/cli.ts <strategy.json> '
      + '[--style conservative|aggressive|trend] [--seed 42]',
    );
  }

  const strategy = readJson(strategyPath) as Strategy;
  const style = parseStyle(argument('style', 'conservative'));
  const treatmentSeed = parseSeed(argument('seed', '42'));
  const heldOutSeed = treatmentSeed + 100000;
  if (!Number.isSafeInteger(heldOutSeed)) {
    throw new Error('held-out seed exceeds the safe integer range');
  }

  const scorecard = await runDoctor(
    strategy,
    new MockBacktester(),
    {
      style,
      treatment: buildScenarioSet(treatmentSeed),
      heldOut: buildScenarioSet(heldOutSeed),
    },
  );

  console.log(renderScorecard(scorecard, strategy));
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Strategy Doctor failed: ${message}`);
    process.exitCode = 1;
  });
}

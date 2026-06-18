import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  Dimension,
  Scorecard,
  StrategyArchetype,
} from '../../src/contracts.ts';
import { parseStrategy } from '../../src/strategy/parse.ts';

const CLI_PATH = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
const EXPECTED_DIMENSIONS: Dimension[] = [
  'macro',
  'market-intel',
  'news',
  'sentiment',
  'technical',
];
const EXPECTED_STYLES = ['aggressive', 'conservative', 'trend'];
const EXAMPLES: {
  path: string;
  archetype: StrategyArchetype;
}[] = [
  {
    path: 'examples/trend-follower.json',
    archetype: 'ma-cross',
  },
  {
    path: 'examples/rsi-bollinger.json',
    archetype: 'rsi-bollinger-mean-reversion',
  },
];

const readRepoText = (relativePath: string): string =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const runCliJson = (relativePath: string): Scorecard => {
  const output = execFileSync(
    process.execPath,
    [
      CLI_PATH,
      fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
      '--style',
      'conservative',
      '--seed',
      '42',
      '--candidates',
      '6',
      '--format',
      'json',
    ],
    { encoding: 'utf8' },
  );
  return JSON.parse(output) as Scorecard;
};

test('public release docs reference executable two-strategy CLI examples', () => {
  for (const docPath of [
    'README.md',
    'docs/DEMO.md',
    'docs/SUBMISSION.md',
  ]) {
    const text = readRepoText(docPath);
    for (const example of EXAMPLES) {
      assert.ok(
        text.includes(example.path),
        `${docPath} should mention ${example.path}`,
      );
    }
  }
});

test('published strategy examples parse and produce complete offline scorecards', () => {
  for (const example of EXAMPLES) {
    const strategy = parseStrategy(
      JSON.parse(readRepoText(example.path)),
    );
    assert.equal(strategy.archetype, example.archetype);

    const scorecard = runCliJson(example.path);
    assert.equal(scorecard.scenarioSetId, 'tx42/ho100042');
    assert.equal(
      scorecard.prescription.patchedStrategy.archetype,
      example.archetype,
    );
    assert.deepEqual(
      Object.keys(scorecard.perStyle).sort(),
      EXPECTED_STYLES,
    );
    assert.deepEqual(
      scorecard.evaluations
        .map(evaluation => evaluation.dimension)
        .sort(),
      EXPECTED_DIMENSIONS,
    );
    assert.ok(Number.isFinite(scorecard.tradeoff.robustnessGain));
    assert.ok(Number.isFinite(scorecard.tradeoff.returnCost));
    assert.ok(scorecard.evaluations.every(evaluation => (
      Number.isFinite(evaluation.metrics.pnlPct)
      && Number.isFinite(evaluation.metrics.maxDrawdownPct)
      && Number.isInteger(evaluation.metrics.numTrades)
      && evaluation.metrics.equityCurve.length > 0
    )));
  }
});

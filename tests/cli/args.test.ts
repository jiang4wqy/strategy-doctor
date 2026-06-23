import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from '../../src/cli/args.ts';

test('parseCliArgs applies offline submission defaults', () => {
  assert.deepEqual(parseCliArgs(['strategy.json']), {
    strategyPath: 'strategy.json',
    style: 'conservative',
    seed: 42,
    candidates: 6,
    backtest: 'mock',
    format: 'markdown',
    help: false,
    trace: false,
  });
});

test('parseCliArgs accepts every supported option', () => {
  assert.deepEqual(parseCliArgs([
    'strategy.json',
    '--style', 'trend',
    '--seed', '-7',
    '--candidates', '12',
    '--backtest', 'bitget',
    '--format', 'json',
    '--output', 'report.json',
    '--trace',
  ]), {
    strategyPath: 'strategy.json',
    style: 'trend',
    seed: -7,
    candidates: 12,
    backtest: 'bitget',
    format: 'json',
    outputPath: 'report.json',
    help: false,
    trace: true,
  });
});

test('parseCliArgs accepts help without a strategy path', () => {
  assert.equal(parseCliArgs(['--help']).help, true);
});

test('parseCliArgs rejects unknown flags, missing values, and invalid ranges', () => {
  for (const args of [
    ['strategy.json', '--unknown'],
    ['strategy.json', '--style'],
    ['strategy.json', '--style', 'balanced'],
    ['strategy.json', '--seed', '1.5'],
    ['strategy.json', '--candidates', '0'],
    ['strategy.json', '--candidates', '51'],
    ['strategy.json', '--backtest', 'live'],
    ['strategy.json', '--format', 'html'],
    ['one.json', 'two.json'],
  ]) {
  assert.throws(() => parseCliArgs(args), /argument|style|seed|candidate|backtest|format/i);
  }
});

test('parseCliArgs rejects a seed whose held-out offset is unsafe', () => {
  assert.throws(
    () => parseCliArgs([
      'strategy.json',
      '--seed',
      String(Number.MAX_SAFE_INTEGER),
    ]),
    /held-out seed/i,
  );
});

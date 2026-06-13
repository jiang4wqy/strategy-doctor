import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('CLI renders the complete offline doctor report', () => {
  const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const strategyPath = fileURLToPath(
    new URL('../examples/trend-follower.json', import.meta.url),
  );
  const output = execFileSync(
    process.execPath,
    [
      cliPath,
      strategyPath,
      '--style',
      'conservative',
      '--seed',
      '42',
    ],
    { encoding: 'utf8' },
  );

  assert.ok(output.includes('策略体检报告'));
  assert.ok(output.includes('五维压力覆盖'));
  assert.ok(output.includes('三风格评分'));
  assert.ok(output.includes('死因清单'));
  assert.ok(output.includes('处方'));
  assert.ok(output.includes('held-out'));
  assert.ok(output.includes('macro'));
  assert.ok(output.includes('market-intel'));
  assert.ok(output.includes('news'));
  assert.ok(output.includes('sentiment'));
  assert.ok(output.includes('technical'));
  assert.ok(output.includes('不承诺'));
});

test('CLI prints help without reading a strategy', () => {
  const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const output = execFileSync(
    process.execPath,
    [cliPath, '--help'],
    { encoding: 'utf8' },
  );

  assert.ok(output.includes('--candidates'));
  assert.ok(output.includes('--backtest'));
  assert.ok(output.includes('--format'));
  assert.ok(output.includes('--output'));
});

test('CLI emits a complete JSON scorecard and writes output files', () => {
  const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const strategyPath = fileURLToPath(
    new URL('../examples/trend-follower.json', import.meta.url),
  );
  const jsonOutput = execFileSync(
    process.execPath,
    [cliPath, strategyPath, '--format', 'json'],
    { encoding: 'utf8' },
  );
  const card = JSON.parse(jsonOutput) as {
    evaluations: unknown[];
    deaths: unknown[];
    prescription: unknown;
    tradeoff: unknown;
  };
  assert.equal(card.evaluations.length, 5);
  assert.ok(Array.isArray(card.deaths));
  assert.ok(card.prescription);
  assert.ok(card.tradeoff);

  const outputPath = join(mkdtempSync(join(tmpdir(), 'strategy-doctor-')), 'report.md');
  execFileSync(
    process.execPath,
    [cliPath, strategyPath, '--output', outputPath],
    { encoding: 'utf8' },
  );
  assert.ok(readFileSync(outputPath, 'utf8').includes('五维压力覆盖'));
});

test('CLI rejects malformed strategies with a non-zero exit code', () => {
  const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      fileURLToPath(new URL('../package.json', import.meta.url)),
    ],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('invalid strategy'));
});

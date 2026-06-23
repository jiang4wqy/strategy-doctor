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

  assert.ok(output.includes('Strategy Doctor diagnosis'));
  assert.ok(output.includes('Five-dimension stress coverage'));
  assert.ok(output.includes('Three-profile risk scores'));
  assert.ok(output.includes('Failure ledger'));
  assert.ok(output.includes('Prescription'));
  assert.ok(output.includes('held-out'));
  assert.ok(output.includes('macro'));
  assert.ok(output.includes('market-intel'));
  assert.ok(output.includes('news'));
  assert.ok(output.includes('sentiment'));
  assert.ok(output.includes('technical'));
  assert.ok(output.includes('does not promise'));
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
  assert.ok(output.includes('--trace'));
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
  assert.ok(
    readFileSync(outputPath, 'utf8').includes(
      'Five-dimension stress coverage',
    ),
  );
});

test('CLI preserves the frozen MA golden JSON output', () => {
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
      '--candidates',
      '6',
      '--format',
      'json',
    ],
    { encoding: 'utf8' },
  );
  const golden = readFileSync(
    new URL('../examples/demo-scorecard.json', import.meta.url),
    'utf8',
  );

  assert.equal(output.trim(), golden.trim());
});

test('CLI completes the full workflow for both registered strategies', () => {
  const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const examples = [
    {
      path: '../examples/trend-follower.json',
      archetype: 'ma-cross',
    },
    {
      path: '../examples/rsi-bollinger.json',
      archetype: 'rsi-bollinger-mean-reversion',
    },
  ];

  for (const example of examples) {
    const output = execFileSync(
      process.execPath,
      [
        cliPath,
        fileURLToPath(new URL(example.path, import.meta.url)),
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
    const card = JSON.parse(output) as {
      perStyle: Record<string, unknown>;
      evaluations: {
        metrics: { numTrades: number };
      }[];
      deaths: { cause: string }[];
      prescription: {
        changes: Record<string, number>;
        patchedStrategy: { archetype: string };
      };
      tradeoff: {
        robustnessGain: number;
        returnCost: number;
      };
    };

    assert.equal(card.evaluations.length, 5);
    assert.deepEqual(
      Object.keys(card.perStyle).sort(),
      ['aggressive', 'conservative', 'trend'],
    );
    assert.equal(
      card.prescription.patchedStrategy.archetype,
      example.archetype,
    );
    assert.ok(Number.isFinite(card.tradeoff.robustnessGain));
    assert.ok(Number.isFinite(card.tradeoff.returnCost));
    if (example.archetype === 'rsi-bollinger-mean-reversion') {
      assert.ok(
        card.evaluations.every(evaluation =>
          evaluation.metrics.numTrades > 0
        ),
      );
      assert.ok(card.deaths.length > 0);
      assert.ok(Object.keys(card.prescription.changes).length > 0);
    }
  }
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

test('CLI emits trace entries when --trace is provided', () => {
  const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const strategyPath = fileURLToPath(
    new URL('../examples/trend-follower.json', import.meta.url),
  );
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      strategyPath,
      '--style',
      'conservative',
      '--seed',
      '42',
      '--candidates',
      '6',
      '--trace',
    ],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0);
  assert.ok(result.stderr.includes('diagnose start:'));
  assert.ok(result.stderr.includes('doctor start strategy='));
});

import { execFileSync } from 'node:child_process';
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

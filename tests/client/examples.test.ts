import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const typescriptUrl = new URL(
  '../../examples/agent-client.ts',
  import.meta.url,
);
const powershellUrl = new URL(
  '../../examples/agent-curl.ps1',
  import.meta.url,
);

test('TypeScript Agent example is short, environment-driven, and supported', async () => {
  const source = await readFile(typescriptUrl, 'utf8');
  const executableLines = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'));

  assert.match(source, /createStrategyDoctor/);
  assert.match(source, /STRATEGY_DOCTOR_URL/);
  assert.match(source, /STRATEGY_DOCTOR_API_KEY/);
  assert.match(source, /RSI.*Bollinger/i);
  assert.ok(executableLines.length <= 15);
  assert.doesNotMatch(source, /sk-ant-|Bearer [A-Za-z0-9_-]{12}/);
});

test('PowerShell Agent example discovers capabilities and diagnoses MA', async () => {
  const source = await readFile(powershellUrl, 'utf8');

  assert.match(source, /\$env:STRATEGY_DOCTOR_URL/);
  assert.match(source, /\$env:STRATEGY_DOCTOR_API_KEY/);
  assert.match(source, /api\/v1\/capabilities/);
  assert.match(source, /api\/v1\/diagnoses/);
  assert.match(source, /"archetype": "ma-cross"/);
  assert.doesNotMatch(source, /sk-ant-|Bearer [A-Za-z0-9_-]{12}/);
});

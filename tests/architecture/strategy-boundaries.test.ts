import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('strategy adapters do not import prescription implementation modules', () => {
  const adaptersDirectory = fileURLToPath(
    new URL('../../src/strategy/adapters/', import.meta.url),
  );

  for (const entry of readdirSync(adaptersDirectory)) {
    if (!entry.endsWith('.ts')) {
      continue;
    }
    const source = readFileSync(`${adaptersDirectory}/${entry}`, 'utf8');
    assert.doesNotMatch(source, /prescribe\//, entry);
  }
});

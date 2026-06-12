import { test } from 'node:test';
import assert from 'node:assert/strict';

test('工具链：Node 原生 TS + node:test 可用', () => {
  const x: number = 1 + 1;
  assert.equal(x, 2);
});

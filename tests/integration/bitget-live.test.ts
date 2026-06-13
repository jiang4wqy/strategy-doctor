import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BitgetBacktester } from '../../src/backtest/bitget.ts';
import { parseStrategy } from '../../src/strategy/parse.ts';
import { readFileSync } from 'node:fs';
import {
  buildBaseScenarioSet,
  loadDefaultSnapshotBundle,
} from '../../src/data/snapshots.ts';

test(
  'live Bitget public-data smoke test',
  { skip: process.env.BITGET_MCP_SMOKE !== '1' },
  async () => {
    const strategy = parseStrategy(JSON.parse(readFileSync(
      new URL('../../examples/trend-follower.json', import.meta.url),
      'utf8',
    )));
    const scenario = buildBaseScenarioSet(
      loadDefaultSnapshotBundle(),
      42,
    )[0];
    const metrics = await new BitgetBacktester().run(strategy, scenario);

    assert.ok(Number.isFinite(metrics.pnlPct));
    assert.ok(Number.isFinite(metrics.maxDrawdownPct));
    assert.ok(metrics.equityCurve.length >= 200);
  },
);

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Scenario, Strategy } from '../../src/contracts.ts';
import {
  applyShockToCandles,
  BitgetBacktester,
  McpBitgetCandleSource,
  parseCandles,
  type Candle,
} from '../../src/backtest/bitget.ts';

const strategy: Strategy = {
  id: 'strategy',
  name: 'strategy',
  archetype: 'ma-cross',
  params: {
    fastMA: 8,
    slowMA: 30,
    leverage: 3,
    stopLossPct: 0.05,
    positionPct: 0.5,
  },
  universe: ['BTCUSDT'],
  timeframe: '4h',
};

const scenario: Scenario = {
  id: 'news-42-c0',
  name: 'news gap',
  dimension: 'news',
  sourceSkill: 'news-briefing',
  narrative: 'test',
  severity: 3,
  shock: {
    kind: 'gap',
    magnitude: 0.2,
    durationBars: 2,
    volMult: 2,
    seed: 42,
  },
};

const candles: Candle[] = Array.from({ length: 240 }, (_, index) => {
  const open = 100 + index * 0.1;
  const close = open + 0.05;
  return {
    timestamp: 1_700_000_000_000 + index * 14_400_000,
    open,
    high: close + 0.2,
    low: open - 0.2,
    close,
    volume: 1000 + index,
  };
});

test('parseCandles validates normalized Bitget OHLCV data', () => {
  assert.deepEqual(parseCandles(candles), candles);
  for (const invalid of [
    [],
    [{ ...candles[0], close: 0 }, ...candles.slice(1)],
    [{ ...candles[0], high: candles[0].low - 1 }, ...candles.slice(1)],
    [{ ...candles[0], timestamp: Number.NaN }, ...candles.slice(1)],
  ]) {
    assert.throws(() => parseCandles(invalid), /candle/i);
  }
});

test('applyShockToCandles is deterministic and preserves OHLC invariants', () => {
  const first = applyShockToCandles(candles, scenario.shock);
  const second = applyShockToCandles(candles, scenario.shock);

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, candles);
  for (const candle of first) {
    assert.ok(candle.high >= Math.max(candle.open, candle.close));
    assert.ok(candle.low <= Math.min(candle.open, candle.close));
    assert.ok(candle.low > 0);
  }
});

test('BitgetBacktester caches 240 public candles and returns deterministic metrics', async () => {
  const calls: unknown[] = [];
  const source = {
    async load(request: unknown) {
      calls.push(request);
      return candles;
    },
  };
  const backtester = new BitgetBacktester(source);

  const first = await backtester.run(strategy, scenario);
  const second = await backtester.run(strategy, scenario);

  assert.deepEqual(first, second);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    symbol: 'BTCUSDT',
    timeframe: '4h',
    limit: 240,
  });
  assert.ok(Number.isFinite(first.pnlPct));
  assert.ok(Number.isFinite(first.maxDrawdownPct));
});

test('BitgetBacktester passes optional candle window controls to the source', async () => {
  const calls: unknown[] = [];
  const source = {
    async load(request: unknown) {
      calls.push(request);
      return candles;
    },
  };
  const backtester = new BitgetBacktester(source);

  await backtester.run({
    ...strategy,
    universe: ['ETHUSDT'],
    timeframe: '1h',
    backtest: {
      source: 'bitget-public',
      candleLimit: 360,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
    },
  }, scenario);

  assert.deepEqual(calls[0], {
    symbol: 'ETHUSDT',
    timeframe: '1h',
    limit: 360,
    startTime: Date.parse('2026-01-01T00:00:00.000Z'),
    endTime: Date.parse('2026-06-01T23:59:59.999Z'),
  });
});

test('McpBitgetCandleSource maps symbols and requests public Bitget klines', async () => {
  let toolName = '';
  let toolArgs: Record<string, unknown> = {};
  const source = new McpBitgetCandleSource({
    async callTool(name: string, args: Record<string, unknown>) {
      toolName = name;
      toolArgs = args;
      return candles;
    },
  });

  const result = await source.load({
    symbol: 'BTCUSDT',
    timeframe: '4h',
    limit: 240,
    startTime: 1_767_225_600_000,
    endTime: 1_780_291_199_999,
  });

  assert.equal(result.length, 240);
  assert.equal(toolName, 'crypto_derivatives');
  assert.deepEqual(toolArgs, {
    action: 'klines',
    exchange: 'bitget',
    symbol: 'BTC/USDT',
    timeframe: '4h',
    limit: 240,
    startTime: 1_767_225_600_000,
    endTime: 1_780_291_199_999,
  });
});

test('Bitget backtests delegate stressed closes through the shared engine', () => {
  const source = readFileSync(
    new URL('../../src/backtest/bitget.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /runStrategyOnPrices/);
  assert.doesNotMatch(source, /strategy\.archetype !== 'ma-cross'/);
});

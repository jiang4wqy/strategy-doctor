import type {
  BacktestAdapter,
  MarketShock,
  Metrics,
  Scenario,
  Strategy,
} from '../contracts.ts';
import { McpClient } from '../data/mcp-client.ts';
import { runOnPrices } from './mock.ts';
import { generatePath } from './path.ts';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleRequest {
  symbol: string;
  timeframe: string;
  limit: number;
}

export interface CandleSource {
  load(request: CandleRequest): Promise<Candle[]>;
}

export interface McpToolCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function parseCandles(value: unknown): Candle[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error('candle data must contain at least two entries');
  }
  return value.map((candidate, index) => {
    if (typeof candidate !== 'object' || candidate === null) {
      throw new Error(`candle ${index} must be an object`);
    }
    const record = candidate as Record<string, unknown>;
    const candle: Candle = {
      timestamp: record.timestamp as number,
      open: record.open as number,
      high: record.high as number,
      low: record.low as number,
      close: record.close as number,
      volume: record.volume as number,
    };
    if (
      !finite(candle.timestamp)
      || !finite(candle.open)
      || !finite(candle.high)
      || !finite(candle.low)
      || !finite(candle.close)
      || !finite(candle.volume)
      || candle.timestamp <= 0
      || candle.open <= 0
      || candle.high <= 0
      || candle.low <= 0
      || candle.close <= 0
      || candle.volume < 0
      || candle.high < Math.max(candle.open, candle.close)
      || candle.low > Math.min(candle.open, candle.close)
    ) {
      throw new Error(`candle ${index} contains invalid OHLCV values`);
    }
    return candle;
  });
}

function marketSymbol(symbol: string): string {
  if (symbol.includes('/')) {
    return symbol;
  }
  if (symbol.endsWith('USDT')) {
    return `${symbol.slice(0, -4)}/USDT`;
  }
  throw new Error(`unsupported Bitget symbol: ${symbol}`);
}

export class McpBitgetCandleSource implements CandleSource {
  private readonly client: McpToolCaller;

  constructor(
    client: McpToolCaller = new McpClient({
      endpoint: process.env.MARKET_DATA_MCP_URL
        ?? 'https://datahub.noxiaohao.com/mcp',
    }),
  ) {
    this.client = client;
  }

  async load(request: CandleRequest): Promise<Candle[]> {
    const result = await this.client.callTool('crypto_derivatives', {
      action: 'klines',
      exchange: 'bitget',
      symbol: marketSymbol(request.symbol),
      timeframe: request.timeframe,
      limit: request.limit,
    });
    return parseCandles(result);
  }
}

export function applyShockToCandles(
  candles: Candle[],
  shock: MarketShock,
): Candle[] {
  const validated = parseCandles(candles);
  const stressed = generatePath(shock, validated.length, 100);
  const baseline = generatePath({
    ...shock,
    kind: 'crash',
    magnitude: 0,
    volMult: 0,
  }, validated.length, 100);

  return validated.map((candle, index) => {
    const factor = Math.max(0.0001, stressed[index] / baseline[index]);
    return {
      ...candle,
      open: candle.open * factor,
      high: candle.high * factor,
      low: candle.low * factor,
      close: candle.close * factor,
    };
  });
}

export class BitgetBacktester implements BacktestAdapter {
  private readonly source: CandleSource;
  private readonly candleCache = new Map<string, Promise<Candle[]>>();

  constructor(source: CandleSource = new McpBitgetCandleSource()) {
    this.source = source;
  }

  async run(strategy: Strategy, scenario: Scenario): Promise<Metrics> {
    if (strategy.archetype !== 'ma-cross') {
      throw new Error(`unsupported strategy archetype: ${strategy.archetype}`);
    }
    const symbol = strategy.universe[0];
    if (!symbol) {
      throw new Error('strategy universe must contain a Bitget symbol');
    }
    const request = {
      symbol,
      timeframe: strategy.timeframe,
      limit: 240,
    };
    const cacheKey = JSON.stringify(request);
    let pending = this.candleCache.get(cacheKey);
    if (!pending) {
      pending = this.source.load(request);
      this.candleCache.set(cacheKey, pending);
    }
    const candles = await pending;
    const stressed = applyShockToCandles(candles, scenario.shock);
    return runOnPrices(
      strategy.params,
      stressed.map(candle => candle.close),
    );
  }
}

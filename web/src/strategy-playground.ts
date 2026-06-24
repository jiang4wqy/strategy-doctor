import type {
  StrategyDraft,
} from './api/types.ts';

export interface StrategyExample {
  label: string;
  description: string;
}

export const strategyExamples: readonly StrategyExample[] = [
  {
    label: 'MA trend',
    description:
      'BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30, leverage 8, stop loss 0.35, position size 0.8',
  },
  {
    label: 'RSI + Bollinger',
    description:
      'BTCUSDT 4h RSI 10 with Bollinger period 14, Bollinger deviation 1.75, oversold 30, overbought 70, trend filter period 30',
  },
  {
    label: 'Defensive swing',
    description:
      'ETHUSDT 4h moving average crossover with fast MA 12, slow MA 48, leverage 3, stop loss 0.18, position size 0.45',
  },
  {
    label: 'Aggressive mean reversion',
    description:
      'BTCUSDT 1h RSI mean reversion using RSI period 8, Bollinger period 20, oversold 25, overbought 75, leverage 5, position size 0.6',
  },
  {
    label: 'SOL breakout guard',
    description:
      'SOLUSDT 1h moving average crossover with fast MA 10, slow MA 36, leverage 6, stop loss 0.22, position size 0.65',
  },
  {
    label: 'XRP range filter',
    description:
      'XRPUSDT 1d RSI Bollinger mean reversion using RSI period 12, Bollinger period 24, oversold 28, overbought 72, trend filter period 55, leverage 2',
  },
  {
    label: 'ETH volatility swing',
    description:
      'ETHUSDT 4h moving average crossover with fast MA 9, slow MA 34, leverage 4, stop loss 0.21, position size 0.5',
  },
  {
    label: 'SOL momentum with RSI guard',
    description:
      'SOLUSDT 4h RSI 11 with Bollinger period 16 and trend filter period 52, oversold 24, overbought 70, leverage 5, stop loss 0.18, position size 0.62',
  },
];

const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
const timeframes = ['1h', '4h', '1d'];

const names = [
  'Random Trend Sentinel',
  'Random Mean-Reversion Guard',
  'Random Drawdown Hunter',
  'Random Volatility Scout',
];

function randomInteger(minimum: number, maximum: number): number {
  return Math.floor(minimum + Math.random() * (maximum - minimum + 1));
}

function randomFloat(
  minimum: number,
  maximum: number,
  decimals: number,
): number {
  return Number(
    (minimum + Math.random() * (maximum - minimum)).toFixed(decimals),
  );
}

export function randomStrategyDraft(): StrategyDraft {
  const id = `random-${Date.now().toString(36)}-${randomInteger(100, 999)}`;
  const name = names[randomInteger(0, names.length - 1)];
  const symbol = symbols[randomInteger(0, symbols.length - 1)];
  const timeframe = timeframes[randomInteger(0, timeframes.length - 1)];
  const useMeanReversion = Math.random() > 0.5;
  if (useMeanReversion) {
    const bollingerPeriod = randomInteger(12, 24);
    return {
      strategy: {
        id,
        name,
        archetype: 'rsi-bollinger-mean-reversion',
        params: {
          rsiPeriod: randomInteger(7, 14),
          rsiOversold: randomInteger(20, 35),
          rsiOverbought: randomInteger(65, 82),
          bollingerPeriod,
          bollingerStdDev: randomFloat(1.4, 2.4, 2),
          trendFilterPeriod: randomInteger(bollingerPeriod + 8, 60),
          trendFilterThreshold: randomFloat(0.03, 0.12, 3),
          leverage: randomInteger(2, 8),
          stopLossPct: randomFloat(0.05, 0.28, 3),
          positionPct: randomFloat(0.35, 0.85, 2),
        },
        universe: [symbol],
        timeframe,
      },
      source: 'rules',
      confidence: 0.72,
      assumptions: [{
        field: 'strategy.universe',
        value: symbol,
        reason: 'market-default',
      }],
      warnings: [{
        code: 'LOW_CONFIDENCE',
        message:
          'Random strategy generated for exploration; review every field before diagnosis.',
      }],
    };
  }

  const fastMA = randomInteger(5, 18);
  return {
    strategy: {
      id,
      name,
      archetype: 'ma-cross',
      params: {
        fastMA,
        slowMA: randomInteger(fastMA + 12, fastMA + 54),
        leverage: randomInteger(2, 12),
        stopLossPct: randomFloat(0.08, 0.4, 3),
        positionPct: randomFloat(0.3, 0.95, 2),
      },
      universe: [symbol],
      timeframe,
    },
    source: 'rules',
    confidence: 0.72,
    assumptions: [{
      field: 'strategy.universe',
      value: symbol,
      reason: 'market-default',
    }],
    warnings: [{
      code: 'LOW_CONFIDENCE',
      message:
        'Random strategy generated for exploration; review every field before diagnosis.',
    }],
  };
}

export const symbolFirstTradeDate: Readonly<Record<string, string>> = {
  BTCUSDT: '2009-01-03',
  ETHUSDT: '2015-07-30',
  SOLUSDT: '2017-12-01',
  XRPUSDT: '2012-01-01',
  DOGEUSDT: '2013-12-06',
};

export const FALLBACK_SYMBOL_FIRST_TRADE_DATE = '2009-01-03';

export const availableTradeSymbols = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
] as const;

export type TradeSymbol = (typeof availableTradeSymbols)[number];

export function getSymbolFirstTradeDate(symbol: string): string {
  return symbolFirstTradeDate[symbol] ?? FALLBACK_SYMBOL_FIRST_TRADE_DATE;
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isDateBefore(value: string, bound: string): boolean {
  return Date.parse(`${value}T00:00:00.000Z`) < Date.parse(`${bound}T00:00:00.000Z`);
}

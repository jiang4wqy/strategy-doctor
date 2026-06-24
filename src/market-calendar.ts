export const symbolFirstTradeDate: Readonly<Record<string, string>> = {
  BTCUSDT: '2009-01-03',
  ETHUSDT: '2015-07-30',
  SOLUSDT: '2017-12-01',
  XRPUSDT: '2012-01-01',
  DOGEUSDT: '2013-12-06',
};

export const FALLBACK_SYMBOL_FIRST_TRADE_DATE = '2010-01-01';

export function getSymbolFirstTradeDate(symbol: string): string {
  return symbolFirstTradeDate[symbol] ?? FALLBACK_SYMBOL_FIRST_TRADE_DATE;
}

export function isDateBefore(value: string, bound: string): boolean {
  return Date.parse(`${value}T00:00:00.000Z`) < Date.parse(`${bound}T00:00:00.000Z`);
}

export function isDateInFuture(value: string, now = Date.now()): boolean {
  return Date.parse(`${value}T23:59:59.999Z`) > now;
}

# Backtest Adapters

Shared interface:

```ts
BacktestAdapter.run(strategy, scenario): Promise<Metrics>
```

- `path.ts` owns seeded randomness and deterministic shock paths.
- `mock.ts` provides offline backtesting with leverage, stop-loss, and liquidation behavior.
- `bitget.ts` reads public Bitget candles, caches requests, applies OHLC shocks, and reuses the shared execution path.

The default CLI and Web/API flows use the mock adapter. The Bitget adapter reads public market data only; it does not access accounts, private keys, balances, positions, or orders.

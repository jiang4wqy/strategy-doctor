# backtest

Core interface: `BacktestAdapter.run(strategy, scenario) -> Promise<Metrics>`.

- `path.ts`: seed RNG and deterministic shock routing.
- `mock.ts`: offline MA-cross simulation with leverage, stop-loss, and liquidation.
- `bitget.ts`: public Bitget k-lines, request cache, OHLC shock overlay, and local simulation.

Default CLI uses Mock adapter. The Bitget adapter reads no account key, does not place trades.
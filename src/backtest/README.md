# backtest

统一接口：`BacktestAdapter.run(strategy, scenario) -> Promise<Metrics>`。

- `path.ts`：seed RNG 和确定性 shock 路径。
- `mock.ts`：离线 MA-cross 回测、杠杆、止损和清算。
- `bitget.ts`：公开 Bitget K 线、请求缓存、OHLC shock 叠加和本地回测。

默认 CLI 使用 Mock。Bitget adapter 不读取账户、不使用私有 key、不执行交易。

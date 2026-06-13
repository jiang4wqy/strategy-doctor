# Bitget 公共数据接入记录

验证日期：2026-06-13。

## 决策

未采用猜测的 `npx bitget-hub candles` 命令。当前可靠路径是官方公开 market-data MCP：

```text
https://datahub.noxiaohao.com/mcp
```

它提供公开 Bitget K 线和五维市场数据，不需要 Bitget API key。项目实现最小 Streamable HTTP client，仅支持：

1. `initialize`
2. `notifications/initialized`
3. `tools/call`

client 支持 JSON/SSE、session header、超时和并发 single-flight 初始化。

## Bitget K 线

工具调用：

```json
{
  "name": "crypto_derivatives",
  "arguments": {
    "action": "klines",
    "exchange": "bitget",
    "symbol": "BTC/USDT",
    "timeframe": "4h",
    "limit": 240
  }
}
```

归一化条目：

```json
{
  "timestamp": 1781323200000,
  "open": 63532,
  "high": 63568.11,
  "low": 63502.6,
  "close": 63526.26,
  "volume": 28.27464
}
```

`BitgetBacktester` 对相同 symbol/timeframe 只获取一次 K 线。shock 使用同一比例缩放一根 candle 的 OHLC，保持 OHLC 不变量，再复用 `runOnPrices`。

## 五维刷新

| 维度 | MCP 工具 |
|---|---|
| Macro | `rates_yields`、`global_assets`、`cross_asset` |
| Market Intel | `crypto_market`、`defi_analytics`、`derivatives_sentiment` |
| News | `news_feed` |
| Sentiment | `sentiment_index`、`derivatives_sentiment` |
| Technical | `crypto_derivatives` 的 200 根 Bitget 4h K 线 |

已处理的真实边界：

- `cross_asset` 可能返回裸 `NaN`。
- stablecoin 大响应只在内存中聚合 `peggedUSD`。
- 缺失历史供应时回退当前供应，避免制造虚假变化。
- 新闻源可能返回错误或空 link，无效条目会过滤。
- taker ratio 转换为 `buyVol / (buyVol + sellVol)`。
- 技术指标在本地计算。

## 验证

```powershell
npm.cmd run snapshots:refresh
$env:BITGET_MCP_SMOKE='1'
node --test tests/integration/bitget-live.test.ts
npm.cmd run demo:live
```

安全结论：没有账户端点、私有凭证或下单调用。

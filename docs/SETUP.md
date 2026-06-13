# 环境与运行

## 必需环境

| 依赖 | 版本 | 用途 |
|---|---|---|
| Node.js | 24 或更高 | 原生执行 TypeScript、测试和 CLI |
| npm | Node 随附版本 | 安装 TypeScript 开发依赖 |

项目不需要 Python、数据库、Docker 或 Bitget 私有凭证。

```powershell
git clone https://github.com/jiang4wqy/strategy-doctor.git
Set-Location strategy-doctor
npm.cmd ci
npm.cmd run verify
```

Node 原生 TypeScript 使用 strip-only 模式：

- 相对 import 必须带 `.ts`。
- 不使用 `enum`、`namespace`、constructor parameter property 等需转译语法。

## 默认离线演示

```powershell
npm.cmd run demo
npm.cmd run demo:json
```

默认流程只读取冻结快照，使用 `MockBacktester`，不会访问网络。

```powershell
node src/cli.ts examples/trend-follower.json `
  --style trend `
  --seed 7 `
  --candidates 12 `
  --format markdown `
  --output report.md
```

## Bitget 公共数据

公开 market-data MCP：

```text
https://datahub.noxiaohao.com/mcp
```

在线 demo 和 smoke：

```powershell
npm.cmd run demo:live
$env:BITGET_MCP_SMOKE='1'
node --test tests/integration/bitget-live.test.ts
```

可通过 `MARKET_DATA_MCP_URL` 覆盖 endpoint。系统只调用公开行情工具。

## 刷新五维快照

```powershell
npm.cmd run snapshots:refresh
```

- Macro：利率、DXY、VIX、BTC 跨资产相关性。
- Market Intel：总市值、BTC dominance、稳定币、OI、大户多头占比。
- News：最多 12 条标题、时间、URL 和风险标签。
- Sentiment：恐惧贪婪、多空账户、大户仓位和 taker buy share。
- Technical：200 根 Bitget 4h K 线，本地计算 RSI、DMI/ADX、Bollinger bandwidth 和交叉次数。

所有远端响应先标准化并通过 parser；任一采集失败时不写入半套快照。

## 可选 Anthropic 叙事

```powershell
$env:DOCTOR_LLM_NARRATE='1'
$env:ANTHROPIC_API_KEY='<your-key>'
$env:DOCTOR_LLM_MODEL='<available-model-id>'
npm.cmd run demo
```

默认关闭。任何配置缺失、超时或响应错误都会回退本地模板。不要把 key 写入仓库。

## 开发命令

```powershell
npm.cmd test
npm.cmd run test:coverage
npm.cmd run typecheck
npm.cmd run verify
git diff --check
```

覆盖率门槛：lines 90%、branches 80%、functions 95%。

## 常见问题

### PowerShell 阻止 `npm.ps1`

使用 `npm.cmd`。

### MCP 返回 406

不要直接 GET endpoint。它要求 Streamable HTTP JSON-RPC POST，并接受 JSON/SSE。

### 在线模式失败

先运行离线 `npm.cmd run demo`，再检查网络和 `MARKET_DATA_MCP_URL`。在线失败不影响默认 demo、测试或 CI。

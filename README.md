# Strategy Doctor

> 别人生成交易策略，我们负责找出它最可能怎样失败，并验证修补是否真的更稳。

Strategy Doctor 是 Bitget AI Base Camp Hackathon Track 2 的策略诊断基础设施。它把结构化策略放入五维确定性压力场景，找出每个维度的最坏结果，解释死因，给出参数处方，再使用独立 held-out 场景复测。

P1 同时提供 CLI、受保护的 Web 工作台、REST API 和 TypeScript Client。Web/API 默认使用离线 `MockBacktester`，不读取交易账户、余额、持仓或私有 Bitget 凭证，也不提交订单。

Submission reviewers can open the no-login showcase route after starting the
service:

```text
http://127.0.0.1:8080/showcase
```

## 1 分钟评审路径

1. 打开 `http://127.0.0.1:8080/showcase`，先看四种策略在同一风险契约下的部署状态。
2. 进入受保护工作台，点击 `ATR Trend Breakout` 模板，确认参数后运行诊断。
3. 查看第一屏 verdict、Before/After 修复对比、五维压力图表和开发者复现面板。

## 核心能力

- 五维压力测试：`macro`、`market-intel`、`news`、`sentiment`、`technical`
- 四种已验证策略：`ma-cross`、`rsi-bollinger-mean-reversion`、`breakout-confirmation`、`atr-trend-breakout`
- 自然语言描述转为可确认、可编辑的结构化策略草稿
- 三种风险风格评分、死因诊断、定向参数处方和 held-out 复测
- 能力发现、OpenAPI、统一错误 envelope、请求 ID
- 默认离线、确定性、可复现；在线 Bitget 公共数据和 Anthropic 均为显式可选

```mermaid
flowchart LR
  A["Natural language or strategy JSON"] --> B["Capability validation"]
  B --> C["Five stress dimensions"]
  C --> D["Seeded candidate search"]
  D --> E["Worst scenario diagnosis"]
  E --> F["Risk scores and prescription"]
  F --> G["Independent held-out validation"]
  G --> H["Web, REST, TypeScript, or CLI result"]
```

## 要求

- Node.js 24 或更高版本
- npm

```powershell
npm.cmd ci
npm.cmd run verify
```

`verify` 运行核心覆盖率门槛、完整 TypeScript 检查和离线 CLI demo。覆盖率门槛为 lines 90%、branches 80%、functions 95%。

## 四种快速开始

### 1. CLI

```powershell
npm.cmd run demo
```

等价的显式 MA 趋势跟随命令：

```powershell
node src/cli.ts examples/trend-follower.json `
  --style conservative `
  --seed 42 `
  --candidates 6
```

RSI/Bollinger 均值回归示例：

```powershell
node src/cli.ts examples/rsi-bollinger.json `
  --style conservative `
  --seed 42 `
  --candidates 6
```

Confirmed breakout example:

```powershell
node src/cli.ts examples/breakout-confirmation.json `
  --style conservative `
  --seed 42 `
  --candidates 6
```

ATR trend breakout example:

```powershell
node src/cli.ts examples/atr-trend-breakout.json `
  --style conservative `
  --seed 42 `
  --candidates 6
```

### 2. Web

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-preview-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-this-with-a-random-32-char-secret'
$env:DOCTOR_API_KEYS='replace-this-with-a-private-agent-key'
npm.cmd run web
```

打开 `http://127.0.0.1:8080`，输入 access code，然后描述、确认并诊断策略。

### 3. REST

保持 Web/API 进程运行，在另一个 PowerShell 终端执行：

```powershell
$headers = @{
  Authorization = 'Bearer replace-this-with-a-private-agent-key'
}
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:8080/api/v1/capabilities' `
  -Headers $headers
```

完整请求示例见 [API 文档](docs/API.md) 和 `examples/agent-curl.ps1`。

### 4. TypeScript

保持 Web/API 进程运行：

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='replace-this-with-a-private-agent-key'
node examples/agent-client.ts
```

## 团队临时分享

本地服务默认只监听 `127.0.0.1`。需要让队友临时访问时，可保持服务运行并新开终端：

```powershell
cloudflared tunnel --url http://localhost:8080
```

把生成的 `trycloudflare.com` URL 发给队友，并通过私密渠道单独发送 Web access code。Agent 调用者还需要私密 API key。

Quick Tunnel 只适合 demo 和测试：终端与服务必须持续运行，重启后 URL 会变化，不应当作永久生产部署。详细步骤见 [环境与团队分享](docs/SETUP.md)。

## API 入口

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/v1/health` | 无认证健康检查 |
| `POST` | `/api/v1/auth` | Web access code 登录 |
| `DELETE` | `/api/v1/auth` | 清除 Web 会话 |
| `GET` | `/api/v1/capabilities` | 获取封闭策略能力定义 |
| `POST` | `/api/v1/strategies/parse` | 将自然语言解析为策略草稿 |
| `POST` | `/api/v1/diagnoses` | 执行五维策略诊断 |
| `GET` | `/api/v1/openapi.json` | 获取 OpenAPI 3.0 文档 |

除健康检查外，API 需要 Bearer key 或有效浏览器会话。

## 策略边界

| Archetype | 行为 | 主要专属参数 |
|---|---|---|
| `ma-cross` | 快慢均线交叉趋势跟随 | `fastMA`、`slowMA` |
| `rsi-bollinger-mean-reversion` | RSI + Bollinger 均值回归，并用趋势过滤器避免强趋势逆势入场 | RSI、Bollinger、趋势过滤参数 |
| `breakout-confirmation` | Confirmed range breakout with volatility gate and invalidation exit | Breakout lookback、confirmation、volatility gate |
| `atr-trend-breakout` | Volatility-aware trend breakout with ATR-sized invalidation and trend filter | ATR period、breakout lookback、ATR stop multiple |

客户端应从 `/api/v1/capabilities` 读取参数定义，不要自行维护第二份参数元数据。P1 不提供任意策略 DSL 或动态插件。

## 离线与可选在线能力

| 模式 | 命令 | 网络 | 私有交易凭证 |
|---|---|---:|---:|
| 离线 CLI | `npm.cmd run demo` | 否 | 不需要 |
| Web/API | `npm.cmd run web` | 否 | 不需要 |
| Bitget 公共 K 线 | `npm.cmd run demo:live` | 是 | 不需要 |
| 刷新公开快照 | `npm.cmd run snapshots:refresh` | 是 | 不需要 |
| Anthropic 增强 | 见 `docs/SETUP.md` | 是 | 仅 Anthropic key |

默认 CI、CLI、Web 和 API 不调用 Bitget 在线服务或 Anthropic。

## 安全边界

- 不包含下单、账户、余额、持仓或资金操作。
- 不需要也不接受 Bitget API key、secret 或 passphrase。
- Web access code 与 API key 只用于保护临时诊断服务，不是交易凭证。
- `MockBacktester` 不模拟手续费、滑点、资金费率、延迟或订单簿成交。
- 诊断和处方是风险分析，不是投资建议或收益保证。

## 文档

- [安装、环境变量与团队分享](docs/SETUP.md)
- [REST 与 TypeScript API](docs/API.md)
- [三分钟演示脚本](docs/DEMO.md)
- [Hackathon 提交说明](docs/SUBMISSION.md)
- [提交表单草稿](docs/SUBMISSION_FORM.md)
- [提交证据包](docs/SUBMISSION_EVIDENCE.md)
- [Bitget Playbook 证据](docs/PLAYBOOK_EVIDENCE.md)
- [团队协作规范](docs/TEAM.md)
- [本轮协作变更日志](docs/WORK_LOG.md)

## License

MIT，见 [LICENSE](LICENSE)。

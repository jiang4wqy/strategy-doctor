# Strategy Doctor API v1

Strategy Doctor 对已注册交易策略执行确定性的五维对抗诊断。P1 支持：

- `ma-cross`
- `rsi-bollinger-mean-reversion`

公共 Web/API 默认使用离线 `MockBacktester`。它不读取账户、余额、持仓或私有
凭证，也不提交订单。

## 启动与认证

设置本地预览变量：

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-with-at-least-32-random-characters'
$env:DOCTOR_API_KEYS='replace-with-a-private-agent-key'
npm.cmd run web
```

Agent 和开发者使用 Bearer key：

```text
Authorization: Bearer <DOCTOR_API_KEYS 中的一项>
```

浏览器向 `POST /api/v1/auth` 提交 access code，服务返回签名、
HttpOnly、SameSite=Lax cookie。`DELETE /api/v1/auth` 清除会话。

除 `GET /api/v1/health` 外，所有接口都需要 Bearer key 或有效浏览器会话。

## 通用 Envelope

成功：

```json
{
  "apiVersion": "v1",
  "requestId": "req_...",
  "data": {}
}
```

失败：

```json
{
  "apiVersion": "v1",
  "requestId": "req_...",
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request body does not match the API contract.",
    "field": "strategy.timeframe",
    "retryable": false
  }
}
```

稳定错误码包括：

```text
AUTH_REQUIRED
AUTH_INVALID
RATE_LIMITED
SERVER_BUSY
INVALID_REQUEST
AMBIGUOUS_DESCRIPTION
UNSUPPORTED_STRATEGY_DESCRIPTION
UNSUPPORTED_ARCHETYPE
MULTI_SYMBOL_UNSUPPORTED
UNSUPPORTED_SYMBOL
UNSUPPORTED_TIMEFRAME
DIAGNOSIS_FAILED
```

## 发现能力

```http
GET /api/v1/capabilities
```

返回两个 strategy definitions，包括参数 label、类型、默认值、最小/最大值和
排他边界。客户端应从该接口生成参数表单，不要维护第二份参数元数据。

PowerShell：

```powershell
$headers = @{ Authorization = "Bearer $env:STRATEGY_DOCTOR_API_KEY" }
Invoke-RestMethod `
  -Uri "$env:STRATEGY_DOCTOR_URL/api/v1/capabilities" `
  -Headers $headers
```

## 解析自然语言

```http
POST /api/v1/strategies/parse
Content-Type: application/json
```

```json
{
  "description": "BTC 四小时 RSI 10 配合布林带 14，趋势过滤周期 30"
}
```

返回 `StrategyDraft`：

- `strategy`：经过 runtime parser 校验的结构化策略。
- `source`：`rules` 或可选的 `anthropic`。
- `confidence`：解析置信度。
- `assumptions`：未在描述中明确给出、由市场或 registry 默认补齐的字段。
- `warnings`：低置信度或 AI fallback 失败等提示。

解析不会自动运行诊断。用户或 Agent 必须检查 assumptions、修改所需参数，
然后显式提交最终结构化策略。这是强制 confirmation boundary。

## 提交诊断

```http
POST /api/v1/diagnoses
Content-Type: application/json
```

```json
{
  "strategy": {
    "id": "agent-ma-001",
    "name": "Agent moving-average strategy",
    "archetype": "ma-cross",
    "params": {
      "fastMA": 8,
      "slowMA": 30,
      "leverage": 5,
      "stopLossPct": 0.1,
      "positionPct": 0.6
    },
    "universe": ["BTCUSDT"],
    "timeframe": "1h"
  },
  "style": "conservative",
  "seed": 42,
  "candidates": 6
}
```

相同 strategy、style、seed、candidates 与冻结数据会产生确定性结果。诊断响应
是 `DiagnosisView`，包含旧 `Scorecard`、摘要和前端可直接绘制的 chart data。

摘要使用 `returnDelta`。嵌入的旧 Scorecard 为保持 CLI/JSON 兼容，仍使用：

```text
scorecard.tradeoff.returnCost
```

两者数值相同，只是 API 摘要使用更清晰的新名称。负值表示 held-out 平均收益
下降；不要把处方描述为保证改善。

## TypeScript Client

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='your-private-agent-key'
node examples/agent-client.ts
```

核心调用：

```ts
import { createStrategyDoctor } from './src/client/index.ts';

const doctor = createStrategyDoctor({
  baseUrl: process.env.STRATEGY_DOCTOR_URL!,
  apiKey: process.env.STRATEGY_DOCTOR_API_KEY!,
});
const capabilities = await doctor.capabilities();
const draft = await doctor.parseStrategy({
  description: 'BTC 4h RSI and Bollinger mean reversion',
});
const result = await doctor.diagnose({
  strategy: draft.strategy,
  style: 'conservative',
  seed: 42,
  candidates: 6,
});
```

Client 不自动重试。`RATE_LIMITED` 和 `SERVER_BUSY` 可根据
`StrategyDoctorApiError.retryable` 由调用方决定退避策略。

## 四条五分钟路径

### Web 用户

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-with-at-least-32-random-characters'
$env:DOCTOR_API_KEYS='replace-with-a-private-agent-key'
npm.cmd run web
```

打开 `http://127.0.0.1:8080`，输入 access code，描述策略，确认结构化参数，
再运行诊断。

### REST / PowerShell

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='your-private-agent-key'
.\examples\agent-curl.ps1
```

### TypeScript

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='your-private-agent-key'
node examples/agent-client.ts
```

### 现有 CLI

```powershell
npm.cmd run demo
node src/cli.ts examples/rsi-bollinger.json `
  --style conservative --seed 42 --candidates 6
```

CLI 不需要启动 API，也不需要 AI key。

## OpenAPI

服务启动后使用 Bearer key访问：

```text
GET /api/v1/openapi.json
```

本地完整地址：

```text
http://127.0.0.1:8080/api/v1/openapi.json
```

## P1 限制

- 只支持单一 `*USDT` symbol。
- 只支持 `1h`、`4h`、`1d`。
- 只支持两种已注册 archetype。
- API/Web 只使用离线 `MockBacktester`。
- 不建数据库，浏览器历史只保存在本地。
- 不模拟手续费、滑点、funding、延迟或订单簿成交。
- 诊断和处方不是收益保证。

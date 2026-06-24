# Strategy Doctor API v1

Strategy Doctor exposes deterministic five-dimension diagnosis for two registered strategy archetypes:

- `ma-cross`
- `rsi-bollinger-mean-reversion`

The public Web/API uses offline `MockBacktester` by default. It can also route
an explicit diagnosis to public Bitget candles. It does not read account data or
private Bitget credentials and cannot submit orders.

Diagnoses are one-symbol runs. Supported timeframes are `1h`, `4h`, and `1d`.
Optional `strategy.backtest` controls the dataset:

```json
{
  "source": "offline-synthetic",
  "candleLimit": 240,
  "startDate": "2026-01-01",
  "endDate": "2026-06-01"
}
```

`source` can be `offline-synthetic` or `bitget-public`. `candleLimit` must be
an integer from 50 to 1000. Dates are optional `YYYY-MM-DD` values. Selecting
`bitget-public` uses public market data before applying the same stress tests
and risk engine.

Optional `strategy.execution` controls explicit trading-cost assumptions:

```json
{
  "feeRatePct": 0.0006,
  "slippagePct": 0.0005
}
```

Both values are decimal rates from 0 to 0.02. When omitted, the engine uses
zero-cost execution for backward-compatible deterministic baselines.

## Start the service

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-preview-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-this-with-a-random-32-char-secret'
$env:DOCTOR_API_KEYS='replace-this-with-a-private-agent-key'
npm.cmd run web
```

Base URL:

```text
http://127.0.0.1:8080
```

## Authentication

### Agent and script

```http
Authorization: Bearer replace-this-with-a-private-agent-key
```

`DOCTOR_API_KEYS` accepts one or more comma-separated keys.

### Browser

The Web client posts the access code to `POST /api/v1/auth`. A successful login creates a signed, HttpOnly, SameSite=Lax session cookie. `DELETE /api/v1/auth` clears it.

`GET /api/v1/health` is public. All capability, parsing, diagnosis, and OpenAPI routes require a Bearer key or valid browser session.

## Common envelope

Success:

```json
{
  "apiVersion": "v1",
  "requestId": "req_...",
  "data": {}
}
```

Failure:

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

Stable error codes:

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

Clients should log `requestId`. They may retry only when `retryable` is `true`.

## Health

```http
GET /api/v1/health
```

No authentication required.

## Discover capabilities

```http
GET /api/v1/capabilities
Authorization: Bearer <key>
```

The response contains closed strategy definitions, including parameter labels, types, defaults, bounds, and exclusive bounds. Clients should generate forms and validation hints from this endpoint rather than maintain duplicate metadata.

PowerShell:

```powershell
$headers = @{
  Authorization = "Bearer $env:STRATEGY_DOCTOR_API_KEY"
}
Invoke-RestMethod `
  -Uri "$env:STRATEGY_DOCTOR_URL/api/v1/capabilities" `
  -Headers $headers
```

## Parse a natural-language strategy

```http
POST /api/v1/strategies/parse
Authorization: Bearer <key>
Content-Type: application/json
```

```json
{
  "description": "BTC 四小时 RSI 10 配合布林带 14，趋势过滤周期 30"
}
```

The response data is a `StrategyDraft`:

- `strategy`: runtime-validated structured strategy
- `source`: `rules` or optional `anthropic`
- `confidence`: parser confidence
- `assumptions`: values inferred from market or registry defaults
- `warnings`: low-confidence or fallback information

Parsing never starts a diagnosis. The user or Agent must inspect assumptions, edit parameters if necessary, and explicitly submit the final structured strategy. Descriptions longer than 2,000 characters are rejected.

Local rules are the default. Optional Anthropic fallback requires all three variables:

```powershell
$env:DOCTOR_NL_AI_ENABLED='1'
$env:ANTHROPIC_API_KEY='<your-key>'
$env:DOCTOR_NL_MODEL='<available-model-id>'
```

CI and the default service do not enable the fallback.

## Open-source model strategy review

Every diagnosis includes `strategyReview`. By default it uses the deterministic
local rule reviewer. To call Tongyi Qianwen/Qwen through DashScope's
OpenAI-compatible API:

```powershell
$env:DOCTOR_REVIEW_ENABLED='1'
$env:DASHSCOPE_API_KEY='<your-dashscope-key>'
$env:DOCTOR_REVIEW_MODEL='qwen-plus'
```

Default compatible endpoint:

```text
https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

For local open-source deployments such as vLLM, Ollama OpenAI-compatible mode,
or LM Studio, override:

```powershell
$env:DOCTOR_REVIEW_BASE_URL='http://127.0.0.1:8000/v1'
$env:DOCTOR_REVIEW_MODEL='Qwen3-8B'
$env:DOCTOR_REVIEW_API_KEY='local-dev-key'
```

The reviewer is advisory. It never places orders and falls back to local rules
when the remote model is unavailable.

Notes:

- DashScope/Qwen is a direct hosted API call.
- `DOCTOR_REVIEW_BASE_URL` is optional for DashScope because Strategy Doctor
  defaults to the official compatible endpoint above.
- Use `DOCTOR_REVIEW_BASE_URL` only when switching to a local or third-party
  OpenAI-compatible model server.

## Research platform endpoints

```http
GET /api/v1/factors
GET /api/v1/notebooks
GET /api/v1/multi-factor-framework
POST /api/v1/paper/signals
```

These endpoints expose the AI factor library, Notebook templates, multi-factor
research framework, and read-only paper signal tracking lane.

## Run a diagnosis

```http
POST /api/v1/diagnoses
Authorization: Bearer <key>
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
    "timeframe": "1h",
    "backtest": {
      "source": "offline-synthetic",
      "candleLimit": 240
    },
    "execution": {
      "feeRatePct": 0.0006,
      "slippagePct": 0.0005
    }
  },
  "style": "conservative",
  "seed": 42,
  "candidates": 6
}
```

The response data is a `DiagnosisView` containing:

- the complete `Scorecard`
- summary values for the selected style
- five scenario evaluations
- death diagnoses and prescription
- held-out risk/return comparison
- chart-ready series for the Web client

For the same strategy, style, seed, candidate count, and frozen snapshots, the result is deterministic.

The API summary calls the held-out return change `returnDelta`. The embedded legacy Scorecard retains `scorecard.tradeoff.returnCost` for CLI/JSON compatibility; both fields carry the same numeric value. A negative value means held-out average return decreased.

## OpenAPI

```http
GET /api/v1/openapi.json
Authorization: Bearer <key>
```

Local URL:

```text
http://127.0.0.1:8080/api/v1/openapi.json
```

## TypeScript Client

Run the complete example:

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='replace-this-with-a-private-agent-key'
node examples/agent-client.ts
```

Core usage:

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

The Client does not automatically retry. For `RATE_LIMITED` and `SERVER_BUSY`, callers can inspect `StrategyDoctorApiError.retryable` and apply their own bounded backoff.

## Copy-ready REST workflow

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='replace-this-with-a-private-agent-key'
.\examples\agent-curl.ps1
```

## Remote access URL

Keep the local service running and start:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Use the generated `trycloudflare.com` URL as `STRATEGY_DOCTOR_URL` for quick manual checks.

The URL changes after each restart.

For a durable address suitable for judges or long-running demos, use
`docs/DEPLOY_PUBLIC.md` (Render/Railway/custom domain guidance).

## P1 limits

- One `*USDT` symbol per diagnosis
- Timeframes: `1h`, `4h`, `1d`
- Two registered archetypes only
- Offline `MockBacktester` by default, with optional public Bitget candles
- No database; browser history stays local
- Explicit fee and slippage rates are supported
- No funding, latency, or order-book fill model
- Diagnosis and prescription are not a return guarantee

## Extension path

New strategy support is added through a validated `StrategyAdapter` and capability definition. The thin MCP adapter calls this REST/TypeScript layer and exposes capability discovery, parsing, and diagnosis without duplicating core logic.

---

## MCP Adapter

The MCP server exposes Strategy Doctor as a stdio-based MCP tool server. Any MCP-compatible AI agent (Claude Code, Cursor, etc.) can call it.

### Prerequisites

The MCP server requires the same backend as the Web/API service:

```powershell
npm.cmd run web
```

In a separate terminal:

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='replace-this-with-a-private-agent-key'
npm.cmd run mcp
```

### Agent configuration

```json
{
  "mcpServers": {
    "strategy-doctor": {
      "command": "npm.cmd",
      "args": ["run", "mcp"],
      "cwd": "C:\\path\\to\\strategy-doctor",
      "env": {
        "STRATEGY_DOCTOR_URL": "http://127.0.0.1:8080",
        "STRATEGY_DOCTOR_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

### Available tools

| Tool | Description | Input |
|---|---|---|
| `list_strategy_capabilities` | List supported strategy types and parameter definitions | None |
| `parse_strategy_description` | Convert natural-language strategy description to structured JSON | `description` (1–2000 chars) |
| `diagnose_strategy` | Run five-dimension adversarial diagnosis | `strategy` (JSON string), `style`, `seed` (default 42), `candidates` (default 6) |

### Example workflow

```
Agent: "Parse a BTC 4h RSI Bollinger mean reversion"
→ calls parse_strategy_description

Agent: "Diagnose this strategy with conservative style"
→ calls diagnose_strategy

Agent: "What strategies do you support?"
→ calls list_strategy_capabilities
```

### Architecture boundary

```text
Agent / MCP Client
    │  stdio JSON-RPC
    ▼
src/mcp/server.ts      ←  transport, tool routing
    │
    ▼
src/mcp/tools.ts       ←  tool definitions, Zod validation
    │
    ▼
src/client/index.ts    ←  HTTP + Bearer (REST API)
    │
    ▼
Fastify REST API
    │
    ▼
Application / Strategy / Backtest / Diagnosis
```

- `src/mcp/` only delegates to the REST client
- No business logic in the MCP layer
- No direct import of `application/`, `strategy/`, `backtest/`

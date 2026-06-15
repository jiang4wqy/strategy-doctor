# Strategy Doctor API v1

Strategy Doctor exposes deterministic five-dimension diagnosis for two registered strategy archetypes:

- `ma-cross`
- `rsi-bollinger-mean-reversion`

The public Web/API uses offline `MockBacktester`. It does not read account data or private Bitget credentials and cannot submit orders.

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
    "timeframe": "1h"
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

## Temporary remote URL

Keep the local service running and start:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Use the generated `trycloudflare.com` URL as `STRATEGY_DOCTOR_URL`. The URL changes after restart. Share the URL and API key privately. Quick Tunnel is for demo/testing, not permanent production.

## P1 limits

- One `*USDT` symbol per diagnosis
- Timeframes: `1h`, `4h`, `1d`
- Two registered archetypes only
- Offline `MockBacktester` for public Web/API
- No database; browser history stays local
- No fees, slippage, funding, latency, or order-book fill model
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

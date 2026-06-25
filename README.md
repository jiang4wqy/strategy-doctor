# Strategy Doctor

> A pre-publication risk auditor for AI-generated trading strategies.

Strategy Doctor is a Bitget AI Hackathon Track 2 Trading Infra project. It sits between strategy generation and deployment: given a structured strategy, it runs deterministic adversarial stress tests, explains how the strategy fails, proposes constrained parameter repairs, validates the trade-off on held-out scenarios, and reports whether the strategy is ready for Playbook sandbox publication.

Reviewers can open the no-login showcase after starting the service:

```text
http://127.0.0.1:8080/showcase
```

## Core Capabilities

- Five stress dimensions: `macro`, `market-intel`, `news`, `sentiment`, and `technical`.
- Three validated strategy archetypes: `ma-cross`, `rsi-bollinger-mean-reversion`, and `breakout-confirmation`.
- Natural-language strategy intake with an explicit confirmation boundary before diagnosis.
- Risk style scoring, failure classification, adapter-scoped prescriptions, and held-out validation.
- REST API, OpenAPI, TypeScript client, CLI, protected Web workspace, and public showcase.
- Offline and deterministic by default; Bitget public market data and AI narrative enhancement are explicit opt-ins.

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

## Requirements

- Node.js 24 or later.
- npm from the Node.js installation.

```powershell
npm.cmd ci
npm.cmd run verify
```

`verify` runs the core coverage gate, TypeScript checks, and the offline CLI demo. Coverage thresholds are 90% lines, 80% branches, and 95% functions.

## Quick Start

### 1. CLI

```powershell
npm.cmd run demo
```

Explicit MA trend-following example:

```powershell
node src/cli.ts examples/trend-follower.json `
  --style conservative `
  --seed 42 `
  --candidates 6
```

RSI/Bollinger mean-reversion example:

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

### 2. Web

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-preview-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-this-with-a-random-32-char-secret'
$env:DOCTOR_API_KEYS='replace-this-with-a-private-agent-key'
npm.cmd run web
```

Open `http://127.0.0.1:8080`, enter the access code, describe a strategy, confirm the parsed draft, and run the diagnosis.

### 3. REST

Keep the Web/API service running, then call it from another PowerShell terminal:

```powershell
$headers = @{
  Authorization = 'Bearer replace-this-with-a-private-agent-key'
}
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:8080/api/v1/capabilities' `
  -Headers $headers
```

See [API documentation](docs/API.md) and `examples/agent-curl.ps1` for a complete request.

### 4. TypeScript Client

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='replace-this-with-a-private-agent-key'
node examples/agent-client.ts
```

## Long-lived Public URL

For judges and demos, deploy once to a managed host with `Dockerfile` + `render.yaml`:

```text
1) Connect your GitHub repo to Render and create a Docker service.
2) Set these secrets in the Render dashboard:
   - DOCTOR_WEB_ACCESS_CODE
   - DOCTOR_SESSION_SECRET
   - DOCTOR_API_KEYS
3) Open:
   - Workspace: https://your-service.onrender.com
   - Public showcase: https://your-service.onrender.com/showcase
```

See [docs/DEPLOY_PUBLIC.md](docs/DEPLOY_PUBLIC.md) for full permanent deployment steps
for Render, Railway, and Cloudflare Tunnel.

## API Surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | Public health check |
| `POST` | `/api/v1/auth` | Web access-code login |
| `DELETE` | `/api/v1/auth` | Clear the Web session |
| `GET` | `/api/v1/capabilities` | Read registered strategy capabilities |
| `POST` | `/api/v1/strategies/parse` | Parse natural language into a strategy draft |
| `POST` | `/api/v1/diagnoses` | Run the five-dimensional diagnosis |
| `GET` | `/api/v1/openapi.json` | Read the OpenAPI 3.0 document |

Every endpoint except health requires either a Bearer key or a valid browser session.

## Strategy Boundaries

| Archetype | Behavior | Main Strategy-Specific Parameters |
|---|---|---|
| `ma-cross` | Moving-average trend following | `fastMA`, `slowMA` |
| `rsi-bollinger-mean-reversion` | RSI and Bollinger mean reversion with a trend filter | RSI, Bollinger, trend-filter parameters |
| `breakout-confirmation` | Confirmed range breakout with a volatility gate and invalidation exit | Breakout lookback, confirmation, volatility gate |

Clients should read parameter metadata from `/api/v1/capabilities` instead of maintaining a second copy. The project intentionally does not expose an arbitrary strategy DSL or dynamic code execution surface.

## Offline and Optional Online Modes

| Mode | Command | Network | Private Trading Credentials |
|---|---|---:|---:|
| Offline CLI | `npm.cmd run demo` | No | Not needed |
| Web/API | `npm.cmd run web` | No | Not needed |
| Bitget public candles | `npm.cmd run demo:live` | Yes | Not needed |
| Public snapshot refresh | `npm.cmd run snapshots:refresh` | Yes | Not needed |
| AI narrative enhancement | See `docs/SETUP.md` | Yes | Anthropic key only |

Default CI, CLI, Web, and API workflows do not call live Bitget services or Anthropic.

## Safety Boundary

- No order placement, account access, balance reads, position reads, or fund movement.
- No Bitget API key, secret, or passphrase is needed or accepted by the default product surface.
- Web access codes and API keys only protect the temporary diagnosis service; they are not exchange credentials.
- `MockBacktester` does not model fees, slippage, funding, latency, or order-book fills.
- Diagnoses and prescriptions are risk analysis, not investment advice or return guarantees.

## Documentation

- [Setup and environment](docs/SETUP.md)
- [REST and TypeScript API](docs/API.md)
- [Three-minute demo script](docs/DEMO.md)
- [Hackathon submission notes](docs/SUBMISSION.md)
- [Submission form draft](docs/SUBMISSION_FORM.md)
- [Submission evidence package](docs/SUBMISSION_EVIDENCE.md)
- [Bitget Playbook evidence](docs/PLAYBOOK_EVIDENCE.md)
- [Team workflow](docs/TEAM.md)
- [Work log](docs/WORK_LOG.md)

## License

MIT. See [LICENSE](LICENSE).

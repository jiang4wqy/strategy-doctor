# Strategy Doctor

**Strategy Doctor is a risk lab for AI-generated trading strategies.**

An agent can write a strategy in seconds. Strategy Doctor asks the slower,
more important questions before anyone trusts it: where does it break, why did
it fail, what repair is allowed, and what return cost did that repair create?

Built for **Bitget AI Hackathon Track 2: Trading Infra**, it turns natural
language or strategy JSON into a typed strategy, attacks it across market
failure modes, and returns reviewer-ready evidence through the Web app, REST
API, TypeScript client, CLI, and MCP adapter.

<p align="center">
  <img src="docs/assets/strategy-doctor-judge-optimized.png" alt="Strategy Doctor judge mode showing the live diagnosis entry point and risk cockpit" width="92%">
</p>

## What It Does In One Run

1. **Draft** a strategy from natural language or JSON.
2. **Confirm** every parsed parameter before diagnosis starts.
3. **Stress-test** the strategy across five market-risk dimensions.
4. **Explain** the failure mode, drawdown, cost drag, and death causes.
5. **Repair** parameters with bounded, strategy-owned mutation rules.
6. **Validate** the repaired strategy on held-out scenarios.
7. **Export** evidence for judges, teams, and downstream agents.

## Why This Exists

Most trading-agent demos stop at generation: "Here is a strategy." Strategy
Doctor starts where that demo ends.

It answers the questions a team actually needs before evaluation:

- Which regime breaks this strategy: trend reversal, chop, crash, spread, or liquidity?
- Was the strategy killed by leverage, stop-loss design, overtrading, or cost drag?
- Did the proposed repair improve robustness, or only hide risk?
- What return trade-off did the repair create?
- Can another agent call the system safely through a stable API?

The result is not a promise of profit. It is a reproducible risk report.

## Demo Screens

| Judge review surface | GitHub submission surface |
|---|---|
| ![Judge landing and risk cockpit](docs/assets/strategy-doctor-judge-optimized.png) | ![GitHub review links and evidence checklist](docs/assets/strategy-doctor-github-review-surface.png) |

## Core Capabilities

| Layer | What is included |
|---|---|
| Strategy intake | Natural-language drafting, JSON input, explicit parameter confirmation |
| Strategy registry | `ma-cross` and `rsi-bollinger-mean-reversion` adapters |
| Diagnosis engine | Five-dimension stress testing: `sentiment`, `macro`, `market-intel`, `news`, `technical` |
| Repair loop | Targeted prescriptions instead of arbitrary rewrites |
| Validation | Held-out scenario checks with robustness and return deltas separated |
| Interfaces | Protected Web workspace, REST API, OpenAPI, TypeScript client, CLI, MCP adapter |
| Data boundary | Offline deterministic default; Bitget public candles are opt-in |
| Submission evidence | Deterministic evidence pack, API logs, screenshots, and reproducible scripts |

```mermaid
flowchart LR
  A["Natural language or strategy JSON"] --> B["Capability validation"]
  B --> C["Five stress dimensions"]
  C --> D["Seeded candidate search"]
  D --> E["Worst-case diagnosis"]
  E --> F["Targeted repair"]
  F --> G["Held-out validation"]
  G --> H["Web, REST, TypeScript, CLI, or MCP"]
```

## Quick Start

Node.js 24 or newer is required.

```powershell
npm.cmd ci
npm.cmd run verify
```

If `npm.cmd` is not available in your `PATH`, use the bundled Node runtime directly:

```powershell
& 'D:\tools\node-v24.14.0-win-x64\node.exe' --test "tests/**/*.test.ts"
```

## Run The Local Showcase

The recommended Windows entrypoint avoids PATH issues, clears a stale port, builds the Web client, starts the server, and prints the access code.

```powershell
.\scripts\start-showcase.ps1
```

If PowerShell script execution is disabled on your machine, use:

```powershell
.\scripts\start-showcase.cmd
```

Open:

```text
http://127.0.0.1:8080/showcase
```

Default local access code:

```text
team-preview-code-change-me
```

Stop the local server:

```powershell
.\scripts\stop-showcase.ps1
```

## Long-Lived Public URL

For a durable public link, do **not** use the temporary Cloudflare tunnel.

- Deploy with `render.yaml` (recommended) using `Dockerfile`.
- Bind host to `0.0.0.0` and set `DOCTOR_WEB_ACCESS_CODE` +
  `DOCTOR_SESSION_SECRET` in production environment variables.
- Keep `/judge` public, and keep `/showcase` protected by the access code.

See:

- [Public deployment playbook](docs/DEPLOY_PUBLIC.md)
- [Public demo and quick tunnel](docs/PUBLIC_DEMO.md)

Typical host outputs:

```text
https://<service>.onrender.com/judge
https://<service>.onrender.com/showcase
```

## Generate The Submission Evidence Pack

```powershell
.\scripts\build-submission-pack.ps1 -Seed 42 -Candidates 6
```

Execution-policy-safe wrapper:

```powershell
.\scripts\build-submission-pack.cmd -Seed 42 -Candidates 6
```

Outputs:

```text
artifacts/submission-pack/strategy-doctor-submission-pack.json
artifacts/submission-pack/strategy-doctor-submission-pack.md
```

The pack includes run controls, five-dimension coverage, held-out validation, risk-dashboard alerts, prescription changes, and a deterministic evidence hash.

## CLI

```powershell
npm.cmd run demo
```

Run the RSI/Bollinger strategy:

```powershell
node src/cli.ts examples/rsi-bollinger.json `
  --style conservative `
  --seed 42 `
  --candidates 6
```

## API Surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | Health check |
| `POST` | `/api/v1/auth` | Browser access-code login |
| `DELETE` | `/api/v1/auth` | Clear browser session |
| `GET` | `/api/v1/capabilities` | List registered strategy capabilities |
| `POST` | `/api/v1/strategies/parse` | Parse natural language into a strategy draft |
| `POST` | `/api/v1/diagnoses` | Run five-dimension diagnosis |
| `GET` | `/api/v1/openapi.json` | OpenAPI 3.0 document |

All API routes except health require either a Bearer API key or a valid browser session.

## Security Boundary

- No order placement.
- No account, balance, position, or funding operations.
- No private Bitget secret, passphrase, or account key is required for default operation.
- Web access codes and API keys only protect the preview service; they are not trading credentials.
- Diagnosis output is risk analysis, not investment advice or a return guarantee.

## Documentation

- [Setup and operations](docs/SETUP.md)
- [REST and TypeScript API](docs/API.md)
- [Demo script](docs/DEMO.md)
- [Hackathon submission notes](docs/SUBMISSION.md)
- [Team collaboration rules](docs/TEAM.md)

## License

MIT. See [LICENSE](LICENSE).

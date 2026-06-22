# Submission Form Draft

Use this as the working copy for the Bitget AI Hackathon S1 submission form.
Replace local URLs with public URLs after deployment.

## Project

Project name:

```text
Strategy Doctor
```

One-line pitch:

```text
Strategy Doctor is the pre-publication risk doctor for trading Agents: before a generated strategy reaches Playbook sandbox or live execution, it proves how the strategy fails, repairs only failure-related parameters, and validates the risk-return tradeoff on independent held-out scenarios.
```

Track:

```text
Track 2 - Trading Infra
```

Repository:

```text
https://github.com/jiang4wqy/strategy-doctor
```

Public demo:

```text
TODO: replace with deployed /showcase URL
Local preview: http://127.0.0.1:8080/showcase
Developer preview: http://127.0.0.1:8080/developer
```

Demo video:

```text
TODO: add three-minute video URL
```

Published Playbook:

```text
TODO: add Bitget Playbook published URL after managed upload/backtest/publish
```

## Four-Part Project Description

### 1. Problem

Trading Agents can already generate strategy ideas quickly, but they commonly
lack a trustworthy pre-deployment check. A single backtest does not explain
which unseen market regime breaks the strategy, why it fails, or whether a
parameter patch only hides risk.

### 2. Thesis

The missing Track 2 infrastructure is a strategy doctor, not another strategy
generator. Before an Agent publishes to Playbook sandbox or hands a strategy to
an execution layer, it should run a reproducible failure diagnosis, receive a
constrained repair, and see the held-out cost of becoming safer.

### 3. Implementation

Strategy Doctor treats every strategy as a registered capability. It validates
the strategy contract, attacks it across five deterministic stress dimensions
— macro, market intelligence, news, sentiment, and technical whipsaw — selects
the worst scenario per dimension, explains death causes, mutates only
failure-related parameters, and validates the patched strategy on independent
held-out scenarios.

### 4. View on AI Trading

Agentic trading should make risk more inspectable, not just make strategy
generation faster. Strategy Doctor turns generated strategies into auditable
deployment decisions: Ready, Watch, or Blocked, with the exact evidence behind
that verdict.

## Why It Fits Track 2

- It exposes a developer-facing REST API, OpenAPI document, TypeScript client,
  CLI, no-login `/developer` API guide, and Web workspace.
- It has capability discovery for registered strategy archetypes instead of an
  unsafe arbitrary-code strategy DSL.
- It provides reproducible input-output artifacts and API-call logs.
- It bridges into Bitget Playbook through a credential-free validated Playbook
  package.
- It keeps default demos offline and deterministic, with live Bitget public
  market data as an explicit opt-in path.

## Current Strategy Coverage

- `ma-cross`: moving-average trend following.
- `rsi-bollinger-mean-reversion`: RSI and Bollinger mean reversion with trend
  filter.
- `breakout-confirmation`: confirmed range breakout with volatility gate and
  invalidation exit.
- `atr-trend-breakout`: ATR-aware trend breakout with volatility-sized stop
  sensitivity.

## Key Differentiators

- Five-dimensional adversarial diagnosis rather than single backtest metrics.
- Strategy-specific mutation policy: the repair engine asks the adapter which
  parameters are safe and relevant to mutate.
- Held-out validation is reported honestly, including return cost.
- Playbook readiness gate: no liquidation, drawdown budget, treatment survival,
  held-out robustness, and return trade-off.
- No account, balance, position, order, or private Bitget credential access in
  the default product surface.

## Reproducibility

Local validation command:

```powershell
npm.cmd ci
npm.cmd run verify
```

Manual local demo:

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='demo-code-change-me'
$env:DOCTOR_SESSION_SECRET='demo-session-secret-at-least-32-chars'
$env:DOCTOR_API_KEYS='demo-private-agent-key'
npm.cmd run web
```

Open:

```text
http://127.0.0.1:8080/showcase
http://127.0.0.1:8080/developer
```

Remote preview helper:

```powershell
npm.cmd run preview:access
```

Usage record refresh:

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='demo-private-agent-key'
npm.cmd run healthcheck
npm.cmd run submission:usage-record
```

## Evidence Files

- `docs/SUBMISSION_EVIDENCE.md`
- `docs/PLAYBOOK_EVIDENCE.md`
- `docs/DEPLOYMENT.md`
- `.env.example`
- `deploy/*`
- `submission-package/index.md` after running `npm.cmd run submission:package`
- `examples/submission/api-call-log.jsonl`
- `examples/submission/*-diagnose-request.json`
- `examples/submission/*-scorecard.json`
- `examples/submission/*-diagnosis-view.json`
- `examples/playbook/strategy-doctor-adaptive-playbook`

## Video Outline

1. Open `/showcase` and show the four registered strategies.
2. Open `/developer` and show API verification, environment variables, and usage record commands.
3. Explain that Strategy Doctor audits before Playbook publication.
4. Show five-dimensional stress results and failure causes.
5. Show targeted parameter prescription and held-out trade-off.
6. Show the Playbook readiness panel.
7. Show `npm run api:check`, `npm run healthcheck`, and `npm run submission:usage-record`.
8. Show the validated Playbook package and evidence docs.

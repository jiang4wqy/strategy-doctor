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
Strategy Doctor is a Playbook pre-publication risk auditor for trading Agents: it finds how a strategy fails, repairs only failure-related parameters, validates the trade-off on held-out scenarios, and reports whether it is safe enough for Playbook sandbox publication.
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
Temporary preview: https://mirrors-resolution-device-weblogs.trycloudflare.com/showcase
Local preview: http://127.0.0.1:8080/showcase
```

Demo video:

```text
Pending: add three-minute video URL
```

Published Playbook:

```text
Pending: add Bitget Playbook published URL after managed upload/backtest/publish
```

## What It Does

Strategy Doctor sits between AI strategy generation and deployment. Instead of
claiming that a generated strategy is ready to trade, it subjects registered
strategies to five deterministic stress dimensions: macro, market intelligence,
news, sentiment, and technical whipsaw. It explains failure causes, proposes a
constrained prescription, validates the patch on held-out scenarios, and returns
a Playbook readiness score with explicit deployment gates.

## Why It Fits Track 2

- It exposes a developer-facing REST API, OpenAPI document, TypeScript client,
  CLI, and Web workspace.
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
cd D:\github\strategy-doctor-submission
powershell -ExecutionPolicy Bypass -File .\scripts\run-local-submission.ps1
```

Manual local demo:

```powershell
$env:PATH='D:\tools\node-v24.14.0-win-x64;' + $env:PATH
$env:DOCTOR_WEB_ACCESS_CODE='demo-code-change-me'
$env:DOCTOR_SESSION_SECRET='demo-session-secret-at-least-32-chars'
$env:DOCTOR_API_KEYS='demo-private-agent-key'
D:\tools\node-v24.14.0-win-x64\npm.cmd run web
```

Open:

```text
http://127.0.0.1:8080/showcase
```

## Evidence Files

- `docs/SUBMISSION_EVIDENCE.md`
- `docs/TEST_CASES.md`
- `docs/PLAYBOOK_EVIDENCE.md`
- `submission-package/index.md` after running `npm.cmd run submission:package`
- `examples/submission/api-call-log.jsonl`
- `examples/submission/*-diagnose-request.json`
- `examples/submission/*-scorecard.json`
- `examples/submission/*-diagnosis-view.json`
- `examples/playbook/strategy-doctor-adaptive-playbook`

## Video Outline

1. Open `/showcase` and show the three registered strategies.
2. Explain that Strategy Doctor audits before Playbook publication.
3. Show five-dimensional stress results and failure causes.
4. Show targeted parameter prescription and held-out trade-off.
5. Show the Playbook readiness panel.
6. Show the validated Playbook package and evidence docs.

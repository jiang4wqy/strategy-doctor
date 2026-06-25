# Strategy Doctor Test Cases

This file is the judge-facing and teammate-facing test plan for Strategy Doctor.
It covers deterministic local validation, public demo smoke checks, Agent API
integration, DeepSeek natural-language parsing, and safety guardrails.

## Test Environment

Recommended local runtime:

```powershell
cd D:\github\strategy-doctor-submission
$env:PATH='D:\tools\node-v24.14.0-win-x64;' + $env:PATH
```

Current temporary public preview:

```text
https://mirrors-resolution-device-weblogs.trycloudflare.com
```

Temporary preview credentials:

```text
Web access code: team-preview-code-change-me
Agent API key: agent-key-if-needed
```

Do not commit real API keys. DeepSeek and Playbook keys must stay in local or
deployment-platform environment variables.

## Automated Gate Matrix

| ID | Area | Command | Expected Result |
|---|---|---|---|
| TC-A01 | Core regression | `node --test tests/**/*.test.ts` | All deterministic core tests pass; live Bitget smoke remains skipped by default. |
| TC-A02 | Web regression | `npm.cmd run test:web` | All React/Web tests pass. |
| TC-A03 | Core types | `npm.cmd run typecheck:core` | TypeScript core passes. |
| TC-A04 | Web types | `npm.cmd run typecheck:web` | TypeScript Web passes. |
| TC-A05 | Production Web build | `npm.cmd run build:web` | `web/dist` is generated with hashed assets. |
| TC-A06 | Offline demo | `npm.cmd run demo` | Deterministic report renders scorecard, deaths, prescription, and held-out trade-off. |
| TC-A07 | Submission package | `npm.cmd run submission:package` | Local ignored `submission-package/` is generated with artifact hashes. |
| TC-A08 | Whitespace safety | `git diff --check` | No whitespace errors. |

One-command local acceptance:

```powershell
.\scripts\run-local-submission.ps1
```

## Public Demo Smoke

| ID | Input | Steps | Expected Result |
|---|---|---|---|
| TC-P01 | `/api/v1/health` | Open `https://mirrors-resolution-device-weblogs.trycloudflare.com/api/v1/health`. | HTTP 200 with `{ "status": "ok", "offline": true }`. |
| TC-P02 | `/showcase` | Open `https://mirrors-resolution-device-weblogs.trycloudflare.com/showcase`. | No-login showcase loads and includes Strategy Doctor content. |
| TC-P03 | Protected workspace | Open the public root URL and enter the access code. | Workspace unlocks without exposing the Agent API key. |

Scripted smoke:

```powershell
.\scripts\run-smoke-tests.ps1 `
  -BaseUrl 'https://mirrors-resolution-device-weblogs.trycloudflare.com' `
  -ApiKey 'agent-key-if-needed'
```

## Agent API Test Cases

| ID | Endpoint | Request | Expected Result |
|---|---|---|---|
| TC-API01 | `GET /api/v1/capabilities` | Bearer `agent-key-if-needed` | Returns three registered archetypes: `ma-cross`, `rsi-bollinger-mean-reversion`, and `breakout-confirmation`. |
| TC-API02 | `POST /api/v1/strategies/parse` | `BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30` | Returns `source: "rules"`, `archetype: "ma-cross"`, `timeframe: "1h"`. |
| TC-API03 | `POST /api/v1/strategies/parse` with DeepSeek enabled | `BTC moving average strategy` | Returns `source: "deepseek"` and a complete validated `ma-cross` strategy. |
| TC-API04 | `POST /api/v1/diagnoses` | `examples/submission/ma-diagnose-request.json` | Returns five evaluations, chart-ready view data, prescription, and deployment readiness. |
| TC-API05 | Missing bearer key | Any protected route without `Authorization` | Returns stable `AUTH_REQUIRED` envelope. |

DeepSeek local setup:

```powershell
[Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY','<your-key>','User')
$env:DOCTOR_NL_AI_ENABLED='1'
$env:DOCTOR_NL_PROVIDER='deepseek'
$env:DOCTOR_NL_DEEPSEEK_ENABLED='1'
$env:DOCTOR_DEEPSEEK_MODEL='deepseek-v4-flash'
```

## Strategy Diagnosis Test Cases

| ID | Strategy | Input File | Expected Result |
|---|---|---|---|
| TC-S01 | Moving-average crossover | `examples/trend-follower.json` | Five dimensions, deterministic seed `42`, held-out seed `100042`, non-empty prescription. |
| TC-S02 | RSI/Bollinger mean reversion | `examples/rsi-bollinger.json` | Adapter-specific parameters and labels appear in prescription. |
| TC-S03 | Confirmed breakout | `examples/breakout-confirmation.json` | Breakout adapter parses, diagnoses, and preserves registered parameter invariants. |

CLI command template:

```powershell
node src/cli.ts examples/trend-follower.json --style conservative --seed 42 --candidates 6
node src/cli.ts examples/rsi-bollinger.json --style conservative --seed 42 --candidates 6
node src/cli.ts examples/breakout-confirmation.json --style conservative --seed 42 --candidates 6
```

## Safety And Guardrail Test Cases

| ID | Input | Expected Result |
|---|---|---|
| TC-G01 | Unsupported arbitrary strategy text such as `execute a martingale bot` | Rejected with `UNSUPPORTED_STRATEGY_DESCRIPTION`; no model call should execute. |
| TC-G02 | Multi-symbol strategy request | Rejected with `MULTI_SYMBOL_UNSUPPORTED`. |
| TC-G03 | Unsupported symbol or timeframe | Rejected with a stable validation error. |
| TC-G04 | Missing or invalid Web access code | Rejected with `AUTH_INVALID` and rate-limited after repeated attempts. |
| TC-G05 | Missing DeepSeek key | Parser falls back to local rules or stable local validation error; no secret is required for deterministic demo. |

## Evidence Files For Judges

- `examples/submission/api-call-log.jsonl`
- `examples/submission/*-diagnose-request.json`
- `examples/submission/*-scorecard.json`
- `examples/submission/*-diagnosis-view.json`
- `docs/SUBMISSION_EVIDENCE.md`
- `docs/PLAYBOOK_EVIDENCE.md`
- `examples/playbook/strategy-doctor-adaptive-playbook`

## Latest Verified Result

As of 2026-06-25 Asia/Shanghai:

```text
Core tests: 256 passed, 1 skipped
Web tests: 21 passed
DeepSeek parse smoke: passed with source="deepseek"
Public health smoke: passed
Public showcase smoke: passed
```

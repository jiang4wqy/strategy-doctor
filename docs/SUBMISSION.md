# Hackathon Submission

## Project

**Name:** Strategy Doctor
**Track:** Track 2 - Trading Infra
**Repository:** https://github.com/jiang4wqy/strategy-doctor
**Temporary public demo:** https://mirrors-resolution-device-weblogs.trycloudflare.com/showcase
**Local showcase:** http://127.0.0.1:8080/showcase

## One-Line Pitch

Strategy Doctor is a Playbook pre-publication risk auditor for trading Agents: it discovers how a strategy fails, repairs only failure-related parameters, validates the trade-off on held-out scenarios, and reports whether the strategy is safe enough for sandbox publication.

## Why It Fits Track 2

Track 2 rewards developer-facing infrastructure that other builders and Agents can integrate. Strategy Doctor is not another strategy generator; it is the missing diagnostic layer between AI strategy creation and deployment.

- Direct Agent integration through REST, OpenAPI, TypeScript Client, PowerShell examples, and capability discovery.
- A closed registry of validated strategy archetypes instead of arbitrary code execution.
- Reproducible API call logs, sample input/output artifacts, and deterministic seed-based stress tests.
- A validated Bitget Playbook package that can be uploaded through the official GetAgent workflow without committing credentials.
- A no-login public showcase for judges and a protected workspace for team use.

## Problem

Trading Agents can generate strategies, but they often cannot answer:

- Which unseen market regime breaks this strategy?
- Why did it fail?
- Which parameter should change?
- Did the patch improve robustness without hiding the return cost?
- Can another developer or Agent invoke the same diagnosis safely?

## Solution

1. Accept a registered strategy or parse a natural-language description into a confirmable draft.
2. Convert five audited market dimensions into deterministic stress families: macro, market intelligence, news, sentiment, and technical whipsaw.
3. Generate seeded candidates and select the highest-damage scenario per dimension.
4. Return five evaluations, three style scores, failure narratives, and chart-ready data.
5. Mutate only death-related parameters through the strategy adapter policy.
6. Validate the patch on an independent held-out seed.
7. Report a Playbook readiness score with explicit deployment gates.

## Product Surface

- Public no-login showcase route.
- Protected React diagnosis workspace.
- Natural-language strategy compiler with rules, Qwen, Anthropic, and DeepSeek provider support.
- Five-dimensional charts, scorecards, deployment gates, and local history.
- REST API with stable envelopes, request IDs, typed errors, and OpenAPI.
- Native TypeScript Client and copy-ready Agent examples.
- Deterministic CLI for offline reproducibility.

## Strategy Coverage

Executable strategy examples:

```text
examples/trend-follower.json
examples/rsi-bollinger.json
examples/breakout-confirmation.json
```

Registered archetypes:

- `ma-cross`: moving-average trend following.
- `rsi-bollinger-mean-reversion`: RSI/Bollinger mean reversion with trend filter.
- `breakout-confirmation`: confirmed range breakout with volatility gate and invalidation exit.

## Bitget And Playbook Integration

- Bitget public market data can refresh snapshot evidence without private API keys.
- `BitgetBacktester` can read public Bitget OHLCV data.
- Default Web/API/CLI paths use offline deterministic backtesting to keep the public preview safe.
- `examples/playbook/strategy-doctor-adaptive-playbook` is a credential-free Playbook package validated with the official GetAgent validator.

No account, balance, position, order, or private exchange endpoint is used in the default product surface.

## DeepSeek Agent Test

DeepSeek natural-language strategy parsing is supported through the OpenAI-compatible chat endpoint. The recommended model for structured strategy compilation is:

```text
deepseek-v4-flash
```

Latest local smoke result:

```text
POST /api/v1/strategies/parse
description: BTC moving average strategy
source: deepseek
archetype: ma-cross
status: passed
```

## Reproducibility

Local validation:

```powershell
cd D:\github\strategy-doctor-submission
$env:PATH='D:\tools\node-v24.14.0-win-x64;' + $env:PATH
.\scripts\run-local-submission.ps1
```

Public or local smoke:

```powershell
.\scripts\run-smoke-tests.ps1 `
  -BaseUrl 'https://mirrors-resolution-device-weblogs.trycloudflare.com' `
  -ApiKey 'agent-key-if-needed'
```

Manual CLI regression:

```powershell
node src/cli.ts examples/trend-follower.json --style conservative --seed 42 --candidates 6
node src/cli.ts examples/rsi-bollinger.json --style conservative --seed 42 --candidates 6
node src/cli.ts examples/breakout-confirmation.json --style conservative --seed 42 --candidates 6
```

## Evidence Index

- [TEST_CASES.md](TEST_CASES.md)
- [SUBMISSION_EVIDENCE.md](SUBMISSION_EVIDENCE.md)
- [PLAYBOOK_EVIDENCE.md](PLAYBOOK_EVIDENCE.md)
- [DEMO.md](DEMO.md)
- [API.md](API.md)
- `examples/submission/api-call-log.jsonl`
- `examples/submission/*-diagnose-request.json`
- `examples/submission/*-scorecard.json`
- `examples/submission/*-diagnosis-view.json`

## Latest Verified Result

As of 2026-06-25 Asia/Shanghai:

```text
Core tests: 256 passed, 1 skipped
Web tests: 21 passed
DeepSeek parse smoke: passed with source="deepseek"
Public health smoke: passed
Public showcase smoke: passed
```

## Checklist

- [x] Five-dimensional deterministic diagnosis
- [x] Three registered strategy adapters
- [x] Adapter-driven prescription and held-out validation
- [x] Protected Web workspace
- [x] Public no-login showcase route
- [x] REST API, OpenAPI, and TypeScript Client
- [x] Natural-language parser with DeepSeek support
- [x] Reproducible sample input/output artifacts
- [x] Submission-grade test cases
- [x] Validated Playbook package
- [x] Temporary public preview
- [ ] Long-lived managed public URL
- [ ] Demo video URL
- [ ] Published Playbook URL after managed upload/backtest/publish
